import { create } from 'zustand';

interface UIState {
  activeSessionId?: number;
  setActiveSessionId: (id?: number) => void;
}

export const useUIStore = create<UIState>((set) => ({
  activeSessionId: undefined,
  setActiveSessionId: (id) => set({ activeSessionId: id }),
}));
