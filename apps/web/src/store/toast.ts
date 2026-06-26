import { create } from 'zustand';

interface ToastStore { message: string | null; show: (msg: string) => void; clear: () => void; }
let timer: ReturnType<typeof setTimeout> | undefined;

export const useToast = create<ToastStore>((set) => ({
  message: null,
  show: (message) => { set({ message }); if (timer) clearTimeout(timer); timer = setTimeout(() => set({ message: null }), 2400); },
  clear: () => set({ message: null }),
}));
