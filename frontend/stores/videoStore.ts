import { create } from 'zustand';

interface VideoState {
    activeVideoId: string | null;
    activeVideoTitle: string | null;
    isMinimized: boolean;
    isPlaying: boolean;

    // Actions
    playVideo: (id: string, title?: string) => void;
    minimize: () => void;
    restore: () => void;
    close: () => void;
    setPlaying: (playing: boolean) => void;
}

export const useVideoStore = create<VideoState>((set) => ({
    activeVideoId: null,
    activeVideoTitle: null,
    isMinimized: false,
    isPlaying: false,

    playVideo: (id, title) => set({
        activeVideoId: id,
        activeVideoTitle: title || null,
        isMinimized: false,
        isPlaying: true
    }),

    minimize: () => set({ isMinimized: true }),

    restore: () => set({ isMinimized: false }),

    close: () => set({
        activeVideoId: null,
        activeVideoTitle: null,
        isMinimized: false,
        isPlaying: false
    }),

    setPlaying: (playing) => set({ isPlaying: playing }),
}));
