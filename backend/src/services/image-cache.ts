import { mkdirSync, existsSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { dirname, join, extname } from 'node:path';
import { HTTP } from '../config/constants.js';
import { fetchWithRetry } from './http.js';

const ALLOWED_EXTENSIONS = new Set([
    '.png',
    '.jpg',
    '.jpeg',
    '.webp',
    '.gif',
    '.ico',
    '.svg',
]);

const MIME_FROM_EXTENSION: Record<string, string> = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
    '.ico': 'image/x-icon',
    '.svg': 'image/svg+xml',
};

const BASE_CACHE_DIR = (() => {
    const dbPath = process.env.DATABASE_PATH || './data/feeds.db';
    return dirname(dbPath);
})();

export function getCacheDir(subdir: string) {
    return join(BASE_CACHE_DIR, subdir);
}

function ensureDirectory(dir: string) {
    if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
    }
}

function normalizeExtension(ext: string): string {
    if (!ext.startsWith('.')) {
        ext = `.${ext}`;
    }
    const lower = ext.toLowerCase();
    return ALLOWED_EXTENSIONS.has(lower) ? lower : '.png';
}

function extractExtensionFromUrl(url: string): string {
    try {
        const parsed = new URL(url);
        const pathname = parsed.pathname.split('/').pop() || '';
        const ext = extname(pathname);
        if (ext) {
            return normalizeExtension(ext);
        }
    } catch {
        // Ignore invalid URL
    }
    return '.png';
}

function deriveExtension(url: string, contentType?: string): string {
    if (contentType) {
        const lower = contentType.split(';')[0].trim().toLowerCase();
        if (lower.startsWith('image/')) {
            const mimeExt = Object.entries(MIME_FROM_EXTENSION).find(([, mime]) => mime === lower)?.[0];
            if (mimeExt) return mimeExt;
        }
    }
    return extractExtensionFromUrl(url);
}

function isFetchableUrl(url: string): boolean {
    return url.startsWith('http://') || url.startsWith('https://');
}

export function ensureCacheDir(subdir: string) {
    ensureDirectory(getCacheDir(subdir));
}

/**
 * Validate filename to prevent path traversal attacks
 * Only allows alphanumeric characters, hyphens, underscores, and dots
 */
function validateFileName(fileName: string): boolean {
    // Must not contain path separators or parent directory references
    if (fileName.includes('/') || fileName.includes('\\') || fileName.includes('..')) {
        return false;
    }
    // Must match safe filename pattern
    return /^[a-zA-Z0-9_-]+\.[a-zA-Z0-9]+$/.test(fileName);
}

export function getCachedImagePath(subdir: string, fileName: string): string | null {
    if (!validateFileName(fileName)) {
        console.warn(`[ImageCache] Invalid filename rejected: ${fileName}`);
        return null;
    }
    return join(getCacheDir(subdir), fileName);
}

export function resolveImageMime(fileName: string, override?: string | null) {
    if (override) return override;
    const extension = extname(fileName).toLowerCase();
    return MIME_FROM_EXTENSION[extension] || 'application/octet-stream';
}

export interface CacheRemoteImageOptions {
    headers?: Record<string, string>;
}

export async function cacheRemoteImage(
    subdir: string,
    key: string,
    url: string,
    options: CacheRemoteImageOptions = {}
): Promise<{ fileName: string; mime: string } | null> {
    if (!url || !isFetchableUrl(url)) {
        return null;
    }

    ensureCacheDir(subdir);

    try {
        const response = await fetchWithRetry(
            url,
            () => ({
                headers: options.headers,
                signal: AbortSignal.timeout(HTTP.REQUEST_TIMEOUT),
            }),
            { retries: 2, baseDelayMs: 400, maxDelayMs: 2000 }
        );

        if (!response.ok) {
            console.warn(`Cache fetch failed (${response.status}) for key ${key}: ${url}`);
            return null;
        }

        const rawContentType = response.headers.get('Content-Type') || '';
        const contentType = rawContentType.split(';')[0].trim().toLowerCase();
        if (contentType && !contentType.startsWith('image/') && contentType !== 'application/octet-stream') {
            console.warn(`Skipping invalid content-type for ${key}: ${contentType}`);
            return null;
        }

        const extension = deriveExtension(url, contentType || undefined);
        const fileName = `${key}${extension}`;
        const filePath = getCachedImagePath(subdir, fileName);
        if (!filePath) {
            console.warn(`[ImageCache] Invalid file path for key ${key}`);
            return null;
        }
        const data = Buffer.from(await response.arrayBuffer());

        await writeFile(filePath, data);

        const mime = contentType || MIME_FROM_EXTENSION[extension] || 'application/octet-stream';
        return { fileName, mime };
    } catch (err: unknown) {
        console.warn(`Failed to cache ${key}:`, err);
        return null;
    }
}
