import { describe, it, expect, beforeEach, vi } from 'vitest';

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
        getFeeds: vi.fn(),
        getFolders: vi.fn(),
        addFeed: vi.fn(),
        deleteFeed: vi.fn(),
        refreshFeed: vi.fn(),
        updateFeed: vi.fn(),
        pauseFeed: vi.fn(),
        resumeFeed: vi.fn(),
    },
}));

import { api } from '@/services/api';

describe('Feed Store', () => {
    let useFeedStore: any;

    beforeEach(async () => {
        vi.clearAllMocks();
        // Import the store fresh for each test
        const module = await import('@/stores/feedStore');
        useFeedStore = module.useFeedStore;
    });

    describe('Initial State', () => {
        it('should have correct initial state', async () => {
            const state = useFeedStore.getState();
            
            expect(state.feeds).toEqual([]);
            expect(state.folders).toEqual([]);
            expect(state.smartFolders).toEqual([]);
            expect(state.totalUnread).toBe(0);
            expect(state.isLoading).toBe(false);
            expect(state.isBackgroundRefreshing).toBe(false);
            expect(state.refreshProgress).toBeNull();
            expect(state.lastRefreshNewArticles).toBeNull();
        });
    });

    describe('fetchFeeds', () => {
        it('should fetch feeds successfully', async () => {
            const mockFeeds = [
                { id: 1, title: 'Feed 1', url: 'https://example.com/feed1', unread_count: 5 },
                { id: 2, title: 'Feed 2', url: 'https://example.com/feed2', unread_count: 3 },
            ];
            
            (api.getFeeds as any).mockResolvedValue({ feeds: mockFeeds });
            
            await useFeedStore.getState().fetchFeeds();
            
            const state = useFeedStore.getState();
            expect(state.feeds).toEqual(mockFeeds);
            expect(state.isLoading).toBe(false);
            expect(api.getFeeds).toHaveBeenCalled();
        });

        it('should handle fetch error', async () => {
            (api.getFeeds as any).mockRejectedValue(new Error('Network error'));
            
            await useFeedStore.getState().fetchFeeds();
            
            const state = useFeedStore.getState();
            expect(state.isLoading).toBe(false);
            expect(state.feeds).toEqual([]);
        });
    });

    describe('fetchFolders', () => {
        it('should fetch folders successfully', async () => {
            const mockFolders = [
                { id: 1, name: 'Tech' },
                { id: 2, name: 'News' },
            ];
            
            (api.getFolders as any).mockResolvedValue({ folders: mockFolders });
            
            await useFeedStore.getState().fetchFolders();
            
            const state = useFeedStore.getState();
            expect(state.folders).toEqual(mockFolders);
            expect(api.getFolders).toHaveBeenCalled();
        });
    });

    describe('addFeed', () => {
        it('should add feed successfully', async () => {
            const newFeed = { id: 3, title: 'New Feed', url: 'https://example.com/new' };
            (api.addFeed as any).mockResolvedValue({ feed: newFeed });
            
            const result = await useFeedStore.getState().addFeed('https://example.com/new');
            
            expect(result).toEqual(newFeed);
            expect(api.addFeed).toHaveBeenCalledWith('https://example.com/new', undefined, undefined, true);
        });
    });

    describe('deleteFeed', () => {
        it('should delete feed successfully', async () => {
            // Set up initial state
            useFeedStore.setState({
                feeds: [
                    { id: 1, title: 'Feed 1', url: 'https://example.com/feed1' },
                    { id: 2, title: 'Feed 2', url: 'https://example.com/feed2' },
                ],
            });
            
            (api.deleteFeed as any).mockResolvedValue({ success: true });
            
            await useFeedStore.getState().deleteFeed(1);
            
            const state = useFeedStore.getState();
            expect(state.feeds).toHaveLength(1);
            expect(state.feeds[0].id).toBe(2);
            expect(api.deleteFeed).toHaveBeenCalledWith(1);
        });
    });

    describe('refreshFeed', () => {
        it('should refresh feed successfully', async () => {
            (api.refreshFeed as any).mockResolvedValue({ new_articles: 5 });
            
            const newArticles = await useFeedStore.getState().refreshFeed(1);
            
            expect(newArticles).toBe(5);
            expect(api.refreshFeed).toHaveBeenCalledWith(1);
        });
    });

    describe('setIsLoading', () => {
        it('should set loading state', () => {
            useFeedStore.getState().setIsLoading(true);
            expect(useFeedStore.getState().isLoading).toBe(true);
            
            useFeedStore.getState().setIsLoading(false);
            expect(useFeedStore.getState().isLoading).toBe(false);
        });
    });

    describe('setRefreshProgress', () => {
        it('should set refresh progress', () => {
            const progress = { total: 10, completed: 5, currentTitle: 'Feed 1' };
            useFeedStore.getState().setRefreshProgress(progress);
            
            expect(useFeedStore.getState().refreshProgress).toEqual(progress);
        });

        it('should clear refresh progress', () => {
            useFeedStore.getState().setRefreshProgress(null);
            expect(useFeedStore.getState().refreshProgress).toBeNull();
        });
    });
});
