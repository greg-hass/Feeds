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
                    set({ isLoading: false });
                }
            },

            login: async (username, password) => {
                const { user, token } = await api.login(username, password);
                api.setToken(token);
                set({ user, token, isAuthenticated: true, setupRequired: false });
            },

            setup: async (username, password, baseUrl) => {
                const { user, token } = await api.setup(username, password, baseUrl);
                api.setToken(token);
                set({ user, token, isAuthenticated: true, setupRequired: false });
            },

            logout: () => {
                api.setToken(null);
                set({ user: null, token: null, isAuthenticated: false });
            },

            setToken: (token) => {
                api.setToken(token);
                set({ token });
            },
        }),
        {
            name: 'feeds-auth',
            storage: createJSONStorage(() => AsyncStorage),
            partialize: (state) => ({ token: state.token }),
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
    addFeed: (url: string, folderId?: number) => Promise<Feed>;
    deleteFeed: (id: number) => Promise<void>;
    refreshFeed: (id: number) => Promise<number>;
    updateLocalFeed: (id: number, updates: Partial<Feed>) => void;
}

export const useFeedStore = create<FeedState>((set, get) => ({
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
            throw error;
        }
    },

    fetchFolders: async () => {
        try {
            const { folders, smart_folders, totals } = await api.getFolders();
            set({ folders, smartFolders: smart_folders, totalUnread: totals.all_unread });
        } catch (error) {
            throw error;
        }
    },

    addFeed: async (url, folderId) => {
        const result = await api.addFeed(url, folderId);
        set((state) => ({ feeds: [...state.feeds, result.feed] }));
        return result.feed;
    },

    deleteFeed: async (id) => {
        await api.deleteFeed(id);
        set((state) => ({ feeds: state.feeds.filter((f) => f.id !== id) }));
    },

    refreshFeed: async (id) => {
        const result = await api.refreshFeed(id);
        // Refetch feeds to update unread counts
        get().fetchFeeds();
        return result.new_articles;
    },

    updateLocalFeed: (id, updates) => {
        set((state) => ({
            feeds: state.feeds.map((f) => (f.id === id ? { ...f, ...updates } : f)),
        }));
    },
}));

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

export const useArticleStore = create<ArticleState>((set, get) => ({
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
            throw error;
        }
    },

    fetchArticle: async (id) => {
        const { article } = await api.getArticle(id);
        set({ currentArticle: article });
        // Update in list too
        set((state) => ({
            articles: state.articles.map((a) =>
                a.id === id ? { ...a, is_read: true } : a
            ),
        }));
    },

    markRead: async (id) => {
        await api.markArticleRead(id);
        set((state) => ({
            articles: state.articles.map((a) =>
                a.id === id ? { ...a, is_read: true } : a
            ),
        }));
    },

    markUnread: async (id) => {
        await api.markArticleUnread(id);
        set((state) => ({
            articles: state.articles.map((a) =>
                a.id === id ? { ...a, is_read: false } : a
            ),
        }));
    },

    markAllRead: async (scope, scopeId, type) => {
        await api.markArticlesRead({ scope, scope_id: scopeId, type });
        // Refetch articles with current filter
        get().fetchArticles(true);
        // Also refetch folders to update unread counts
        useFeedStore.getState().fetchFolders();
        useFeedStore.getState().fetchFeeds();
    },
}));

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

    updateSettings: async (updates) => {
        const { settings } = await api.updateSettings(updates);
        set({ settings });
    },
}));
