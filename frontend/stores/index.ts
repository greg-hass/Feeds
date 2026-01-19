import { useFeedStore } from './feedStore';
import { useArticleStore } from './articleStore';
import { enableSync, SyncChanges } from '@/lib/sync';

export * from './feedStore';
export * from './articleStore';
export * from './settingsStore';
export * from './digestStore';
export * from './toastStore';
export * from './videoStore';
export * from './audioStore';

/**
 * Initialize background sync for all stores.
 * Call this on app start to enable periodic sync.
 */
let syncCleanup: (() => void) | null = null;

export function initializeSync(): void {
    if (syncCleanup) {
        return; // Already initialized
    }

    syncCleanup = enableSync((changes: SyncChanges) => {
        // Apply sync changes to all stores
        useFeedStore.getState().applySyncChanges(changes);
        useArticleStore.getState().applySyncChanges(changes);
    });
}

/**
 * Stop background sync.
 */
export function stopSync(): void {
    if (syncCleanup) {
        syncCleanup();
        syncCleanup = null;
    }
}

