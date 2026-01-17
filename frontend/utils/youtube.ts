/**
 * YouTube utility functions for extracting video IDs and generating URLs
 */

/**
 * Extract YouTube video ID from various URL formats
 */
export function extractVideoId(url: string): string | null {
    if (!url) return null;

    // Standard watch URL: https://www.youtube.com/watch?v=VIDEO_ID
    const watchMatch = url.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
    if (watchMatch) return watchMatch[1];

    // Short URL: https://youtu.be/VIDEO_ID
    const shortMatch = url.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
    if (shortMatch) return shortMatch[1];

    // Embed URL: https://www.youtube.com/embed/VIDEO_ID
    const embedMatch = url.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/);
    if (embedMatch) return embedMatch[1];

    // Shorts URL: https://www.youtube.com/shorts/VIDEO_ID
    const shortsMatch = url.match(/youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/);
    if (shortsMatch) return shortsMatch[1];

    return null;
}

/**
 * Get YouTube embed URL for iframe
 */
export function getEmbedUrl(videoId: string): string {
    return `https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1`;
}

/**
 * Get YouTube thumbnail URL (high quality)
 */
export function getThumbnailUrl(videoId: string, quality: 'default' | 'hq' | 'maxres' = 'hq'): string {
    const qualityMap = {
        default: 'default',
        hq: 'hqdefault',
        maxres: 'maxresdefault',
    };
    return `https://img.youtube.com/vi/${videoId}/${qualityMap[quality]}.jpg`;
}

/**
 * Check if a URL is a YouTube video URL
 */
export function isYouTubeUrl(url: string): boolean {
    return extractVideoId(url) !== null;
}
