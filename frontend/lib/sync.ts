import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, ApiError } from '@/services/api';
import { SYNC } from '@/config/constants';

export interface SyncChanges {
    feeds?: {
        created: unknown[];
        updated: unknown[];
        deleted: number[];
    };
    folders?: {
        created: unknown[];
        updated: unknown[];
        deleted: number[];
    };
    articles?: {
        created: unknown[];
        updated: unknown[];
        deleted: number[];
    };
    read_state?: {
        read: number[];
        unread: number[];
    };
}



interface SyncResult {
    changes: SyncChanges;
    next_cursor: string;
    server_time: string;
    is_refreshing?: boolean;
}



/**
 * Get the current sync cursor from storage
 */
async function getSyncCursor(): Promise<string | null> {
    try {
        return await AsyncStorage.getItem(SYNC.CURSOR_KEY);
    } catch {
        return null;
    }
}

/**
 * Save the sync cursor to storage
 */
async function saveSyncCursor(cursor: string): Promise<void> {
    try {
        await AsyncStorage.setItem(SYNC.CURSOR_KEY, cursor);
    } catch {
        // Ignore storage errors
    }
}

/**
 * Fetch changes from the server since the last sync
 */
export async function fetchChanges(
    include: string = 'feeds,folders,articles,read_state',
    options: { skipCursorUpdate?: boolean } = {}
): Promise<SyncResult | null> {
    try {
        const cursor = await getSyncCursor();
        const response = await api.sync(cursor || undefined);

        // Save the new cursor for next sync (unless skipped)
        if (response.next_cursor && !options.skipCursorUpdate) {
            await saveSyncCursor(response.next_cursor);
        }

        return response;
    } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
            // Unauthorized - don't log as error
            return null;
        }
        console.error('Failed to fetch sync changes:', error);
        return null;
    }
}

/**
 * Push local read state changes to the server
 */
export async function pushReadState(readState: { article_id: number; is_read: boolean }[]): Promise<boolean> {
    try {
        await api.pushSyncChanges(readState);
        return true;
    } catch (error) {
        console.error('Failed to push read state:', error);
        return false;
    }
}

/**
 * Apply sync changes to local stores
 * This is called by individual stores to apply their specific changes
 */
export function applySyncChanges(changes: SyncChanges): {
    feedsCreated: unknown[];
    feedsUpdated: unknown[];
    feedsDeleted: number[];
    foldersCreated: unknown[];
    foldersUpdated: unknown[];
    foldersDeleted: number[];
    articlesCreated: unknown[];
    readStateRead: number[];
    readStateUnread: number[];
} {
    return {
        feedsCreated: changes.feeds?.created ?? [],
        feedsUpdated: changes.feeds?.updated ?? [],
        feedsDeleted: changes.feeds?.deleted ?? [],
        foldersCreated: changes.folders?.created ?? [],
        foldersUpdated: changes.folders?.updated ?? [],
        foldersDeleted: changes.folders?.deleted ?? [],
        articlesCreated: changes.articles?.created ?? [],
        readStateRead: changes.read_state?.read ?? [],
        readStateUnread: changes.read_state?.unread ?? [],
    };
}

/**
 * Sync manager for periodic background sync
 */
class SyncManager {
    private intervalId: ReturnType<typeof setInterval> | null = null;
    private isSyncing = false;
    private onSyncCallback?: ((changes: SyncChanges, isRefreshing?: boolean) => void) | null = null;

    /**
     * Start the periodic sync interval
     */
    start(callback?: (changes: SyncChanges, isRefreshing?: boolean) => void): void {
        if (this.intervalId) {
            return; // Already running
        }

        this.onSyncCallback = callback || null;

        // Initial sync
        this.sync();

        // Set up periodic sync
        this.intervalId = setInterval(() => {
            this.sync();
        }, SYNC.SYNC_INTERVAL);
    }

    /**
     * Stop the periodic sync interval
     */
    stop(): void {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }

    /**
     * Perform a sync operation
     */
    async sync(): Promise<SyncResult | null> {
        if (this.isSyncing) {
            return null;
        }

        this.isSyncing = true;

        try {
            const result = await fetchChanges();

            if (result && this.onSyncCallback) {
                this.onSyncCallback(result.changes, result.is_refreshing);
            }

            return result;
        } finally {
            this.isSyncing = false;
        }
    }

    /**
     * Force an immediate sync
     */
    async forceSync(): Promise<SyncResult | null> {
        return this.sync();
    }
}

// Export singleton instance
export const syncManager = new SyncManager();

/**
 * Hook to use sync functionality
 * Call this in your app root or main screen to enable background sync
 */
export function enableSync(onSyncChanges?: (changes: SyncChanges, isRefreshing?: boolean) => void): () => void {
    syncManager.start(onSyncChanges);

    // Return cleanup function
    return () => {
        syncManager.stop();
    };
}
