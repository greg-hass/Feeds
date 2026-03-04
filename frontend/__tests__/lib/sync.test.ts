import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@react-native-async-storage/async-storage', () => ({
    default: {
        getItem: vi.fn().mockResolvedValue(null),
        setItem: vi.fn().mockResolvedValue(undefined),
        removeItem: vi.fn().mockResolvedValue(undefined),
    },
}));

vi.mock('@/services/api', () => ({
    ApiError: class ApiError extends Error {
        status: number;
        constructor(message: string, status: number) {
            super(message);
            this.status = status;
        }
    },
    api: {
        sync: vi.fn().mockResolvedValue({
            changes: { articles: { created: [], updated: [], deleted: [] } },
            next_cursor: 'cursor-1',
            server_time: '2026-03-04 12:00:00.000',
            is_refreshing: false,
        }),
        pushSyncChanges: vi.fn(),
    },
}));

describe('syncManager', () => {
    const flushSync = () => new Promise((resolve) => setTimeout(resolve, 0));

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('preserves the sync callback when restarted without a new callback', async () => {
        const callback = vi.fn();
        const { syncManager } = await import('@/lib/sync');

        syncManager.stop();
        syncManager.start(callback);
        await flushSync();

        syncManager.stop();

        syncManager.start();
        await flushSync();

        expect(callback).toHaveBeenCalledTimes(2);
        syncManager.stop();
    });
});
