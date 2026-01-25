import { Feed } from '@/services/api';

export type FeedHealthStatus = 'healthy' | 'stale' | 'dead' | 'paused' | 'error';

export interface FeedHealthInfo {
  status: FeedHealthStatus;
  label: string;
  description: string;
  lastFetched: string;
  nextFetch: string;
}

/**
 * Calculate the health status of a feed based on its refresh history and errors
 */
export function getFeedHealth(feed: Feed): FeedHealthStatus {
  // Paused feeds have their own status
  if (feed.paused_at) {
    return 'paused';
  }

  // Feeds with errors are marked as error
  if (feed.error_count > 0) {
    // If error count is high (5+), consider it "dead" instead of just "error"
    return feed.error_count >= 5 ? 'dead' : 'error';
  }

  // Check if feed has never been fetched
  if (!feed.last_fetched_at) {
    return 'stale';
  }

  // Calculate staleness based on refresh interval
  const now = new Date();
  const lastFetched = new Date(feed.last_fetched_at);
  const hoursSinceFetch = (now.getTime() - lastFetched.getTime()) / (1000 * 60 * 60);

  // Use the feed's refresh interval (in minutes) to determine staleness
  const refreshIntervalHours = (feed.refresh_interval_minutes || 60) / 60;

  // Feed is stale if it hasn't been fetched in 3x its refresh interval
  // (e.g., a 30-min feed is stale after 90 minutes of no updates)
  if (hoursSinceFetch > refreshIntervalHours * 3) {
    // Feed is "dead" if it's been more than 7 days since last fetch
    if (hoursSinceFetch > 24 * 7) {
      return 'dead';
    }
    return 'stale';
  }

  return 'healthy';
}

/**
 * Get human-readable health information for a feed
 */
export function getFeedHealthInfo(feed: Feed): FeedHealthInfo {
  const status = getFeedHealth(feed);

  const formatTime = (dateStr: string | null) => {
    if (!dateStr) return 'Never';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const formatNextTime = (dateStr: string | null) => {
    if (!dateStr) return 'Not scheduled';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();

    if (diffMs < 0) return 'Overdue';

    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

    if (diffMins < 60) return `in ${diffMins}m`;
    if (diffHours < 24) return `in ${diffHours}h`;
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  switch (status) {
    case 'healthy':
      return {
        status,
        label: 'Healthy',
        description: 'Feed is updating regularly',
        lastFetched: formatTime(feed.last_fetched_at),
        nextFetch: formatNextTime(feed.next_fetch_at),
      };
    case 'stale':
      return {
        status,
        label: 'Stale',
        description: 'Feed hasn\'t updated recently',
        lastFetched: formatTime(feed.last_fetched_at),
        nextFetch: formatNextTime(feed.next_fetch_at),
      };
    case 'dead':
      return {
        status,
        label: 'Dead',
        description: 'Feed appears to be inactive or unavailable',
        lastFetched: formatTime(feed.last_fetched_at),
        nextFetch: formatNextTime(feed.next_fetch_at),
      };
    case 'paused':
      return {
        status,
        label: 'Paused',
        description: 'Feed updates are paused',
        lastFetched: formatTime(feed.last_fetched_at),
        nextFetch: 'Paused',
      };
    case 'error':
      return {
        status,
        label: 'Connection Issue',
        description: feed.last_error || 'Failed to fetch feed',
        lastFetched: formatTime(feed.last_fetched_at),
        nextFetch: formatNextTime(feed.next_fetch_at),
      };
  }
}

/**
 * Get color for health status
 */
export function getHealthColor(status: FeedHealthStatus, colors: any): string {
  switch (status) {
    case 'healthy':
      return colors.success || '#10b981';
    case 'stale':
      return colors.warning || '#f59e0b';
    case 'dead':
      return '#6b7280'; // gray for dead feeds
    case 'paused':
      return colors.warning || '#f59e0b';
    case 'error':
      return colors.error || '#ef4444';
  }
}
