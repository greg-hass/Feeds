import { discoverFeedsFromUrl, DiscoveredFeed } from '../discovery.js';

const GOOGLE_SEARCH_API_KEY = process.env.GOOGLE_SEARCH_API_KEY;
const GOOGLE_SEARCH_ENGINE_ID = process.env.GOOGLE_SEARCH_ENGINE_ID;

/**
 * Search for RSS feeds based on a topic string using Google Custom Search
 */
export async function searchRssFeeds(topic: string, maxResults: number = 5): Promise<DiscoveredFeed[]> {
    if (!GOOGLE_SEARCH_API_KEY || !GOOGLE_SEARCH_ENGINE_ID) {
        console.warn('Google Search API credentials not set, skipping RSS-specific discovery');
        return [];
    }

    try {
        const query = encodeURIComponent(`${topic} blog rss`);
        const url = `https://www.googleapis.com/customsearch/v1?q=${query}&key=${GOOGLE_SEARCH_API_KEY}&cx=${GOOGLE_SEARCH_ENGINE_ID}&num=${maxResults}`;

        const response = await fetch(url);
        if (!response.ok) return [];

        const data = await response.json();
        const siteUrls = data.items?.map((item: any) => item.link) || [];

        const discoveryPromises = siteUrls.map(async (siteUrl: string) => {
            try {
                const feeds = await discoverFeedsFromUrl(siteUrl);
                return feeds.slice(0, 2); // Max 2 feeds per site
            } catch {
                return [];
            }
        });

        const results = await Promise.all(discoveryPromises);
        return results.flat();
    } catch (err) {
        console.error('RSS search failed:', err);
        return [];
    }
}
