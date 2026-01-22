import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';

import { extractHeroImage } from './feed-parser.js';

// Reduced timeout for faster failures - don't wait forever for slow sites
const CONTENT_FETCH_TIMEOUT = 15000; // 15 seconds (reduced from 30s)

export function extractReadability(html: string, url?: string): string | null {
    try {
        const dom = new JSDOM(html, { url });
        const reader = new Readability(dom.window.document);
        const article = reader.parse();

        if (article && article.content) {
            return article.content;
        }

        return null;
    } catch (err) {
        console.error('Readability extraction failed:', err);
        return null;
    }
}

export async function fetchAndExtractReadability(url: string): Promise<{
    content: string | null;
    title: string | null;
    excerpt: string | null;
    siteName: string | null;
    byline: string | null;
    imageUrl: string | null;
}> {
    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Encoding': 'gzip, deflate',
            },
            signal: AbortSignal.timeout(CONTENT_FETCH_TIMEOUT),
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch: ${response.status}`);
        }

        const html = await response.text();
        const dom = new JSDOM(html, { url });
        const reader = new Readability(dom.window.document);
        const article = reader.parse();

        // Extract hero image using our robust logic
        const imageUrl = extractHeroImage(html, article || {});

        return {
            content: article?.content || null,
            title: article?.title || null,
            excerpt: article?.excerpt || null,
            siteName: article?.siteName || null,
            byline: article?.byline || null,
            imageUrl: imageUrl,
        };
    } catch (err) {
        // Only log actual errors, not timeouts (expected for slow sites)
        if (err instanceof Error && err.name !== 'AbortError') {
            console.error('Failed to fetch and extract readability:', err);
        }
        return { content: null, title: null, excerpt: null, siteName: null, byline: null, imageUrl: null };
    }
}
