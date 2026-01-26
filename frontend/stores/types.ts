import { Feed, Folder, SmartFolder, Article, ArticleDetail, Settings } from '@/services/api';
import { SyncChanges } from '@/lib/sync';

export interface FeedState {
    feeds: Feed[];
    folders: Folder[];
    smartFolders: SmartFolder[];
    totalUnread: number;
    isLoading: boolean;
    isBackgroundRefreshing: boolean;
    refreshProgress: { total: number; completed: number; currentTitle: string } | null;
    lastRefreshNewArticles: number | null;

    fetchFeeds: () => Promise<void>;
    fetchFolders: () => Promise<void>;
    addFeed: (url: string, folderId?: number, refreshInterval?: number, discover?: boolean) => Promise<Feed>;
    deleteFeed: (id: number) => Promise<void>;
    deleteFolder: (id: number) => Promise<void>;
    refreshFeed: (id: number) => Promise<number>;
    cancelRefresh: () => void;
    updateFeed: (id: number, updates: Partial<Feed>) => Promise<void>;
    pauseFeed: (id: number) => Promise<void>;
    resumeFeed: (id: number) => Promise<void>;
    updateLocalFeed: (id: number, updates: Partial<Feed>) => void;
    applySyncChanges: (changes: SyncChanges, isRefreshing?: boolean) => void;
    
    // Simplified setters for useFeedRefresh hook
    setIsLoading: (loading: boolean) => void;
    setRefreshProgress: (progress: { total: number; completed: number; currentTitle: string } | null) => void;
    setLastRefreshNewArticles: (count: number | null) => void;
    updateLocalFeeds: (updater: (feeds: Feed[]) => Feed[]) => void;
}

export interface ArticleState {
    articles: Article[];
    bookmarkedArticles: Article[];
    currentArticle: ArticleDetail | null;
    contentCache: Record<number, ArticleDetail>;
    cursor: string | null;
    hasMore: boolean;
    isLoading: boolean;
    error: string | null;
    scrollPosition: number;
    articleScrollPositions: Record<number, number>;
    filter: {
        feed_id?: number;
        folder_id?: number;
        type?: string;
        unread_only: boolean;
    };

    setFilter: (filter: Partial<ArticleState['filter']>) => void;
    setScrollPosition: (position: number) => void;
    setArticleScrollPosition: (articleId: number, position: number) => void;
    getArticleScrollPosition: (articleId: number) => number;
    fetchArticles: (reset?: boolean, isLiveUpdate?: boolean) => Promise<void>;
    fetchBookmarks: () => Promise<void>;
    fetchArticle: (id: number) => Promise<void>;
    prefetchArticle: (id: number) => Promise<void>;
    markRead: (id: number) => Promise<void>;
    markUnread: (id: number) => Promise<void>;
    markAllRead: (scope: 'feed' | 'folder' | 'type' | 'all', scopeId?: number, type?: string) => Promise<void>;
    toggleBookmark: (id: number) => Promise<void>;
    updateFeedMetadata: (feedId: number, updates: { feed_title?: string; feed_icon_url?: string | null; feed_type?: string }) => void;
    clearError: () => void;
    applySyncChanges: (changes: SyncChanges) => void;
}

export interface SettingsState {
    settings: Settings | null;
    isLoading: boolean;

    fetchSettings: () => Promise<void>;
    updateSettings: (updates: Partial<Settings>) => Promise<void>;
}

export interface DigestStore {
    latestDigest: any | null;
    settings: any | null;
    isLoading: boolean;
    error: string | null;

    fetchLatestDigest: () => Promise<void>;
    generateDigest: () => Promise<void>;
    fetchSettings: () => Promise<void>;
    updateSettings: (updates: any) => Promise<void>;
}
