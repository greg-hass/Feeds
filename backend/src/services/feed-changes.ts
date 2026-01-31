import { EventEmitter } from 'events';
import { Feed, Folder } from '../types/index.js';

export type FeedChangeType = 'feed_created' | 'feed_updated' | 'feed_deleted' | 'folder_created' | 'folder_updated' | 'folder_deleted';

// API feed format (what toApiFeed returns - without internal cached fields)
export type ApiFeed = Omit<Feed, 'icon_cached_path' | 'icon_cached_content_type'> & {
    icon_url: string | null;
};

export interface FeedChangeEvent {
    type: FeedChangeType;
    feed?: ApiFeed;
    folder?: Folder;
    feedId?: number;
    folderId?: number;
    timestamp: string;
}

const feedChangesEmitter = new EventEmitter();
feedChangesEmitter.setMaxListeners(100);

export function emitFeedChange(event: FeedChangeEvent): void {
    feedChangesEmitter.emit('change', event);
}

export function onFeedChange(listener: (event: FeedChangeEvent) => void): () => void {
    feedChangesEmitter.on('change', listener);
    return () => {
        feedChangesEmitter.off('change', listener);
    };
}
