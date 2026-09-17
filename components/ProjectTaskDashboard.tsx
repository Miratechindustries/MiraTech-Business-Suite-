"use client";
import { useState } from "react";
import { Plus, Trash2, CheckCircle2, Loader2 } from "lucide-react";
import { useUserStore } from "../lib/store";
import { motion } from "motion/react";

export interface TaskItem {
  id: string;
  title: string;
  description?: string;
  status: "todo" | "in-progress" | "done";
  priority?: "low" | "medium" | "high";
  projectId?: string;
  departmentId?: string;
  assignedEmployeeId?: string;
  createdAt?: string;
}

interface ProjectTaskDashboardProps {
  companyId?: string;
  projectId?: string;
  tasks?: TaskItem[];
  loading?: boolean;
  onAddTask?: (title: string, projectId?: string) => Promise<void> | void;
  onUpdateTaskStatus?: (id: string, newStatus: "todo" | "in-progress" | "done") => Promise<void> | void;
  onDeleteTask?: (id: string) => Promise<void> | void;
}

export default function ProjectTaskDashboard({
  companyId,
  projectId = "default",
  tasks = [],
  loading = false,
  onAddTask,
  onUpdateTaskStatus,
  onDeleteTask
}: ProjectTaskDashboardProps) {
  const { currentUser } = useUserStore();
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [adding, setAdding] = useState(false);

  const handleAdd = async () => {
    if (!newTaskTitle.trim()) return;
    setAdding(true);
    try {
      if (onAddTask) {
        await onAddTask(newTaskTitle.trim(), projectId);
      } else if (companyId && currentUser?.uid) {
        // Fallback API / fetch
        await fetch('/api/projects/update-task', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            companyId,
            projectId,
            title: newTaskTitle.trim(),
            action: 'create'
          })
        }).catch(() => null);
      }
      setNewTaskTitle("");
    } catch (err) {
      console.error("Failed to add task:", err);
    } finally {
      setAdding(false);
    }
  };

  const handleStatusToggle = (task: TaskItem) => {
    const newStatus = task.status === "done" ? "todo" : "done";
    if (onUpdateTaskStatus) {
      onUpdateTaskStatus(task.id, newStatus);
    }
  };

  const handleDelete = (id: string) => {
    if (onDeleteTask) {
      onDeleteTask(id);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8 text-xs text-slate-500 gap-2">
        <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
        <span>Loading operational tasks...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <input
          type="text"
          value={newTaskTitle}
          onChange={(e) => setNewTaskTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          placeholder="Enter new operational task title..."
          className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
        />
        <button
          onClick={handleAdd}
          disabled={adding || !newTaskTitle.trim()}
          className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
        >
          {adding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
          Add Task
        </button>
      </div>
      
      {tasks.length === 0 ? (
        <div className="text-center py-6 border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
          <p className="text-xs text-slate-500 font-medium">No tasks recorded for this department scope yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {tasks.map((task) => (
            <motion.div
              key={task.id}
              initial={{ opacity: 0, y: 3 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center justify-between p-3 bg-white border border-slate-200/80 rounded-xl shadow-4xs hover:border-slate-300 transition"
            >
              <div className="flex items-center gap-3 min-w-0">
                <button 
                  onClick={() => handleStatusToggle(task)}
                  className={`p-1 rounded-full transition cursor-pointer ${task.status === 'done' ? 'text-emerald-500 hover:text-emerald-600' : 'text-slate-300 hover:text-slate-400'}`}
                >
                  <CheckCircle2 className="w-4 h-4" />
                </button>
                <span className={`text-xs font-medium truncate ${task.status === 'done' ? 'line-through text-slate-400' : 'text-slate-800'}`}>
                  {task.title}
                </span>
                {task.priority && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase ${
                    task.priority === 'high' ? 'bg-red-50 text-red-600' :
                    task.priority === 'medium' ? 'bg-amber-50 text-amber-600' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {task.priority}
                  </span>
                )}
              </div>
              <button 
                onClick={() => handleDelete(task.id)} 
                className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition cursor-pointer"
                title="Delete task"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

