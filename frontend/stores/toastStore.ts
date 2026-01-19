import { create } from 'zustand';

interface ToastMessage {
    id: string;
    message: string;
    type: 'success' | 'error' | 'info';
}

interface ToastState {
    toasts: ToastMessage[];
    show: (message: string, type?: ToastMessage['type']) => void;
    hide: (id: string) => void;
}

export const useToastStore = create<ToastState>((set) => ({
    toasts: [],
    show: (message: string, type: ToastMessage['type'] = 'info') => {
        const id = Math.random().toString(36).substring(7);
        set((state: ToastState) => ({
            toasts: [...state.toasts, { id, message, type }],
        }));
        setTimeout(() => {
            set((state: ToastState) => ({
                toasts: state.toasts.filter((t: ToastMessage) => t.id !== id),
            }));
        }, 3000);
    },
    hide: (id: string) => {
        set((state: ToastState) => ({
            toasts: state.toasts.filter((t: ToastMessage) => t.id !== id),
        }));
    },
}));
