import { FeedState } from '@/stores/types';

type RefreshState = FeedState['refreshState'];

export function formatRefreshAge(iso: string | null): string | null {
    if (!iso) return null;

    const diffMs = Date.now() - new Date(iso).getTime();
    const minutes = Math.floor(diffMs / 60000);

    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;

    const days = Math.floor(hours / 24);
    return `${days}d ago`;
}

export function getRefreshPresentation(refreshState: RefreshState) {
    const freshness = refreshState.freshness || {
        staleSince: null,
        status: 'fresh' as const,
        lastSuccessfulRefreshAt: refreshState.lastCompletedAt || null,
    };
    const activity = refreshState.activity || {
        isRefreshing: refreshState.phase === 'refreshing',
        isSyncing: refreshState.phase === 'syncing',
    };

    const lastSuccessfulRefreshAt = freshness.lastSuccessfulRefreshAt;
    const lastRefreshAge = formatRefreshAge(lastSuccessfulRefreshAt);
    const isStale = freshness.status === 'stale';

    if (activity.isRefreshing) {
        return {
            label: refreshState.message || 'Refreshing feeds…',
            shortLabel: 'Refreshing…',
            sidebarLabel: refreshState.message || 'Refreshing feeds…',
            isRefreshing: true,
            isStale: false,
            isError: false,
            lastRefreshedAt: lastSuccessfulRefreshAt,
        };
    }

    if (activity.isSyncing) {
        return {
            label: refreshState.message || 'Checking for updates…',
            shortLabel: 'Syncing…',
            sidebarLabel: refreshState.message || 'Checking for updates…',
            isRefreshing: true,
            isStale: false,
            isError: false,
            lastRefreshedAt: lastSuccessfulRefreshAt,
        };
    }

    if (refreshState.phase === 'error') {
        return {
            label: refreshState.error ? `Refresh failed: ${refreshState.error}` : 'Refresh failed',
            shortLabel: 'Refresh failed',
            sidebarLabel: 'Refresh failed',
            isRefreshing: false,
            isStale: isStale,
            isError: true,
            lastRefreshedAt: lastSuccessfulRefreshAt,
        };
    }

    if (isStale) {
        return {
            label: lastRefreshAge ? `Stale. Last updated ${lastRefreshAge}` : 'Stale. Refresh needed',
            shortLabel: 'Stale',
            sidebarLabel: lastRefreshAge ? `Stale · Updated ${lastRefreshAge}` : 'Stale · Refresh needed',
            isRefreshing: false,
            isStale: true,
            isError: false,
            lastRefreshedAt: lastSuccessfulRefreshAt,
        };
    }

    return {
        label: lastRefreshAge ? `Updated ${lastRefreshAge}` : 'Awaiting first refresh',
        shortLabel: 'Up to date',
        sidebarLabel: lastRefreshAge ? `Updated ${lastRefreshAge}` : 'Awaiting first refresh',
        isRefreshing: false,
        isStale: false,
        isError: false,
        lastRefreshedAt: lastSuccessfulRefreshAt,
    };
}

export function getRefreshIndicatorState(refreshState: RefreshState) {
    const presentation = getRefreshPresentation(refreshState);

    if (presentation.isError) {
        return {
            variant: 'error' as const,
            accessibilityLabel: presentation.sidebarLabel,
        };
    }

    if (presentation.isRefreshing) {
        return {
            variant: 'active' as const,
            accessibilityLabel: presentation.sidebarLabel,
        };
    }

    if (presentation.isStale) {
        return {
            variant: 'stale' as const,
            accessibilityLabel: presentation.sidebarLabel,
        };
    }

    return null;
}
