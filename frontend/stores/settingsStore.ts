import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, Settings } from '@/services/api';
import { handleError } from '@/services/errorHandler';

interface SettingsState {
    settings: Settings | null;
    globalNextRefreshAt: string | null;
    isLoading: boolean;

    fetchSettings: () => Promise<void>;
    updateSettings: (updates: Partial<Settings>) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>()(
    persist(
        (set, get) => ({
            settings: null,
            globalNextRefreshAt: null,
            isLoading: false,

            fetchSettings: async () => {
                set({ isLoading: true });
                try {
                    const response = await api.getSettings();
                    set({
                        settings: response.settings,
                        globalNextRefreshAt: response.global_next_refresh_at || null,
                        isLoading: false
                    });
                } catch (error) {
                    // For mobile PWA: network issues are common, use fallback settings
                    // but show error so user knows sync failed
                    const fallbackSettings: Settings = {
                        refresh_interval_minutes: 15,
                        retention_days: 90,
                        fetch_full_content: false,
                        readability_enabled: false,
                        theme: 'auto',
                        font_size: 'medium',
                        show_images: true,
                        accent_color: 'emerald',
                        view_density: 'comfortable',
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
