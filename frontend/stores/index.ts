import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, User, Feed, Folder, SmartFolder, Article, Settings } from '@/services/api';

interface AuthState {
    user: User | null;
    token: string | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    setupRequired: boolean;

    checkAuthStatus: () => Promise<void>;
    login: (username: string, password: string) => Promise<void>;
    setup: (username: string, password: string, baseUrl?: string) => Promise<void>;
    logout: () => void;
    setToken: (token: string) => void;
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set, get) => ({
            user: null,
            token: null,
            isAuthenticated: false,
            isLoading: true,
            setupRequired: false,

            checkAuthStatus: async () => {
                set({ isLoading: true });
                try {
                    const { setup_required } = await api.getAuthStatus();
                    set({ setupRequired: setup_required, isLoading: false });

                    const token = get().token;
                    if (token && !setup_required) {
                        api.setToken(token);
                        try {
                            const { user } = await api.getCurrentUser();
                            set({ user, isAuthenticated: true });
                        } catch {
                            set({ token: null, isAuthenticated: false });
                            api.setToken(null);
                        }
                    }
                } catch (error) {
                    // If we can't reach the API, assume setup hasn't completed
                    // (this handles the case where backend hasn't started yet)
                    console.error('Auth status check failed:', error);
                    set({ isLoading: false, setupRequired: true });
                }
            },

            login: async (username: string, password: string) => {
                const { user, token } = await api.login(username, password);
                api.setToken(token);
                set({ user, token, isAuthenticated: true, setupRequired: false });
            },

            setup: async (username: string, password: string, baseUrl?: string) => {
                const { user, token } = await api.setup(username, password, baseUrl);
                api.setToken(token);
                set({ user, token, isAuthenticated: true, setupRequired: false });
            },

            logout: () => {
                api.setToken(null);
                set({ user: null, token: null, isAuthenticated: false });
            },

            setToken: (token: string) => {
                api.setToken(token);
                set({ token });
            },
        }),
        {
            name: 'feeds-auth',
            storage: createJSONStorage(() => AsyncStorage),
            partialize: (state: AuthState) => ({ token: state.token }),
        }
    )
);

// Feed Store
interface FeedState {
    feeds: Feed[];
    folders: Folder[];
    smartFolders: SmartFolder[];
    totalUnread: number;
    isLoading: boolean;

    fetchFeeds: () => Promise<void>;
    fetchFolders: () => Promise<void>;
    addFeed: (url: string, folderId?: number, refreshInterval?: number) => Promise<Feed>;
    deleteFeed: (id: number) => Promise<void>;
    refreshFeed: (id: number) => Promise<number>;
    updateLocalFeed: (id: number, updates: Partial<Feed>) => void;
}

export const useFeedStore = create<FeedState>()(
    persist(
        (set, get) => ({
            feeds: [],
            folders: [],
            smartFolders: [],
            totalUnread: 0,
            isLoading: false,

            fetchFeeds: async () => {
                set({ isLoading: true });
                try {
                    const { feeds } = await api.getFeeds();
                    set({ feeds, isLoading: false });
                } catch (error) {
                    set({ isLoading: false });
                    // If offline, we just keep the existing data
                }
            },

            fetchFolders: async () => {
                set({ isLoading: true });
                try {
                    const { folders, smart_folders, totals } = await api.getFolders();
                    set({ folders, smartFolders: smart_folders, totalUnread: totals.all_unread, isLoading: false });
                } catch (error) {
                    set({ isLoading: false });
                }
            },

            addFeed: async (url: string, folderId?: number, refreshInterval?: number) => {
                const result = await api.addFeed(url, folderId, true, refreshInterval);
                set((state: FeedState) => ({ feeds: [...state.feeds, result.feed] }));
                return result.feed;
            },

            deleteFeed: async (id) => {
                await api.deleteFeed(id);
                set((state) => ({ feeds: state.feeds.filter((f) => f.id !== id) }));
            },

            refreshFeed: async (id) => {
                const result = await api.refreshFeed(id);
                get().fetchFeeds();
                return result.new_articles;
            },

            updateLocalFeed: (id, updates) => {
                set((state) => ({
                    feeds: state.feeds.map((f) => (f.id === id ? { ...f, ...updates } : f)),
                }));
            },
        }),
        {
            name: 'feeds-list',
            storage: createJSONStorage(() => AsyncStorage),
            partialize: (state: FeedState) => ({
                feeds: state.feeds,
                folders: state.folders,
                smartFolders: state.smartFolders,
                totalUnread: state.totalUnread
            }),
        }
    )
);

// Article Store
interface ArticleState {
    articles: Article[];
    currentArticle: Article | null;
    cursor: string | null;
    hasMore: boolean;
    isLoading: boolean;
    filter: {
        feed_id?: number;
        folder_id?: number;
        type?: string;
        unread_only: boolean;
    };

    setFilter: (filter: Partial<ArticleState['filter']>) => void;
    fetchArticles: (reset?: boolean) => Promise<void>;
    fetchArticle: (id: number) => Promise<void>;
    markRead: (id: number) => Promise<void>;
    markUnread: (id: number) => Promise<void>;
    markAllRead: (scope: 'feed' | 'folder' | 'type' | 'all', scopeId?: number, type?: string) => Promise<void>;
}

export const useArticleStore = create<ArticleState>()(
    persist(
        (set, get) => ({
            articles: [],
            currentArticle: null,
            cursor: null,
            hasMore: true,
            isLoading: false,
            filter: {
                unread_only: true,
            },

            setFilter: (newFilter) => {
                set((state) => ({
                    filter: { ...state.filter, ...newFilter },
                    articles: [],
                    cursor: null,
                    hasMore: true,
                }));
                get().fetchArticles(true);
            },

            fetchArticles: async (reset = false) => {
                const state = get();
                if (state.isLoading || (!reset && !state.hasMore)) return;

                set({ isLoading: true });
                try {
                    const { articles, next_cursor } = await api.getArticles({
                        ...state.filter,
                        cursor: reset ? undefined : state.cursor || undefined,
                        limit: 50,
                    });

                    set({
                        articles: reset ? articles : [...state.articles, ...articles],
                        cursor: next_cursor,
                        hasMore: next_cursor !== null,
                        isLoading: false,
                    });
                } catch (error) {
                    set({ isLoading: false });
                    // Fallback to cached articles if reset=true and network fails
                }
            },

            fetchArticle: async (id) => {
                try {
                    const { article } = await api.getArticle(id);
                    set({ currentArticle: article });
                } catch (error) {
                    // Try to find in existing articles list
                    const found = get().articles.find(a => a.id === id);
                    if (found) set({ currentArticle: found });
                }

                // Update in list too
                set((state) => ({
                    articles: state.articles.map((a) =>
                        a.id === id ? { ...a, is_read: true } : a
                    ),
                }));
            },

            markRead: async (id) => {
                try {
                    await api.markArticleRead(id);
                } catch (e) { /* ignore offline and hope for sync later */ }
                set((state) => ({
                    articles: state.articles.map((a) =>
                        a.id === id ? { ...a, is_read: true } : a
                    ),
                }));
            },

            markUnread: async (id) => {
                try {
                    await api.markArticleUnread(id);
                } catch (e) { /* ignore */ }
                set((state) => ({
                    articles: state.articles.map((a) =>
                        a.id === id ? { ...a, is_read: false } : a
                    ),
                }));
            },

            markAllRead: async (scope, scopeId, type) => {
                await api.markArticlesRead({ scope, scope_id: scopeId, type });
                get().fetchArticles(true);
                useFeedStore.getState().fetchFolders();
                useFeedStore.getState().fetchFeeds();
            },
        }),
        {
            name: 'articles-cache',
            storage: createJSONStorage(() => AsyncStorage),
            partialize: (state: ArticleState) => ({
                articles: state.articles.slice(0, 100), // Only cache the first 100 articles
                cursor: state.cursor,
                filter: state.filter
            }),
        }
    )
);

// Settings Store
interface SettingsState {
    settings: Settings | null;
    isLoading: boolean;

    fetchSettings: () => Promise<void>;
    updateSettings: (updates: Partial<Settings>) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set) => ({
    settings: null,
    isLoading: false,

    fetchSettings: async () => {
        set({ isLoading: true });
        try {
            const { settings } = await api.getSettings();
            set({ settings, isLoading: false });
        } catch (error) {
            set({ isLoading: false });
            throw error;
        }
    },

    updateSettings: async (updates: Partial<Settings>) => {
        try {
            console.log('Updating settings with:', updates);
            const { settings } = await api.updateSettings(updates);
            console.log('Settings updated successfully:', settings);
            set({ settings });
        } catch (error) {
            console.error('Failed to update settings:', error);
            throw error;
        }
    },
}));

// Toast Store
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

