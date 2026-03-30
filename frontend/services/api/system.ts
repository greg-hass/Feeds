import type {
    BackupExport,
    BackupRestoreResult,
    BookmarksExport,
    Digest,
    DigestSettings,
    ProgressEvent,
    RefreshProgressEvent,
    Settings,
    SettingsExport,
    SyncResponse,
    Feed,
    Folder,
} from '../api.types';
import { parseSSEStream } from '@/utils/sse';
import type { ApiClientCore } from './client';

export function createSystemApi(client: ApiClientCore) {
    return {
        async getDatabaseStats() {
            return client.get<{
                database: {
                    totalSizeMb: string;
                    articleCount: number;
                    feedCount: number;
                    oldestArticleDate: string | null;
                    ftsSizeMb: string;
                };
                tables: {
                    name: string;
                    rows: number;
                    estimatedSizeMb: string;
                }[];
                maintenance: {
                    fragmentationPercent: string;
                    needsVacuum: boolean;
                    needsOptimize: boolean;
                    recommendations: string[];
                };
            }>('/health/db-stats');
        },

        async optimizeDatabase() {
            return client.post<{
                success: boolean;
                message: string;
                durationMs: number;
            }>('/health/db-optimize');
        },

        async vacuumDatabase() {
            return client.post<{
                success: boolean;
                message: string;
                durationMs: number;
                mbReclaimed: string;
            }>('/health/db-vacuum');
        },

        async getRetentionSettings() {
            return client.get<{
                enabled: boolean;
                maxArticleAgeDays: number;
                maxArticlesPerFeed: number;
                keepStarred: boolean;
                keepUnread: boolean;
            }>('/maintenance/retention');
        },

        async updateRetentionSettings(settings: {
            enabled: boolean;
            maxArticleAgeDays: number;
            maxArticlesPerFeed: number;
            keepStarred: boolean;
            keepUnread: boolean;
        }) {
            return client.put('/maintenance/retention', settings);
        },

        async getMaintenanceStats() {
            return client.get<{
                totalSizeBytes: number;
                articleCount: number;
                feedCount: number;
                oldestArticleDate: string | null;
            }>('/maintenance/stats');
        },

        async getCleanupPreview() {
            return client.get<{
                articlesAffected: number;
                oldestArticleDate: string | null;
                estimatedSpaceSaved: number;
            }>('/maintenance/cleanup/preview');
        },

        async runCleanup() {
            return client.post<{
                articlesDeleted: number;
                bytesReclaimed: number;
            }>('/maintenance/cleanup');
        },

        async importOpml(file: any) {
            const formData = new FormData();

            if (file.file) {
                formData.append('opml', file.file);
            } else {
                formData.append('opml', {
                    uri: file.uri,
                    name: file.name || 'feeds.opml',
                    type: file.mimeType || 'text/xml',
                } as any);
            }

            return client.request<{ imported: { folders: number; feeds: number } }>('/opml/import', {
                method: 'POST',
                body: formData,
                headers: {
                    'Content-Type': undefined as any,
                },
            });
        },

        async exportOpml() {
            return client.request<string>('/opml/export', {
                headers: { Accept: 'text/xml' },
            });
        },

        async exportBookmarks() {
            return client.request<BookmarksExport>('/articles/bookmarks/export');
        },

        async exportSettingsBackup() {
            return client.request<SettingsExport>('/settings/export');
        },

        async exportBackup() {
            return client.request<BackupExport>('/settings/backup');
        },

        async restoreBackup(backup: BackupExport) {
            return client.request<BackupRestoreResult>('/settings/backup', {
                method: 'POST',
                body: backup,
            });
        },

        async getSettings() {
            return client.request<{ settings: Settings; global_last_refresh_at: string | null; global_next_refresh_at: string | null }>('/settings');
        },

        async updateSettings(settings: Partial<Settings>) {
            return client.request<{ settings: Settings; global_last_refresh_at: string | null; global_next_refresh_at: string | null }>('/settings', {
                method: 'PATCH',
                body: settings,
            });
        },

        async sync(cursor?: string, include?: string) {
            const searchParams = new URLSearchParams();
            if (cursor) searchParams.set('cursor', cursor);
            if (include) searchParams.set('include', include);
            const query = searchParams.toString();
            return client.request<SyncResponse>(`/sync${query ? `?${query}` : ''}`);
        },

        async pushSyncChanges(readState: { article_id: number; is_read: boolean }[]) {
            return client.request<{ read_state: { accepted: number; rejected: number } }>('/sync/push', {
                method: 'POST',
                body: { read_state: readState },
            });
        },

        async getLatestDigest() {
            return client.request<{ digest: Digest | null }>('/digest');
        },

        async getPendingDigest() {
            return client.request<{ digest: Digest | null }>('/digest/pending');
        },

        async dismissDigest(id: number) {
            return client.request<{ success: boolean }>(`/digest/dismiss/${id}`, {
                method: 'POST',
            });
        },

        async generateDigest() {
            return client.request<{ success: boolean; digest: Digest }>('/digest/generate', {
                method: 'POST',
            });
        },

        async getDigestSettings() {
            return client.request<{ settings: DigestSettings }>('/digest/settings');
        },

        async updateDigestSettings(settings: Partial<DigestSettings>) {
            return client.request<{ success: boolean }>('/digest/settings', {
                method: 'PUT',
                body: settings,
            });
        },

        async importOpmlWithProgress(
            file: any,
            onEvent: (event: ProgressEvent) => void,
            onError?: (error: Error) => void
        ): Promise<void> {
            const formData = new FormData();

            if (file.file) {
                formData.append('opml', file.file);
            } else {
                formData.append('opml', {
                    uri: file.uri,
                    name: file.name || 'feeds.opml',
                    type: file.mimeType || 'text/xml',
                } as any);
            }

            try {
                const response = await fetch(`${client.getApiUrl()}/opml-stream/import`, {
                    method: 'POST',
                    headers: await client.getAuthorizedHeaders(),
                    body: formData,
                });

                if (!response.ok) {
                    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
                    throw new Error(error.error || 'Import failed');
                }

                await parseSSEStream(response, onEvent);
            } catch (err) {
                onError?.(err instanceof Error ? err : new Error('Unknown error'));
            }
        },

        async refreshFeedsWithProgress(
            feedIds: number[] | undefined,
            onEvent: (event: RefreshProgressEvent) => void,
            onError?: (error: Error) => void,
            signal?: AbortSignal
        ): Promise<void> {
            const idsParam = feedIds?.length ? `?ids=${feedIds.join(',')}` : '';

            try {
                const response = await fetch(`${client.getApiUrl()}/feeds-stream/refresh-multiple${idsParam}`, {
                    method: 'GET',
                    headers: await client.getAuthorizedHeaders(),
                    signal,
                });

                if (!response.ok) {
                    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
                    throw new Error(error.error || 'Refresh failed');
                }

                await parseSSEStream(response, onEvent);
            } catch (err) {
                const error = err instanceof Error ? err : new Error('Unknown error');
                if (error.name === 'AbortError') {
                    return;
                }
                onError?.(error);
            }
        },

        async listenForRefreshEvents(
            onEvent: (event: RefreshProgressEvent) => void,
            onError?: (error: Error) => void,
            signal?: AbortSignal
        ): Promise<void> {
            try {
                const response = await fetch(`${client.getApiUrl()}/feeds-stream/refresh-events`, {
                    method: 'GET',
                    headers: await client.getAuthorizedHeaders(),
                    signal,
                });

                if (!response.ok) {
                    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
                    throw new Error(error.error || 'Refresh event stream failed');
                }

                await parseSSEStream(response, onEvent);
            } catch (err) {
                const error = err instanceof Error ? err : new Error('Unknown error');
                if (error.name === 'AbortError') {
                    return;
                }
                onError?.(error);
            }
        },

        async listenForFeedChanges(
            onEvent: (event: { type: string; feed?: Feed; folder?: Folder; feedId?: number; folderId?: number; timestamp: string }) => void,
            onError?: (error: Error) => void,
            signal?: AbortSignal
        ): Promise<void> {
            try {
                const response = await fetch(`${client.getApiUrl()}/feed-changes`, {
                    method: 'GET',
                    headers: await client.getAuthorizedHeaders(),
                    signal,
                });

                if (!response.ok) {
                    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
                    throw new Error(error.error || 'Feed changes stream failed');
                }

                await parseSSEStream(response, onEvent);
            } catch (err) {
                const error = err instanceof Error ? err : new Error('Unknown error');
                if (error.name === 'AbortError') {
                    return;
                }
                onError?.(error);
            }
        },
    };
}
