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
