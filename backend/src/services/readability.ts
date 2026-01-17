import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';

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
}> {
    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; Feeds/1.0)',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            },
            signal: AbortSignal.timeout(30000),
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch: ${response.status}`);
        }

        const html = await response.text();
        const dom = new JSDOM(html, { url });
        const reader = new Readability(dom.window.document);
        const article = reader.parse();

        return {
            content: article?.content || null,
            title: article?.title || null,
            excerpt: article?.excerpt || null,
        };
    } catch (err) {
        console.error('Failed to fetch and extract readability:', err);
        return { content: null, title: null, excerpt: null };
    }
}
