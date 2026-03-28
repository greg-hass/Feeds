import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, Settings } from '@/services/api';
import { handleError } from '@/services/errorHandler';

interface SettingsState {
    settings: Settings | null;
    globalLastRefreshAt: string | null;
    globalNextRefreshAt: string | null;
    isLoading: boolean;

    fetchSettings: () => Promise<void>;
    updateSettings: (updates: Partial<Settings>) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>()(
    persist(
        (set, get) => ({
            settings: null,
            globalLastRefreshAt: null,
            globalNextRefreshAt: null,
            isLoading: false,

            fetchSettings: async () => {
                set({ isLoading: true });
                try {
                    const response = await api.getSettings();
                    set({
                        settings: response.settings,
                        globalLastRefreshAt: response.global_last_refresh_at || null,
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
                        keep_screen_awake: true,
                        reader_width: 'comfortable',
                        accent_color: 'emerald',
                        feed_fetch_limits: {
                            rss_days: 14,
                            youtube_count: 10,
                            youtube_days: 30,
                            reddit_days: 7,
                            podcast_count: 5,
                        },
                    };
                    set({ settings: fallbackSettings, isLoading: false });
                    // Silent error - settings sync failure is not actionable by user
                    handleError(error, { context: 'fetchSettings', showToast: false });
                }
            },

            updateSettings: async (updates: Partial<Settings>) => {
                const { settings, global_last_refresh_at, global_next_refresh_at } = await api.updateSettings(updates);
                set({
                    settings,
                    globalLastRefreshAt: global_last_refresh_at || null,
                    globalNextRefreshAt: global_next_refresh_at || null,
                });
            },
        }),
        {
            name: 'feeds-settings',
            storage: createJSONStorage(() => AsyncStorage),
            partialize: (state: SettingsState) => ({
                settings: state.settings,
                globalLastRefreshAt: state.globalLastRefreshAt,
                globalNextRefreshAt: state.globalNextRefreshAt,
            }),
        }
    )
);
