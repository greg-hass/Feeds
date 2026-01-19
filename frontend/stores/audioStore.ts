import { create } from 'zustand';
import { Audio, InterruptionModeAndroid, InterruptionModeIOS } from 'expo-av';
import { Platform } from 'react-native';

interface AudioState {
    isPlaying: boolean;
    currentArticleId: number | null;
    currentUrl: string | null;
    title: string | null;
    author: string | null;
    coverArt: string | null;
    position: number;
    duration: number;
    playbackSpeed: number;
    isMuted: boolean;
    volume: number;
    sleepTimer: number | null; // minutes
    isMinimized: boolean;
    isPlayerVisible: boolean;

    // Actions
    play: (article: { id: number; url: string; title: string; author: string; coverArt: string }) => Promise<void>;
    pause: () => Promise<void>;
    resume: () => Promise<void>;
    stop: () => Promise<void>;
    seek: (position: number) => Promise<void>;
    setSpeed: (speed: number) => Promise<void>;
    setVolume: (volume: number) => Promise<void>;
    toggleMute: () => Promise<void>;
    setSleepTimer: (minutes: number | null) => void;
    skipForward: () => Promise<void>;
    skipBackward: () => Promise<void>;
    minimize: () => void;
    restore: () => void;
    showPlayer: () => void;
    hidePlayer: () => void;
}

let soundInstance: Audio.Sound | null = null;
let sleepTimerId: any = null;

export const useAudioStore = create<AudioState>((set, get) => ({
    isPlaying: false,
    currentArticleId: null,
    currentUrl: null,
    title: null,
    author: null,
    coverArt: null,
    position: 0,
    duration: 0,
    playbackSpeed: 1.0,
    isMuted: false,
    volume: 1.0,
    sleepTimer: null,
    isMinimized: false,
    isPlayerVisible: false,

    play: async (article) => {
        try {
            if (soundInstance) {
                await soundInstance.unloadAsync();
            }

            // Configure audio for background playback
            await Audio.setAudioModeAsync({
                allowsRecordingIOS: false,
                staysActiveInBackground: true,
                interruptionModeIOS: InterruptionModeIOS.DoNotMix,
                playsInSilentModeIOS: true,
                shouldDuckAndroid: true,
                interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
                playThroughEarpieceAndroid: false,
            });

            const { sound, status } = await Audio.Sound.createAsync(
                { uri: article.url },
                {
                    shouldPlay: true,
                    rate: get().playbackSpeed,
                    shouldCorrectPitch: true,
                    volume: get().volume,
                    isMuted: get().isMuted
                },
                (status) => {
                    if (status.isLoaded) {
                        set({
                            position: status.positionMillis,
                            duration: status.durationMillis || 0,
                            isPlaying: status.isPlaying
                        });
                        if (status.didJustFinish) {
                            set({ isPlaying: false, position: 0 });
                        }
                    }
                }
            );

            soundInstance = sound;
            set({
                currentArticleId: article.id,
                currentUrl: article.url,
                title: article.title,
                author: article.author,
                coverArt: article.coverArt,
                isPlaying: true,
                isMinimized: false,
                isPlayerVisible: true
            });
        } catch (error) {
            console.error('Error playing audio:', error);
        }
    },

    pause: async () => {
        if (soundInstance) {
            await soundInstance.pauseAsync();
            set({ isPlaying: false });
        }
    },

    resume: async () => {
        if (soundInstance) {
            await soundInstance.playAsync();
            set({ isPlaying: true });
        }
    },

    stop: async () => {
        if (soundInstance) {
            await soundInstance.stopAsync();
            await soundInstance.unloadAsync();
            soundInstance = null;
            set({ isPlaying: false, currentArticleId: null, position: 0 });
        }
    },

    seek: async (position) => {
        if (soundInstance) {
            await soundInstance.setPositionAsync(position);
            set({ position });
        }
    },

    setSpeed: async (speed) => {
        if (soundInstance) {
            await soundInstance.setRateAsync(speed, true);
        }
        set({ playbackSpeed: speed });
    },

    setVolume: async (volume) => {
        if (soundInstance) {
            await soundInstance.setVolumeAsync(volume);
        }
        set({ volume });
    },

    toggleMute: async () => {
        const newMuted = !get().isMuted;
        if (soundInstance) {
            await soundInstance.setIsMutedAsync(newMuted);
        }
        set({ isMuted: newMuted });
    },

    skipForward: async () => {
        if (soundInstance) {
            const newPos = Math.min(get().position + 30000, get().duration);
            await soundInstance.setPositionAsync(newPos);
        }
    },

    skipBackward: async () => {
        if (soundInstance) {
            const newPos = Math.max(get().position - 15000, 0);
            await soundInstance.setPositionAsync(newPos);
        }
    },

    setSleepTimer: (minutes) => {
        if (sleepTimerId) clearTimeout(sleepTimerId);

        if (minutes === null) {
            set({ sleepTimer: null });
            return;
        }

        set({ sleepTimer: minutes });
        sleepTimerId = setTimeout(() => {
            get().pause();
            set({ sleepTimer: null });
        }, minutes * 60 * 1000);
    },
    minimize: () => set({ isMinimized: true, isPlayerVisible: false }),
    restore: () => set({ isMinimized: false, isPlayerVisible: true }),
    showPlayer: () => set({ isPlayerVisible: true, isMinimized: false }),
    hidePlayer: () => set({ isPlayerVisible: false }),
}));
