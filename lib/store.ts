import { create } from 'zustand';
import { User, Role } from './types';

interface UserStore {
  users: User[];
  currentUser: User | null;
  setCurrentUser: (user: User | null) => void;
  setUsers: (users: User[]) => void;
  updateUserRole: (userId: string, role: Role) => void;
  viewMode: 'COMPANY' | 'MASTER';
  setViewMode: (mode: 'COMPANY' | 'MASTER') => void;
}

export const useUserStore = create<UserStore>((set) => ({
  users: [],
  currentUser: null,
  viewMode: 'COMPANY',
  setViewMode: (viewMode) => set({ viewMode }),
  setCurrentUser: (currentUser) => set({ currentUser }),
  setUsers: (users) => set({ users }),
  updateUserRole: (userId, role) =>
    set((state) => ({
      users: state.users.map((u) => (u.id === userId ? { ...u, role } : u)),
      currentUser: state.currentUser?.id === userId ? { ...state.currentUser, role } : state.currentUser,
    })),
}));

export interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
}

interface ToastStore {
  toasts: Toast[];
  addToast: (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
  removeToast: (id: string) => void;
}

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  addToast: (message, type = 'success') => {
    const id = Math.random().toString(36).substring(2, 9);
    set((state) => ({
      toasts: [...state.toasts, { id, message, type }],
    }));
    // Auto-remove after 4 seconds
    setTimeout(() => {
      set((state) => ({
        toasts: state.toasts.filter((t) => t.id !== id),
      }));
    }, 4000);
  },
  removeToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),
}));
