import { cacheRemoteImage, ensureCacheDir as ensureBaseCacheDir, getCachedImagePath, resolveImageMime } from './image-cache.js';

const USER_AGENT = 'Feeds/1.0 (Icon Cache; +https://github.com/greg-hass/Feeds)';
const ICON_SUBDIR = 'icons';

export async function cacheFeedIcon(feedId: number, iconUrl: string): Promise<{ fileName: string; mime: string } | null> {
    return cacheRemoteImage(ICON_SUBDIR, `feed-${feedId}`, iconUrl, {
        headers: { 'User-Agent': USER_AGENT },
    });
}

export function ensureIconCacheDir() {
    ensureBaseCacheDir(ICON_SUBDIR);
}

export function getCachedIconPath(fileName: string) {
    return getCachedImagePath(ICON_SUBDIR, fileName);
}

export function resolveIconMime(fileName: string, override?: string | null) {
    return resolveImageMime(fileName, override);
}
