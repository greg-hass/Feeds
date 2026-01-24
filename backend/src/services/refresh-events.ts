import { EventEmitter } from 'events';

export interface RefreshStats {
    success: number;
    errors: number;
    failed_feeds: Array<{ id: number; title: string; error: string }>;
}

export type RefreshEvent =
    | { type: 'start'; total_feeds: number }
    | { type: 'feed_refreshing'; id: number; title: string }
    | { type: 'feed_complete'; id: number; title: string; new_articles: number; next_fetch_at?: string }
    | { type: 'feed_error'; id: number; title: string; error: string }
    | { type: 'complete'; stats: RefreshStats };

const refreshEvents = new EventEmitter();
refreshEvents.setMaxListeners(100);

export function emitRefreshEvent(event: RefreshEvent): void {
    refreshEvents.emit('refresh', event);
}

export function onRefreshEvent(listener: (event: RefreshEvent) => void): () => void {
    refreshEvents.on('refresh', listener);
    return () => {
        refreshEvents.off('refresh', listener);
    };
}
