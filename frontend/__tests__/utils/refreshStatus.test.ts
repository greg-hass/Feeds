import { describe, expect, it, vi } from 'vitest';
import { getRefreshPresentation } from '@/utils/refreshStatus';

describe('getRefreshPresentation', () => {
    it('returns a refreshing presentation when a manual refresh is active', () => {
        const result = getRefreshPresentation({
            phase: 'refreshing',
            scope: 'manual',
            startedAt: '2026-03-07T10:00:00.000Z',
            lastAttemptAt: '2026-03-07T10:00:00.000Z',
            lastCompletedAt: null,
            message: 'Refreshing feeds…',
            error: null,
            activity: {
                isRefreshing: true,
                isSyncing: false,
            },
            freshness: {
                staleSince: null,
                status: 'fresh',
                lastSuccessfulRefreshAt: null,
            },
            newContent: {
                count: 0,
            },
            progress: null,
        });

        expect(result.shortLabel).toBe('Refreshing…');
        expect(result.isRefreshing).toBe(true);
        expect(result.isError).toBe(false);
        expect(result.isStale).toBe(false);
    });

    it('returns stale copy based on the last successful refresh', () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-03-07T12:00:00.000Z'));

        const result = getRefreshPresentation({
            phase: 'idle',
            scope: null,
            startedAt: null,
            lastAttemptAt: null,
            lastCompletedAt: '2026-03-07T11:50:00.000Z',
            message: 'Timeline may be out of date',
            error: null,
            activity: {
                isRefreshing: false,
                isSyncing: false,
            },
            freshness: {
                staleSince: '2026-03-07T11:59:00.000Z',
                status: 'stale',
                lastSuccessfulRefreshAt: '2026-03-07T11:50:00.000Z',
            },
            newContent: {
                count: 0,
            },
            progress: null,
        });

        expect(result.label).toBe('Stale. Last updated 10m ago');
        expect(result.sidebarLabel).toBe('Stale · Updated 10m ago');
        expect(result.isStale).toBe(true);

        vi.useRealTimers();
    });
});
