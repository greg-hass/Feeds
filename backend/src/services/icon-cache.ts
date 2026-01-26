import { cacheRemoteImage, ensureCacheDir as ensureBaseCacheDir, getCachedImagePath, resolveImageMime, getCacheDir } from './image-cache.js';
import { run } from '../db/index.js';
import { readdir, unlink } from 'node:fs/promises';
import { join } from 'node:path';

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

export async function clearAllIconCaches() {
    // 1. Clear DB
    run(`UPDATE feeds SET icon_cached_path = NULL, icon_cached_content_type = NULL`);

    // 2. Delete files
    const dir = getCacheDir(ICON_SUBDIR);
    try {
        const files = await readdir(dir);
        for (const file of files) {
            if (file === '.gitkeep') continue;
            await unlink(join(dir, file));
        }
    } catch (err) {
        // Ignore if dir doesn't exist
        console.warn('[IconCache] Failed to clear cache directory:', err);
    }
}
