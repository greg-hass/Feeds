import { create } from 'zustand';
import { api } from '@/services/api';
import { handleError } from '@/services/errorHandler';

// ============================================================================
// TYPES
// ============================================================================

export interface DailyStats {
    date: string;
    articles_read: number;
    total_read_time_seconds: number;
    sessions_count: number;
}

export interface FeedEngagement {
    feed_id: number;
    title: string;
    type: string;
    total_articles_read: number;
    total_read_time_seconds: number;
    avg_read_time_seconds: number;
    engagement_score: number;
    articles_completed: number;
    last_engagement_at: string | null;
}

export interface TopArticle {
    article_id: number;
    title: string;
    feed_title: string;
    total_read_time_seconds: number;
    read_count: number;
    avg_scroll_depth: number;
    completion_rate: number;
}

export interface AnalyticsOverview {
    total_articles_read: number;
    total_reading_time_seconds: number;
    average_session_duration: number;
    articles_this_week: number;
    reading_streak_days: number;
    top_feeds: Array<{ feed_id: number; feed_title: string; articles_read: number }>;
    reading_by_day: DailyStats[];
    top_reading_hours: number[];
}

export interface HourlyStats {
    hour: number;
    total_time: number;
    session_count: number;
}

export interface DayOfWeekStats {
    day_of_week: number;
    day_name: string;
    total_time: number;
    articles_read: number;
}

export interface TopicDistribution {
    tag: string;
    count: number;
}

// ============================================================================
// STORE
// ============================================================================

interface AnalyticsState {
    overview: AnalyticsOverview | null;
    topFeeds: FeedEngagement[];
    topArticles: TopArticle[];
    dailyStats: DailyStats[];
    hourlyStats: HourlyStats[];
    dayOfWeekStats: DayOfWeekStats[];
    topicDistribution: TopicDistribution[];
    isLoading: boolean;

    fetchOverview: () => Promise<void>;
    fetchTopFeeds: (limit?: number) => Promise<void>;
    fetchTopArticles: (limit?: number) => Promise<void>;
    fetchDailyStats: (days?: number) => Promise<void>;
    fetchHourlyStats: () => Promise<void>;
    fetchDayOfWeekStats: () => Promise<void>;
    fetchTopicDistribution: (limit?: number) => Promise<void>;
    fetchAll: () => Promise<void>;
    exportData: () => Promise<any>;
}

export const useAnalyticsStore = create<AnalyticsState>((set, get) => ({
    overview: null,
    topFeeds: [],
    topArticles: [],
    dailyStats: [],
    hourlyStats: [],
    dayOfWeekStats: [],
    topicDistribution: [],
    isLoading: false,

    fetchOverview: async () => {
        try {
            const overview = await api.get<AnalyticsOverview>('/analytics/overview');
            set({ overview });
        } catch (error) {
            handleError(error, { context: 'fetchAnalyticsOverview' });
        }
    },

    fetchTopFeeds: async (limit = 10) => {
        try {
            const response = await api.get<{ feeds: FeedEngagement[] }>(
                `/analytics/feeds/top?limit=${limit}`
            );
            set({ topFeeds: response.feeds });
        } catch (error) {
            handleError(error, { context: 'fetchTopFeeds' });
        }
    },

    fetchTopArticles: async (limit = 10) => {
        try {
            const response = await api.get<{ articles: TopArticle[] }>(
                `/analytics/articles/top?limit=${limit}`
            );
            set({ topArticles: response.articles });
        } catch (error) {
            handleError(error, { context: 'fetchTopArticles' });
        }
    },

    fetchDailyStats: async (days = 30) => {
        try {
            const response = await api.get<{ stats: DailyStats[] }>(
                `/analytics/daily/recent?days=${days}`
            );
            set({ dailyStats: response.stats });
        } catch (error) {
            handleError(error, { context: 'fetchDailyStats' });
        }
    },

    fetchHourlyStats: async () => {
        try {
            const response = await api.get<{ stats: HourlyStats[] }>(
                '/analytics/reading-time/by-hour'
            );
            set({ hourlyStats: response.stats });
        } catch (error) {
            handleError(error, { context: 'fetchHourlyStats' });
        }
    },

    fetchDayOfWeekStats: async () => {
        try {
            const response = await api.get<{ stats: DayOfWeekStats[] }>(
                '/analytics/reading-time/by-day-of-week'
            );
            set({ dayOfWeekStats: response.stats });
        } catch (error) {
            handleError(error, { context: 'fetchDayOfWeekStats' });
        }
    },

    fetchTopicDistribution: async (limit = 10) => {
        try {
            const response = await api.get<{ topics: TopicDistribution[] }>(
                `/analytics/topics?limit=${limit}`
            );
            set({ topicDistribution: response.topics });
        } catch (error) {
            handleError(error, { context: 'fetchTopicDistribution' });
        }
    },

    fetchAll: async () => {
        set({ isLoading: true });
        try {
            await Promise.all([
                get().fetchOverview(),
                get().fetchTopFeeds(),
                get().fetchTopArticles(20),
                get().fetchDailyStats(30),
                get().fetchHourlyStats(),
                get().fetchDayOfWeekStats(),
                get().fetchTopicDistribution(15),
            ]);
        } finally {
            set({ isLoading: false });
        }
    },

    exportData: async () => {
        try {
            const data = await api.get('/analytics/export');
            return data;
        } catch (error) {
            handleError(error, { context: 'exportAnalytics' });
            throw error;
        }
    },
}));

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Format seconds to human-readable time
 */
export function formatReadingTime(seconds: number): string {
    if (seconds < 60) {
        return `${Math.round(seconds)}s`;
    } else if (seconds < 3600) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.round(seconds % 60);
        return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
    } else {
        const hours = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
    }
}

/**
 * Format engagement score as percentage
 */
export function formatEngagementScore(score: number): string {
    return `${Math.round(score * 100)}%`;
}

/**
 * Get color for engagement score
 */
export function getEngagementColor(score: number): string {
    if (score >= 0.7) return '#10b981'; // green
    if (score >= 0.4) return '#f59e0b'; // amber
    return '#ef4444'; // red
}
