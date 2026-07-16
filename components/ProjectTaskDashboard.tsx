"use client";
import { useState, useEffect } from "react";
import { db } from "../lib/firebase";
import { collection, addDoc, onSnapshot, query, orderBy, doc, updateDoc, deleteDoc } from "firebase/firestore";
import { Plus, Trash2, CheckCircle2, Loader2, AlertCircle } from "lucide-react";
import { useUserStore } from "../lib/store";
import { motion } from "motion/react";

interface Task {
  id: string;
  title: string;
  description: string;
  status: "todo" | "in-progress" | "done";
  priority: "low" | "medium" | "high";
  createdAt: string;
}

export default function ProjectTaskDashboard({ departmentId }: { departmentId: string }) {
  const { currentUser } = useUserStore();
  const businessId = currentUser?.businessId;
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (!businessId) return;
    const tasksRef = collection(db, "companies", businessId, "tasks");
    const q = query(tasksRef, orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: Task[] = [];
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() } as Task);
      });
      setTasks(list);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [businessId]);

  const addTask = async () => {
    if (!newTaskTitle.trim() || !businessId || !currentUser?.uid) {
      console.error("Missing required information to add task");
      return;
    }
    setAdding(true);
    try {
      await addDoc(collection(db, "companies", businessId, "tasks"), {
        title: newTaskTitle,
        description: "",
        status: "todo",
        priority: "medium",
        createdAt: new Date().toISOString(),
        ownerId: currentUser.uid
      });
      setNewTaskTitle("");
    } catch (err) {
      console.error("Failed to add task:", err);
    } finally {
      setAdding(false);
    }
  };

  const updateTaskStatus = async (id: string, status: "todo" | "in-progress" | "done") => {
    if (!businessId) return;
    try {
      await updateDoc(doc(db, "companies", businessId, "tasks", id), { status });
    } catch (err) {
      console.error("Failed to update task:", err);
    }
  };

  const deleteTask = async (id: string) => {
    if (!businessId) return;
    try {
      await deleteDoc(doc(db, "companies", businessId, "tasks", id));
    } catch (err) {
      console.error("Failed to delete task:", err);
    }
  };

  if (loading) return <div className="p-4 text-xs">Loading tasks...</div>;

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <input
          type="text"
          value={newTaskTitle}
          onChange={(e) => setNewTaskTitle(e.target.value)}
          placeholder="New task title..."
          className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-xs"
        />
        <button
          onClick={addTask}
          disabled={adding}
          className="px-3 py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold flex items-center gap-1.5"
        >
          {adding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
          Add Task
        </button>
      </div>
      
      <div className="space-y-2">
        {tasks.map((task) => (
          <motion.div
            key={task.id}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-lg shadow-4xs"
          >
            <div className="flex items-center gap-3">
              <button 
                onClick={() => updateTaskStatus(task.id, task.status === 'done' ? 'todo' : 'done')}
                className={`p-1 rounded-full ${task.status === 'done' ? 'text-emerald-500' : 'text-slate-300'}`}
              >
                <CheckCircle2 className="w-5 h-5" />
              </button>
              <span className={`text-xs ${task.status === 'done' ? 'line-through text-slate-400' : 'text-slate-800'}`}>
                {task.title}
              </span>
            </div>
            <button onClick={() => deleteTask(task.id)} className="text-slate-400 hover:text-red-500">
              <Trash2 className="w-4 h-4" />
            </button>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
