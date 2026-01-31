import { cacheRemoteImage, ensureCacheDir as ensureBaseCacheDir, getCachedImagePath, resolveImageMime, getCacheDir } from './image-cache.js';
import { run } from '../db/index.js';
import { readdir, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { existsSync } from 'node:fs';

// Use browser-like headers for YouTube servers
const ICON_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'image/*,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
};
const ICON_SUBDIR = 'icons';

export async function cacheFeedIcon(feedId: number, iconUrl: string): Promise<{ fileName: string; mime: string } | null> {
    return cacheRemoteImage(ICON_SUBDIR, `feed-${feedId}`, iconUrl, {
        headers: ICON_HEADERS,
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

export async function clearFeedIconCache(feedId: number, cachedPath: string | null) {
    if (!cachedPath) return;
    try {
        const filePath = getCachedIconPath(cachedPath);
        if (filePath && existsSync(filePath)) {
            await unlink(filePath);
            console.log(`[IconCache] Deleted icon for feed ${feedId}: ${cachedPath}`);
        }
    } catch (err) {
        console.warn(`[IconCache] Failed to delete icon for feed ${feedId}:`, err);
    }
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
