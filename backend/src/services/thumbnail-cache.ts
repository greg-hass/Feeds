import { cacheRemoteImage, ensureCacheDir as ensureBaseCacheDir, getCachedImagePath, resolveImageMime } from './image-cache.js';

const USER_AGENT = 'Feeds/1.0 (Thumbnail Cache; +https://github.com/greg-hass/Feeds)';
const THUMBNAIL_SUBDIR = 'thumbnails';

export async function cacheArticleThumbnail(articleId: number, thumbnailUrl: string): Promise<{ fileName: string; mime: string } | null> {
    return cacheRemoteImage(THUMBNAIL_SUBDIR, `article-${articleId}`, thumbnailUrl, {
        headers: { 'User-Agent': USER_AGENT },
    });
}

export function ensureThumbnailCacheDir() {
    ensureBaseCacheDir(THUMBNAIL_SUBDIR);
}

export function getCachedThumbnailPath(fileName: string) {
    return getCachedImagePath(THUMBNAIL_SUBDIR, fileName);
}

export function resolveThumbnailMime(fileName: string, override?: string | null) {
    return resolveImageMime(fileName, override);
}
