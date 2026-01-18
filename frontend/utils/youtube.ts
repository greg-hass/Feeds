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
    const embedMatch = url.match(/(?:youtube\.com|youtube-nocookie\.com)\/embed\/([a-zA-Z0-9_-]{11})/);
    if (embedMatch) return embedMatch[1];

    // Shorts URL: https://www.youtube.com/shorts/VIDEO_ID
    const shortsMatch = url.match(/youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/);
    if (shortsMatch) return shortsMatch[1];

    // Live URL: https://www.youtube.com/live/VIDEO_ID
    const liveMatch = url.match(/youtube\.com\/live\/([a-zA-Z0-9_-]{11})/);
    if (liveMatch) return liveMatch[1];

    // Thumbnail URL: https://i.ytimg.com/vi/VIDEO_ID/hqdefault.jpg
    const thumbMatch = url.match(/(?:img\.youtube\.com|i\.ytimg\.com)\/vi\/([a-zA-Z0-9_-]{11})/);
    if (thumbMatch) return thumbMatch[1];

    return null;
}

/**
 * Get YouTube embed URL for iframe
 */
export function getEmbedUrl(videoId: string, autoplay = false, playsinline = true): string {
    const params = new URLSearchParams({
        rel: '0',
        modestbranding: '1',
        ...(autoplay && { autoplay: '1', mute: '1' }),
        ...(playsinline && { playsinline: '1' }),
    });
    return `https://www.youtube.com/embed/${videoId}?${params.toString()}`;
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
