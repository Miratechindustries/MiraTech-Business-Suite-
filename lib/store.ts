import { create } from 'zustand';
import { UserProfile, Business } from './types';

interface AppState {
  user: UserProfile | null;
  business: Business | null;
  isLoading: boolean;
  isSidebarOpen: boolean;
  setUser: (user: UserProfile | null) => void;
  setBusiness: (business: Business | null) => void;
  setLoading: (loading: boolean) => void;
  toggleSidebar: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  user: null,
  business: null,
  isLoading: true,
  isSidebarOpen: true,
  setUser: (user) => set({ user }),
  setBusiness: (business) => set({ business }),
  setLoading: (loading) => set({ isLoading: loading }),
  toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
}));
