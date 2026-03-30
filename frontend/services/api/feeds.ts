import type { DiscoveredFeed, Feed, FeedInfo, FeedPreview, Folder, SmartFolder } from '../api.types';
import type { ApiClientCore } from './client';

export function createFeedsApi(client: ApiClientCore) {
    return {
        async getFeeds() {
            return client.request<{ feeds: Feed[] }>('/feeds');
        },

        async addFeed(url: string, folderId?: number, discover = true, refreshInterval?: number) {
            return client.request<{ feed: Feed; discovered?: DiscoveredFeed; articles_added: number }>('/feeds', {
                method: 'POST',
                body: { url, folder_id: folderId, discover, refresh_interval_minutes: refreshInterval },
            });
        },

        async updateFeed(id: number, updates: Partial<Pick<Feed, 'title' | 'folder_id' | 'refresh_interval_minutes'>>) {
            return client.request<{ feed: Feed }>(`/feeds/${id}`, {
                method: 'PATCH',
                body: updates,
            });
        },

        async deleteFeed(id: number) {
            return client.request<{ deleted: boolean }>(`/feeds/${id}`, { method: 'DELETE' });
        },

        async refreshFeed(id: number) {
            return client.request<{ success: boolean; new_articles: number }>(`/feeds/${id}/refresh`, {
                method: 'POST',
            });
        },

        async pauseFeed(id: number) {
            return client.request<{ feed: Feed; paused: boolean }>(`/feeds/${id}/pause`, {
                method: 'POST',
            });
        },

        async resumeFeed(id: number) {
            return client.request<{ feed: Feed; resumed: boolean }>(`/feeds/${id}/resume`, {
                method: 'POST',
            });
        },

        async refreshFeedIcon(id: number) {
            return client.request<{ feed: Feed; icon_refreshed: boolean; message?: string }>(`/feeds/${id}/refresh-icon`, {
                method: 'POST',
            });
        },

        async clearIconCache() {
            return client.request<{ success: boolean }>('/feeds/clear-icon-cache', {
                method: 'POST',
            });
        },

        async getFeedInfo(id: number) {
            return client.request<FeedInfo>(`/feeds/${id}/info`);
        },

        async getYouTubeChannelUrl(id: number) {
            return client.request<{ channel_url: string }>(`/feeds/${id}/youtube-channel`);
        },

        async bulkFeedAction(action: 'move' | 'delete' | 'mark_read' | 'update_refresh_interval' | 'pause' | 'resume', feedIds: number[], folderId?: number | null, refreshInterval?: number) {
            return client.request<{ affected: number }>('/feeds/bulk', {
                method: 'POST',
                body: { action, feed_ids: feedIds, folder_id: folderId, refresh_interval_minutes: refreshInterval },
            });
        },

        async getFolders() {
            return client.request<{ folders: Folder[]; smart_folders: SmartFolder[]; totals: { all_unread: number } }>('/folders');
        },

        async createFolder(name: string) {
            return client.request<{ folder: Folder }>('/folders', {
                method: 'POST',
                body: { name },
            });
        },

        async updateFolder(id: number, name: string) {
            return client.request<{ folder: Folder }>(`/folders/${id}`, {
                method: 'PATCH',
                body: { name },
            });
        },

        async deleteFolder(id: number) {
            return client.request<{ deleted: boolean }>(`/folders/${id}`, { method: 'DELETE' });
        },

        async discover(q: string, type?: string, signal?: AbortSignal) {
            let url = `/discovery?q=${encodeURIComponent(q)}`;
            if (type) {
                url += `&type=${encodeURIComponent(type)}`;
            }
            return client.request<{ discoveries: DiscoveredFeed[] }>(url, { signal });
        },

        async discoverFromUrl(url: string) {
            return client.request<{ discoveries: DiscoveredFeed[]; error?: string }>('/discovery/url', {
                method: 'POST',
                body: { url },
            });
        },

        async previewFeed(feedUrl: string) {
            return client.request<{ articles: FeedPreview[] }>(`/feeds/preview?url=${encodeURIComponent(feedUrl)}`);
        },
    };
}
