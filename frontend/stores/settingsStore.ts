import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, Settings } from '@/services/api';
import { handleError } from '@/services/errorHandler';

interface SettingsState {
    settings: Settings | null;
    isLoading: boolean;

    fetchSettings: () => Promise<void>;
    updateSettings: (updates: Partial<Settings>) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>()(
    persist(
        (set, get) => ({
            settings: null,
            isLoading: false,

            fetchSettings: async () => {
                set({ isLoading: true });
                try {
                    const { settings } = await api.getSettings();
                    set({ settings, isLoading: false });
                } catch (error) {
                    // For mobile PWA: network issues are common, use fallback settings
                    // but show error so user knows sync failed
                    const fallbackSettings: Settings = {
                        refresh_interval_minutes: 30,
                        retention_days: 90,
                        fetch_full_content: false,
                        readability_enabled: false,
                        theme: 'auto',
                        font_size: 'medium',
                        show_images: true,
                    };
                    set({ settings: fallbackSettings, isLoading: false });
                    handleError(error, { context: 'fetchSettings', fallbackMessage: 'Using offline settings' });
                }
            },

            updateSettings: async (updates: Partial<Settings>) => {
                const { settings } = await api.updateSettings(updates);
                set({ settings });
            },
        }),
        {
            name: 'feeds-settings',
            storage: createJSONStorage(() => AsyncStorage),
            partialize: (state: SettingsState) => ({
                settings: state.settings,
            }),
        }
    )
);
