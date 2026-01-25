import { fetchWithRetry } from './http.js';
import { decodeHtmlEntities } from './feed-utils.js';

const USER_AGENT = 'Feeds/1.0 (Feed Reader; +https://github.com/greg-hass/Feeds) Mozilla/5.0 (compatible)';

export async function fetchRedditIcon(subreddit: string): Promise<string | null> {
    try {
        const response = await fetchWithRetry(`https://www.reddit.com/r/${subreddit}/about.json`, () => ({
            headers: { 'User-Agent': USER_AGENT },
            signal: AbortSignal.timeout(8000),
        }), {
            retries: 1,
        });
        if (!response.ok) return null;
        const data = await response.json();
        const icon = data.data?.community_icon || data.data?.icon_img;
        if (icon) {
            const url = icon.split('?')[0];
            return url.replace(/&amp;/g, '&');
        }
        return null;
    } catch {
        return null;
    }
}

export function cleanRedditContent(html: string): string {
    return html.replace(/<table[^>]*>[\s\S]*?<\/table>/gi, '').trim();
}

export function upgradeRedditImageUrl(url: string): string {
    try {
        const urlObj = new URL(url);
        if (urlObj.searchParams.has('s') && urlObj.searchParams.get('s')) {
            return url;
        }

        if (urlObj.hostname === 'preview.redd.it') {
            urlObj.searchParams.set('width', '640');
            urlObj.searchParams.set('crop', 'smart');
            urlObj.searchParams.set('auto', 'webp');
            return urlObj.toString();
        }

        if (urlObj.hostname === 'external-preview.redd.it') {
            urlObj.searchParams.set('width', '640');
            urlObj.searchParams.set('format', 'jpg');
            urlObj.searchParams.set('auto', 'webp');
            return urlObj.toString();
        }

        return url;
    } catch {
        return url;
    }
}

export function normalizeRedditAuthor(author: string | null): string | null {
    if (author && !author.startsWith('u/')) {
        return `u/${author}`;
    }
    return author;
}

export function extractRedditThumbnail(content: string): string | null {
    const imgMatch = content.match(/<img[^>]+src="([^">]+)"/) || content.match(/<a[^>]+href="([^">]+\.(?:jpg|jpeg|png|gif|webp)[^">]*)"/i);
    if (imgMatch) {
        let thumbnail = imgMatch[1];
        thumbnail = decodeHtmlEntities(thumbnail);
        return upgradeRedditImageUrl(thumbnail);
    }
    return null;
}
