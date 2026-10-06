"use client";
import { useState, useEffect } from "react";
import { Plus, Trash2, CheckCircle2, Loader2, MessageSquare, Search, Filter, AlertCircle, Clock, Check, Calendar, User } from "lucide-react";
import { useUserStore, useToastStore } from "../lib/store";
import { motion } from "motion/react";
import EntityActivityDrawer from "./EntityActivityDrawer";
import { db, handleFirestoreError, OperationType, isOfflineError } from "../lib/firebase";
import { collection, onSnapshot, doc, addDoc, updateDoc, deleteDoc, query, where, orderBy, getDocs } from "firebase/firestore";

export interface TaskItem {
  id: string;
  title: string;
  description?: string;
  status: "todo" | "in-progress" | "done";
  priority?: "low" | "medium" | "high";
  projectId?: string;
  departmentId?: string;
  assignedEmployeeId?: string;
  assignedEmployeeName?: string;
  createdAt?: string;
  dueDate?: string;
}

interface ProjectTaskDashboardProps {
  companyId?: string;
  projectId?: string;
  departmentId?: string;
  tasks?: TaskItem[];
  loading?: boolean;
  onAddTask?: (title: string, projectId?: string) => Promise<void> | void;
  onUpdateTaskStatus?: (id: string, newStatus: "todo" | "in-progress" | "done") => Promise<void> | void;
  onDeleteTask?: (id: string) => Promise<void> | void;
}

export default function ProjectTaskDashboard({
  companyId: propCompanyId,
  projectId = "default",
  departmentId,
  tasks: propTasks,
  loading: propLoading = false,
  onAddTask,
  onUpdateTaskStatus,
  onDeleteTask
}: ProjectTaskDashboardProps) {
  const { currentUser } = useUserStore();
  const addToast = useToastStore((state) => state.addToast);

  const companyId = propCompanyId || currentUser?.companyId || currentUser?.businessId;

  // Internal state when propTasks is not provided
  const [internalTasks, setInternalTasks] = useState<TaskItem[]>([]);
  const [internalLoading, setInternalLoading] = useState<boolean>(!propTasks);

  // Form states
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDesc, setNewTaskDesc] = useState("");
  const [newTaskPriority, setNewTaskPriority] = useState<"low" | "medium" | "high">("medium");
  const [newTaskDueDate, setNewTaskDueDate] = useState("");
  const [showAddForm, setShowShowAddForm] = useState(false);
  const [adding, setAdding] = useState(false);

  // Filter & Search states
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");

  const [activeDiscussionTask, setActiveDiscussionTask] = useState<{ id: string; title: string } | null>(null);

  // Realtime subscription if propTasks is not provided
  useEffect(() => {
    if (propTasks) return;
    if (!companyId) {
      setInternalLoading(false);
      return;
    }

    setInternalLoading(true);
    const tasksRef = collection(db, "companies", companyId, "tasks");

    // Primary subscription
    const unsub = onSnapshot(tasksRef, (snap) => {
      const list: TaskItem[] = [];
      snap.forEach((dSnap) => {
        const d = dSnap.data();
        list.push({
          id: dSnap.id,
          title: d.title || "Untitled Task",
          description: d.description || "",
          status: d.status || "todo",
          priority: d.priority || "medium",
          projectId: d.projectId || "",
          departmentId: d.departmentId || "",
          assignedEmployeeId: d.assignedEmployeeId || "",
          assignedEmployeeName: d.assignedEmployeeName || "",
          createdAt: d.createdAt || new Date().toISOString(),
          dueDate: d.dueDate || ""
        });
      });

      // Filter locally if projectId or departmentId specified
      let filtered = list;
      if (projectId && projectId !== "default") {
        filtered = filtered.filter(t => t.projectId === projectId);
      }
      if (departmentId) {
        filtered = filtered.filter(t => t.departmentId === departmentId);
      }

      setInternalTasks(filtered);
      setInternalLoading(false);

      // Offline cache save
      try {
        localStorage.setItem(`miratech_tasks_${companyId}`, JSON.stringify(list));
      } catch (e) {
        // ignore
      }
    }, (err) => {
      console.warn("[ProjectTaskDashboard] Snapshot error, checking local cache:", err);
      try {
        const cached = localStorage.getItem(`miratech_tasks_${companyId}`);
        if (cached) {
          const list: TaskItem[] = JSON.parse(cached);
          let filtered = list;
          if (projectId && projectId !== "default") filtered = filtered.filter(t => t.projectId === projectId);
          if (departmentId) filtered = filtered.filter(t => t.departmentId === departmentId);
          setInternalTasks(filtered);
        }
      } catch (e) {
        // ignore
      }
      setInternalLoading(false);
    });

    return () => unsub();
  }, [propTasks, companyId, projectId, departmentId]);

  const effectiveTasks = propTasks !== undefined ? propTasks : internalTasks;
  const effectiveLoading = propTasks !== undefined ? propLoading : internalLoading;

  // Add Task
  const handleAdd = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newTaskTitle.trim()) return;

    setAdding(true);
    const nowIso = new Date().toISOString();

    const taskData: Omit<TaskItem, "id"> = {
      title: newTaskTitle.trim(),
      description: newTaskDesc.trim(),
      status: "todo",
      priority: newTaskPriority,
      projectId: projectId === "default" ? "" : projectId,
      departmentId: departmentId || "",
      createdAt: nowIso,
      dueDate: newTaskDueDate || ""
    };

    try {
      if (onAddTask) {
        await onAddTask(newTaskTitle.trim(), projectId);
      } else if (companyId) {
        // 1. Direct Firestore write
        const colRef = collection(db, "companies", companyId, "tasks");
        const addedDoc = await addDoc(colRef, taskData);

        // 2. Call API route to update project counts in transaction
        try {
          await fetch('/api/projects/update-task', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              companyId,
              projectId: projectId === "default" ? "" : projectId,
              action: 'create',
              title: newTaskTitle.trim(),
              description: newTaskDesc.trim(),
              priority: newTaskPriority,
              departmentId: departmentId || ""
            })
          });
        } catch (apiErr) {
          console.warn("API project count update failed:", apiErr);
        }

        // Update local state fallback if offline
        const newTask: TaskItem = { id: addedDoc.id, ...taskData };
        setInternalTasks(prev => [newTask, ...prev]);
        addToast(`Task "${newTaskTitle.trim()}" created successfully!`, "success");
      }

      setNewTaskTitle("");
      setNewTaskDesc("");
      setNewTaskDueDate("");
      setShowShowAddForm(false);
    } catch (err: any) {
      console.error("Failed to add task:", err);
      addToast(`Failed to add task: ${err.message || String(err)}`, "error");
    } finally {
      setAdding(false);
    }
  };

  // Toggle or Cycle Status
  const handleStatusChange = async (task: TaskItem, newStatus: "todo" | "in-progress" | "done") => {
    try {
      if (onUpdateTaskStatus) {
        await onUpdateTaskStatus(task.id, newStatus);
      } else if (companyId) {
        // Optimistic UI update
        setInternalTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: newStatus } : t));

        // Direct Firestore update
        const taskRef = doc(db, "companies", companyId, "tasks", task.id);
        await updateDoc(taskRef, {
          status: newStatus,
          updatedAt: new Date().toISOString()
        });

        // Trigger project counter update API
        if (projectId && projectId !== "default") {
          fetch('/api/projects/update-task', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              companyId,
              projectId,
              taskId: task.id,
              newStatus
            })
          }).catch(() => null);
        }
      }
    } catch (err: any) {
      console.error("Failed to update status:", err);
      addToast("Failed to update task status", "error");
    }
  };

  // Delete Task
  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this task?")) return;

    try {
      if (onDeleteTask) {
        await onDeleteTask(id);
      } else if (companyId) {
        // Optimistic UI update
        setInternalTasks(prev => prev.filter(t => t.id !== id));

        // Direct Firestore delete
        const taskRef = doc(db, "companies", companyId, "tasks", id);
        await deleteDoc(taskRef);

        // Trigger API sync
        fetch('/api/projects/update-task', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            companyId,
            projectId: projectId === "default" ? "" : projectId,
            taskId: id,
            action: 'delete'
          })
        }).catch(() => null);

        addToast("Task deleted successfully", "warning");
      }
    } catch (err: any) {
      console.error("Failed to delete task:", err);
      addToast("Failed to delete task", "error");
    }
  };

  // Filter Tasks
  const filteredTasks = effectiveTasks.filter(t => {
    const matchesSearch = 
      t.title.toLowerCase().includes(search.toLowerCase()) ||
      (t.description && t.description.toLowerCase().includes(search.toLowerCase()));
    const matchesStatus = statusFilter === "all" || t.status === statusFilter;
    const matchesPriority = priorityFilter === "all" || t.priority === priorityFilter;

    return matchesSearch && matchesStatus && matchesPriority;
  });

  const totalCount = effectiveTasks.length;
  const doneCount = effectiveTasks.filter(t => t.status === "done").length;
  const inProgressCount = effectiveTasks.filter(t => t.status === "in-progress").length;
  const todoCount = effectiveTasks.filter(t => t.status === "todo").length;
  const progressPct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

  if (effectiveLoading) {
    return (
      <div className="flex items-center justify-center p-8 text-xs text-slate-500 gap-2 bg-slate-50/50 rounded-2xl border border-slate-200">
        <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
        <span>Loading project & operational tasks...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      
      {/* Header Stats Bar */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-4xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-black text-slate-800 uppercase tracking-tight">Project & Operational Tasks</h3>
            <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
              {doneCount}/{totalCount} Completed ({progressPct}%)
            </span>
          </div>
          {/* Progress Bar */}
          <div className="w-full md:w-64 bg-slate-200 rounded-full h-1.5 overflow-hidden">
            <div className="bg-emerald-500 h-full transition-all duration-300" style={{ width: `${progressPct}%` }} />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowShowAddForm(!showAddForm)}
            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" /> {showAddForm ? "Close Form" : "New Task"}
          </button>
        </div>
      </div>

      {/* Expanded Task Creation Form */}
      {showAddForm && (
        <motion.form 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          onSubmit={handleAdd} 
          className="bg-blue-50/60 p-4 rounded-2xl border border-blue-150 space-y-3 shadow-3xs"
        >
          <div className="flex justify-between items-center border-b border-blue-100 pb-2">
            <h4 className="text-xs font-bold text-blue-900 uppercase tracking-wide">Draft New Operational Task</h4>
            <span className="text-[9px] text-blue-600 font-bold uppercase">Target: {projectId === "default" ? "General Scope" : `Project #${projectId}`}</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
            <div className="md:col-span-8">
              <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1">Task Title</label>
              <input
                type="text"
                required
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                placeholder="e.g. Conduct compliance audit on invoice pipeline..."
                className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs focus:outline-hidden focus:border-indigo-500 font-medium"
              />
            </div>

            <div className="md:col-span-4">
              <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1">Priority</label>
              <select
                value={newTaskPriority}
                onChange={(e) => setNewTaskPriority(e.target.value as any)}
                className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs focus:outline-hidden font-bold text-slate-700"
              >
                <option value="low">🟢 Low Priority</option>
                <option value="medium">🟡 Medium Priority</option>
                <option value="high">🚨 High Priority</option>
              </select>
            </div>

            <div className="md:col-span-8">
              <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1">Scope Description (Optional)</label>
              <input
                type="text"
                value={newTaskDesc}
                onChange={(e) => setNewTaskDesc(e.target.value)}
                placeholder="Provide task specifics or execution notes..."
                className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs focus:outline-hidden font-medium"
              />
            </div>

            <div className="md:col-span-4">
              <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1">Due Date (Optional)</label>
              <input
                type="date"
                value={newTaskDueDate}
                onChange={(e) => setNewTaskDueDate(e.target.value)}
                className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs focus:outline-hidden font-medium"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setShowShowAddForm(false)}
              className="px-3 py-1.5 bg-white text-slate-600 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={adding || !newTaskTitle.trim()}
              className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              {adding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              Save Task
            </button>
          </div>
        </motion.form>
      )}

      {/* Search and Filters Bar */}
      <div className="flex flex-col sm:flex-row gap-2 items-center justify-between">
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tasks..."
            className="w-full pl-8 pr-3 py-1.5 border border-slate-200 rounded-xl text-xs bg-white focus:outline-hidden"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto">
          <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Status:</span>
          {["all", "todo", "in-progress", "done"].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-2.5 py-1 text-[10px] font-bold rounded-lg border transition uppercase tracking-wider cursor-pointer ${
                statusFilter === st 
                  ? "bg-slate-900 text-white border-slate-900 shadow-3xs" 
                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
              }`}
            >
              {st === "done" ? `Completed (${doneCount})` : st === "todo" ? `To Do (${todoCount})` : st === "in-progress" ? `In Progress (${inProgressCount})` : `All (${totalCount})`}
            </button>
          ))}
        </div>
      </div>

      {/* Task List */}
      {filteredTasks.length === 0 ? (
        <div className="text-center py-8 border border-dashed border-slate-200 rounded-2xl bg-slate-50/50 space-y-2">
          <Clock className="w-6 h-6 mx-auto text-slate-300" />
          <p className="text-xs text-slate-500 font-semibold">No project tasks recorded for this filter scope.</p>
          <p className="text-[10px] text-slate-400">Click &quot;New Task&quot; above to create a task assignment.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredTasks.map((task) => {
            const isDone = task.status === "done";
            const isInProgress = task.status === "in-progress";

            return (
              <motion.div
                key={task.id}
                initial={{ opacity: 0, y: 3 }}
                animate={{ opacity: 1, y: 0 }}
                className={`p-3 bg-white border rounded-2xl shadow-4xs transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                  isDone ? "border-slate-200 bg-slate-50/40 opacity-75" : "border-slate-200 hover:border-slate-350"
                }`}
              >
                <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
                  
                  {/* Status Toggle Button */}
                  <button 
                    onClick={() => {
                      const next = isDone ? "todo" : isInProgress ? "done" : "in-progress";
                      handleStatusChange(task, next);
                    }}
                    className={`p-1 rounded-full transition cursor-pointer shrink-0 ${
                      isDone 
                        ? "text-emerald-600 bg-emerald-50 hover:bg-emerald-100" 
                        : isInProgress 
                          ? "text-amber-600 bg-amber-50 hover:bg-amber-100" 
                          : "text-slate-300 hover:text-slate-500 bg-slate-100"
                    }`}
                    title={`Click to transition status (Current: ${task.status})`}
                  >
                    <CheckCircle2 className="w-4 h-4" />
                  </button>

                  <div className="space-y-0.5 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`text-xs font-bold truncate ${isDone ? "line-through text-slate-400" : "text-slate-800"}`}>
                        {task.title}
                      </span>

                      {/* Status Badge */}
                      <span className={`text-[8px] font-bold uppercase px-2 py-0.5 rounded-full border ${
                        isDone 
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200" 
                          : isInProgress 
                            ? "bg-amber-50 text-amber-700 border-amber-200" 
                            : "bg-slate-100 text-slate-600 border-slate-200"
                      }`}>
                        {task.status}
                      </span>

                      {/* Priority Badge */}
                      {task.priority && (
                        <span className={`text-[8px] px-2 py-0.5 rounded-full font-extrabold uppercase border ${
                          task.priority === 'high' ? 'bg-red-50 text-red-600 border-red-200' :
                          task.priority === 'medium' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-slate-50 text-slate-600 border-slate-200'
                        }`}>
                          {task.priority} Priority
                        </span>
                      )}
                    </div>

                    {task.description && (
                      <p className="text-[10px] text-slate-500 font-medium leading-relaxed line-clamp-2">
                        {task.description}
                      </p>
                    )}

                    {task.dueDate && (
                      <div className="text-[9px] text-slate-400 font-mono font-medium flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-slate-400" /> Due: {task.dueDate}
                      </div>
                    )}
                  </div>

                </div>

                {/* Actions */}
                <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100">
                  {/* Cycle Status Dropdown */}
                  <select
                    value={task.status}
                    onChange={(e) => handleStatusChange(task, e.target.value as any)}
                    className="px-2 py-1 border border-slate-200 rounded-lg text-[10px] font-bold bg-white text-slate-700 focus:outline-hidden cursor-pointer"
                  >
                    <option value="todo">To Do</option>
                    <option value="in-progress">In Progress</option>
                    <option value="done">Completed</option>
                  </select>

                  {companyId && (
                    <button
                      onClick={() => setActiveDiscussionTask({ id: task.id, title: task.title })}
                      className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition cursor-pointer flex items-center gap-1 text-[10px] font-bold border border-transparent hover:border-indigo-100"
                      title="Open task activity thread & team chat"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                    </button>
                  )}

                  <button 
                    onClick={() => handleDelete(task.id)} 
                    className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition cursor-pointer border border-transparent hover:border-red-100"
                    title="Delete task"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Discussion Drawer */}
      {activeDiscussionTask && companyId && (
        <EntityActivityDrawer
          isOpen={true}
          onClose={() => setActiveDiscussionTask(null)}
          companyId={companyId}
          entityType="tasks"
          entityId={activeDiscussionTask.id}
          entityTitle={`Task: ${activeDiscussionTask.title}`}
        />
      )}
    </div>
  );
}
