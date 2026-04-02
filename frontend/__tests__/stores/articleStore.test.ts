import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act } from '@testing-library/react';
import { api } from '@/services/api';
import type { Article } from '@/services/api';

// Mock API
vi.mock('@/services/api', () => ({
    ApiError: class ApiError extends Error {
        status: number;
        constructor(message: string, status: number) {
            super(message);
            this.status = status;
        }
    },
    api: {
        getArticles: vi.fn(),
        getArticle: vi.fn(),
        getBookmarks: vi.fn(),
        markArticleRead: vi.fn(),
        markArticleUnread: vi.fn(),
        markArticlesRead: vi.fn(),
        bookmarkArticle: vi.fn(),
    },
}));

// Mock AsyncStorage
vi.mock('@react-native-async-storage/async-storage', () => ({
    default: {
        getItem: vi.fn(),
        setItem: vi.fn(),
        removeItem: vi.fn(),
    },
}));

const buildArticle = (overrides: Partial<Article> = {}): Article => ({
    id: 1,
    feed_id: 1,
    feed_title: 'Test Feed',
    feed_icon_url: null,
    feed_type: 'rss',
    title: 'Test Article',
    url: 'https://example.com/article',
    author: null,
    summary: null,
    published_at: '2026-01-01T00:00:00.000Z',
    is_read: false,
    is_bookmarked: false,
    has_audio: false,
    enclosure_url: null,
    ...overrides,
});

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
            expect(state.timelineScrollSnapshots).toEqual({});
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

    describe('timeline scroll snapshots', () => {
        it('should persist timeline snapshots by key', async () => {
            const { useArticleStore } = await import('@/stores/articleStore');

            act(() => {
                useArticleStore.getState().setTimelineScrollSnapshot('timeline:all', {
                    absoluteOffset: 180,
                    anchorArticleId: 42,
                    restoreArticleId: 42,
                    restoreFallbackArticleId: 43,
                });
            });

            expect(useArticleStore.getState().timelineScrollSnapshots['timeline:all']).toEqual({
                absoluteOffset: 180,
                anchorArticleId: 42,
                restoreArticleId: 42,
                restoreFallbackArticleId: 43,
            });
        });

        it('should return a default snapshot for unknown keys', async () => {
            const { useArticleStore } = await import('@/stores/articleStore');

            expect(useArticleStore.getState().getTimelineScrollSnapshot('missing')).toEqual({
                absoluteOffset: 0,
                anchorArticleId: null,
                restoreArticleId: null,
                restoreFallbackArticleId: null,
            });
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

        it('should keep newest articles at the top during live updates', async () => {
            const { useArticleStore } = await import('@/stores/articleStore');

            act(() => {
                useArticleStore.setState({
                    articles: [
                        buildArticle({ id: 1, title: 'Older' }),
                    ],
                    isLoading: false,
                });
            });

            (api.getArticles as any).mockResolvedValue({
                articles: [
                    buildArticle({ id: 2, title: 'Newest', published_at: '2026-01-02T00:00:00.000Z' }),
                    buildArticle({ id: 1, title: 'Older' }),
                ],
                next_cursor: null,
            });

            await act(async () => {
                await useArticleStore.getState().fetchArticles(true, true);
            });

            expect(useArticleStore.getState().articles.map((article: any) => article.id)).toEqual([2, 1]);
        });

        it('should preserve article identity for unchanged live updates', async () => {
            const { useArticleStore } = await import('@/stores/articleStore');

            const existingArticle = buildArticle({ id: 7, title: 'Stable article' });

            act(() => {
                useArticleStore.setState({
                    articles: [existingArticle],
                    isLoading: false,
                });
            });

            (api.getArticles as any).mockResolvedValue({
                articles: [{ ...existingArticle }],
                next_cursor: null,
            });

            await act(async () => {
                await useArticleStore.getState().fetchArticles(true, true);
            });

            expect(useArticleStore.getState().articles[0]).toBe(existingArticle);
        });

        it('should append the next page using the saved cursor and stop when exhausted', async () => {
            const { useArticleStore } = await import('@/stores/articleStore');

            (api.getArticles as any)
                .mockResolvedValueOnce({
                    articles: [
                        buildArticle({ id: 10, title: 'Newest', published_at: '2026-01-03T00:00:00.000Z' }),
                        buildArticle({ id: 9, title: 'Older', published_at: '2026-01-02T00:00:00.000Z' }),
                    ],
                    next_cursor: 'cursor-page-2',
                })
                .mockResolvedValueOnce({
                    articles: [
                        buildArticle({ id: 8, title: 'Oldest', published_at: '2026-01-01T00:00:00.000Z' }),
                    ],
                    next_cursor: null,
                });

            await act(async () => {
                await useArticleStore.getState().fetchArticles(true);
            });

            await act(async () => {
                await useArticleStore.getState().fetchArticles();
            });

            expect(api.getArticles).toHaveBeenNthCalledWith(1, expect.objectContaining({
                cursor: undefined,
                limit: 50,
            }));
            expect(api.getArticles).toHaveBeenNthCalledWith(2, expect.objectContaining({
                cursor: 'cursor-page-2',
                limit: 50,
            }));
            expect(useArticleStore.getState().articles.map((article: any) => article.id)).toEqual([10, 9, 8]);
            expect(useArticleStore.getState().hasMore).toBe(false);
            expect(useArticleStore.getState().cursor).toBeNull();
        });
    });

    describe('fetchBookmarks', () => {
        it('should fetch bookmarked articles', async () => {
            const { useArticleStore } = await import('@/stores/articleStore');
            
            const mockBookmarks = [
                buildArticle({ id: 1, title: 'Bookmarked 1', is_bookmarked: true }),
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
                    articles: [buildArticle({ id: 1, title: 'Test', is_read: false })],
                });
            });
            
            (api.markArticleRead as any).mockResolvedValue({ success: true });
            
            await act(async () => {
                await useArticleStore.getState().markRead(1);
            });
            
            const article = useArticleStore.getState().articles[0];
            expect(article.is_read).toBe(true);
            expect(api.markArticleRead).toHaveBeenCalledWith(1);
        });
    });

    describe('markUnread', () => {
        it('should mark article as unread', async () => {
            const { useArticleStore } = await import('@/stores/articleStore');
            
            // Set up initial state with a read article
            act(() => {
                useArticleStore.setState({
                    articles: [buildArticle({ id: 1, title: 'Test', is_read: true })],
                });
            });
            
            (api.markArticleUnread as any).mockResolvedValue({ success: true });
            
            await act(async () => {
                await useArticleStore.getState().markUnread(1);
            });
            
            const article = useArticleStore.getState().articles[0];
            expect(article.is_read).toBe(false);
            expect(api.markArticleUnread).toHaveBeenCalledWith(1);
        });
    });

    describe('toggleBookmark', () => {
        it('should toggle bookmark status', async () => {
            const { useArticleStore } = await import('@/stores/articleStore');
            
            // Set up initial state
            act(() => {
                useArticleStore.setState({
                    articles: [buildArticle({ id: 1, title: 'Test', is_bookmarked: false })],
                });
            });
            
            (api.bookmarkArticle as any).mockResolvedValue({ success: true });
            
            await act(async () => {
                await useArticleStore.getState().toggleBookmark(1);
            });
            
            const article = useArticleStore.getState().articles[0];
            expect(article.is_bookmarked).toBe(true);
            expect(api.bookmarkArticle).toHaveBeenCalledWith(1, true);
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

    describe('applySyncChanges', () => {
        it('should merge created articles newest-first without duplicates', async () => {
            const { useArticleStore } = await import('@/stores/articleStore');

            act(() => {
                useArticleStore.setState({
                    articles: [
                        buildArticle({ id: 1, title: 'Existing' }),
                    ],
                    filter: { unread_only: true },
                });
            });

            act(() => {
                useArticleStore.getState().applySyncChanges({
                    articles: {
                        created: [
                            buildArticle({ id: 2, title: 'Newest', published_at: '2026-01-02T00:00:00.000Z' }),
                            buildArticle({ id: 1, title: 'Existing' }),
                        ],
                        updated: [],
                        deleted: [],
                    },
                });
            });

            expect(useArticleStore.getState().articles.map((article: any) => article.id)).toEqual([2, 1]);
        });
    });
});
