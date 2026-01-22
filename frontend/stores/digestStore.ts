import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '@/services/api';
import { handleError } from '@/services/errorHandler';
import { useToastStore } from './toastStore';

interface DigestStore {
    latestDigest: any | null;
    pendingDigest: any | null;
    settings: any | null;
    isLoading: boolean;
    error: string | null;

    fetchLatestDigest: () => Promise<void>;
    fetchPendingDigest: () => Promise<void>;
    dismissDigest: (id: number) => Promise<void>;
    generateDigest: () => Promise<void>;
    fetchSettings: () => Promise<void>;
    updateSettings: (updates: any) => Promise<void>;
}

export const useDigestStore = create<DigestStore>()(
    persist(
        (set, get) => ({
            latestDigest: null,
            pendingDigest: null,
            settings: null,
            isLoading: false,
            error: null,

            fetchLatestDigest: async () => {
                set({ isLoading: true, error: null });
                try {
                    const { digest } = await api.getLatestDigest();
                    set({ latestDigest: digest, isLoading: false });
                } catch (error) {
                    handleError(error, { context: 'fetchLatestDigest', showToast: false });
                    set({ isLoading: false });
                }
            },

            fetchPendingDigest: async () => {
                try {
                    const { digest } = await api.getPendingDigest();
                    set({ pendingDigest: digest });
                } catch (error) {
                    // Silent fail for background check
                }
            },

            dismissDigest: async (id: number) => {
                try {
                    await api.dismissDigest(id);
                    set({ pendingDigest: null });
                } catch (error) {
                    handleError(error, { context: 'dismissDigest' });
                }
            },

            generateDigest: async () => {
                set({ isLoading: true, error: null });
                try {
                    const { digest } = await api.generateDigest();
                    set({ latestDigest: digest, pendingDigest: digest, isLoading: false });
                    useToastStore.getState().show('Digest generated successfully!', 'success');
                } catch (error) {
                    const parsed = handleError(error, { context: 'generateDigest' });
                    set({ isLoading: false, error: parsed.message });
                }
            },

            fetchSettings: async () => {
                try {
                    const { settings } = await api.getDigestSettings();
                    set({ settings });
                } catch (error) {
                    handleError(error, { context: 'fetchDigestSettings', showToast: false });
                }
            },

            updateSettings: async (updates) => {
                try {
                    await api.updateDigestSettings(updates);
                    set((state) => ({ settings: { ...state.settings, ...updates } }));
                    useToastStore.getState().show('Settings saved', 'success');
                } catch (error) {
                    handleError(error, { context: 'updateDigestSettings' });
                }
            },
        }),
        {
            name: 'feeds-digest',
            storage: createJSONStorage(() => AsyncStorage),
        }
    )
);
