import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act } from '@testing-library/react';

// Mock AsyncStorage
vi.mock('@react-native-async-storage/async-storage', () => ({
    default: {
        getItem: vi.fn(),
        setItem: vi.fn(),
        removeItem: vi.fn(),
    },
}));

// Mock API
vi.mock('@/services/api', () => ({
    api: {
        getArticles: vi.fn(),
        getArticle: vi.fn(),
        getBookmarks: vi.fn(),
        markRead: vi.fn(),
        markUnread: vi.fn(),
        markAllRead: vi.fn(),
        toggleBookmark: vi.fn(),
    },
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '@/services/api';

describe('Article Store', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Reset the store state before each test
        // Note: In a real scenario, we'd need to reset the Zustand store
    });

    describe('Initial State', () => {
        it('should have correct initial state', async () => {
            const { useArticleStore } = await import('@/stores/articleStore');
            const state = useArticleStore.getState();
            
            expect(state.articles).toEqual([]);
            expect(state.bookmarkedArticles).toEqual([]);
            expect(state.currentArticle).toBeNull();
            expect(state.cursor).toBeNull();
            expect(state.hasMore).toBe(true);
            expect(state.isLoading).toBe(false);
            expect(state.error).toBeNull();
            expect(state.scrollPosition).toBe(0);
            expect(state.filter.unread_only).toBe(true);
        });
    });

    describe('setFilter', () => {
        it('should update filter and reset articles', async () => {
            const { useArticleStore } = await import('@/stores/articleStore');
            
            // Mock the API response
            (api.getArticles as any).mockResolvedValue({
                articles: [],
                next_cursor: null,
            });
            
            act(() => {
                useArticleStore.getState().setFilter({ feed_id: 1 });
            });
            
            const state = useArticleStore.getState();
            expect(state.filter.feed_id).toBe(1);
            expect(state.articles).toEqual([]);
            expect(state.cursor).toBeNull();
            expect(state.hasMore).toBe(true);
        });
    });

    describe('setScrollPosition', () => {
        it('should update scroll position', async () => {
            const { useArticleStore } = await import('@/stores/articleStore');
            
            act(() => {
                useArticleStore.getState().setScrollPosition(100);
            });
            
            expect(useArticleStore.getState().scrollPosition).toBe(100);
        });
    });

    describe('setArticleScrollPosition', () => {
        it('should store scroll position for specific article', async () => {
            const { useArticleStore } = await import('@/stores/articleStore');
            
            act(() => {
                useArticleStore.getState().setArticleScrollPosition(1, 200);
            });
            
            expect(useArticleStore.getState().articleScrollPositions[1]).toBe(200);
        });
    });

    describe('getArticleScrollPosition', () => {
        it('should return stored scroll position', async () => {
            const { useArticleStore } = await import('@/stores/articleStore');
            
            act(() => {
                useArticleStore.getState().setArticleScrollPosition(1, 200);
            });
            
            const position = useArticleStore.getState().getArticleScrollPosition(1);
            expect(position).toBe(200);
        });

        it('should return 0 for unknown article', async () => {
            const { useArticleStore } = await import('@/stores/articleStore');
            
            const position = useArticleStore.getState().getArticleScrollPosition(999);
            expect(position).toBe(0);
        });
    });

    describe('fetchArticles', () => {
        it('should fetch articles successfully', async () => {
            const { useArticleStore } = await import('@/stores/articleStore');
            
            const mockArticles = [
                { id: 1, title: 'Article 1', published_at: '2026-01-01' },
                { id: 2, title: 'Article 2', published_at: '2026-01-02' },
            ];
            
            (api.getArticles as any).mockResolvedValue({
                articles: mockArticles,
                next_cursor: 'cursor123',
            });
            
            await act(async () => {
                await useArticleStore.getState().fetchArticles(true);
            });
            
            const state = useArticleStore.getState();
            expect(state.articles).toHaveLength(2);
            expect(state.cursor).toBe('cursor123');
            expect(state.isLoading).toBe(false);
            expect(state.error).toBeNull();
        });

        it('should handle fetch error', async () => {
            const { useArticleStore } = await import('@/stores/articleStore');
            
            (api.getArticles as any).mockRejectedValue(new Error('Network error'));
            
            await act(async () => {
                await useArticleStore.getState().fetchArticles(true);
            });
            
            const state = useArticleStore.getState();
            expect(state.isLoading).toBe(false);
            expect(state.error).toBeDefined();
        });

        it('should not fetch if already loading', async () => {
            const { useArticleStore } = await import('@/stores/articleStore');
            
            // Set loading state
            act(() => {
                useArticleStore.setState({ isLoading: true });
            });
            
            await act(async () => {
                await useArticleStore.getState().fetchArticles();
            });
            
            // API should not be called
            expect(api.getArticles).not.toHaveBeenCalled();
        });
    });

    describe('fetchBookmarks', () => {
        it('should fetch bookmarked articles', async () => {
            const { useArticleStore } = await import('@/stores/articleStore');
            
            const mockBookmarks = [
                { id: 1, title: 'Bookmarked 1', is_bookmarked: true },
            ];
            
            (api.getBookmarks as any).mockResolvedValue({
                articles: mockBookmarks,
            });
            
            await act(async () => {
                await useArticleStore.getState().fetchBookmarks();
            });
            
            expect(useArticleStore.getState().bookmarkedArticles).toEqual(mockBookmarks);
        });
    });

    describe('markRead', () => {
        it('should mark article as read', async () => {
            const { useArticleStore } = await import('@/stores/articleStore');
            
            // Set up initial state with an unread article
            act(() => {
                useArticleStore.setState({
                    articles: [{ id: 1, title: 'Test', is_read: false }],
                });
            });
            
            (api.markRead as any).mockResolvedValue({ success: true });
            
            await act(async () => {
                await useArticleStore.getState().markRead(1);
            });
            
            const article = useArticleStore.getState().articles[0];
            expect(article.is_read).toBe(true);
            expect(api.markRead).toHaveBeenCalledWith(1);
        });
    });

    describe('markUnread', () => {
        it('should mark article as unread', async () => {
            const { useArticleStore } = await import('@/stores/articleStore');
            
            // Set up initial state with a read article
            act(() => {
                useArticleStore.setState({
                    articles: [{ id: 1, title: 'Test', is_read: true }],
                });
            });
            
            (api.markUnread as any).mockResolvedValue({ success: true });
            
            await act(async () => {
                await useArticleStore.getState().markUnread(1);
            });
            
            const article = useArticleStore.getState().articles[0];
            expect(article.is_read).toBe(false);
            expect(api.markUnread).toHaveBeenCalledWith(1);
        });
    });

    describe('toggleBookmark', () => {
        it('should toggle bookmark status', async () => {
            const { useArticleStore } = await import('@/stores/articleStore');
            
            // Set up initial state
            act(() => {
                useArticleStore.setState({
                    articles: [{ id: 1, title: 'Test', is_bookmarked: false }],
                });
            });
            
            (api.toggleBookmark as any).mockResolvedValue({ success: true, is_bookmarked: true });
            
            await act(async () => {
                await useArticleStore.getState().toggleBookmark(1);
            });
            
            const article = useArticleStore.getState().articles[0];
            expect(article.is_bookmarked).toBe(true);
        });
    });

    describe('clearError', () => {
        it('should clear error state', async () => {
            const { useArticleStore } = await import('@/stores/articleStore');
            
            // Set an error
            act(() => {
                useArticleStore.setState({ error: 'Some error' });
            });
            
            act(() => {
                useArticleStore.getState().clearError();
            });
            
            expect(useArticleStore.getState().error).toBeNull();
        });
    });
});
