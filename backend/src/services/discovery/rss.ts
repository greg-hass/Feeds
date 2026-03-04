import { discoverFeedsFromUrl } from './url-discovery.js';
import { DiscoveredFeed as DiscoveredFeedType } from '../../types/discovery.js';

const GOOGLE_SEARCH_API_KEY = process.env.GOOGLE_SEARCH_API_KEY;
const GOOGLE_SEARCH_ENGINE_ID = process.env.GOOGLE_SEARCH_ENGINE_ID;

const USER_AGENT = 'Feeds/1.0 (Feed Reader; +https://github.com/greg-hass/Feeds)';

/**
 * Search for RSS feeds based on a topic string
 * Tries multiple free methods in order of reliability
 */
export async function searchRssFeeds(topic: string, maxResults: number = 5): Promise<DiscoveredFeedType[]> {
    console.log(`[RSS Discovery] Searching for: "${topic}"`);
    const allDiscoveries: DiscoveredFeedType[] = [];

    // Method 1: DuckDuckGo with multiple query variations
    const duckduckgoResults = await searchDuckDuckGo(topic, maxResults);
    if (duckduckgoResults.length > 0) {
        console.log(`[RSS Discovery] DuckDuckGo found ${duckduckgoResults.length} feeds`);
        allDiscoveries.push(...duckduckgoResults);
    }

    // Method 2: Feed directory/aggregator APIs (using known working services)
    const directoryResults = await searchFeedDirectories(topic, maxResults - allDiscoveries.length);
    if (directoryResults.length > 0) {
        console.log(`[RSS Discovery] Directories found ${directoryResults.length} feeds`);
        for (const feed of directoryResults) {
            if (!allDiscoveries.some(d => d.feed_url === feed.feed_url)) {
                allDiscoveries.push(feed);
            }
        }
    }

    // Method 3: Try Bing as fallback
    if (allDiscoveries.length < maxResults) {
        const bingResults = await searchBing(topic, maxResults - allDiscoveries.length);
        if (bingResults.length > 0) {
            console.log(`[RSS Discovery] Bing found ${bingResults.length} feeds`);
            for (const feed of bingResults) {
                if (!allDiscoveries.some(d => d.feed_url === feed.feed_url)) {
                    allDiscoveries.push(feed);
                }
            }
        }
    }

    if (allDiscoveries.length === 0) {
        console.log(`[RSS Discovery] No results found for: "${topic}"`);
    }

    return allDiscoveries.slice(0, maxResults);
}

/**
 * Search using DuckDuckGo HTML (free, no API key)
 */
async function searchDuckDuckGo(topic: string, limit: number): Promise<DiscoveredFeedType[]> {
    try {
        // Try multiple search query variations
        const queryVariations = [
            `${topic} RSS feed`,
            `${topic} news feed`,
            `${topic} blog RSS`,
        ];

        for (const query of queryVariations) {
            const results = await searchDuckDuckGoQuery(query, limit);
            if (results.length > 0) {
                return results;
            }
        }

        return [];
    } catch (err) {
        console.error('[RSS Discovery] DuckDuckGo search failed:', err);
        return [];
    }
}

/**
 * Perform a single DuckDuckGo search query
 */
async function searchDuckDuckGoQuery(query: string, limit: number): Promise<DiscoveredFeedType[]> {
    try {
        const response = await fetch(
            `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`,
            {
                headers: { 'User-Agent': USER_AGENT },
                signal: AbortSignal.timeout(15000),
            }
        );

        if (!response.ok) return [];

        const html = await response.text();
        const urls = new Set<string>();

        // Better URL extraction - target actual search result links
        // DuckDuckGo HTML version uses 'result' class and 'href' in anchor tags
        const linkPatterns = [
            // Match result links (the a tags with results)
            /<a[^>]+class="[^"]*result[^"]*"[^>]+href="([^"]+)"/gi,
            // Match any external link
            /href="(https?:\/\/[^\s"<>]+)"/gi,
        ];

        for (const pattern of linkPatterns) {
            let match;
            while ((match = pattern.exec(html)) !== null) {
                const url = match[1];
                if (!url || url.includes('duckduckgo') || url.includes('yahoo.com') || url.includes('bing.com')) {
                    continue;
                }
                try {
                    const urlObj = new URL(url);
                    // Exclude DuckDuckGo itself and other search engines
                    if (!urlObj.hostname.includes('duckduckgo') && 
                        !urlObj.hostname.includes('yahoo') && 
                        !urlObj.hostname.includes('bing') &&
                        url.startsWith('http')) {
                        urls.add(urlObj.origin + urlObj.pathname);
                    }
                } catch {
                    // Invalid URL, skip
                }
            }
        }

        // Discover feeds from each URL
        const discoveries: DiscoveredFeedType[] = [];
        const siteList = Array.from(urls).slice(0, 10);

        for (const siteUrl of siteList) {
            try {
                const feeds = await discoverFeedsFromUrl(siteUrl);
                for (const feed of feeds) {
                    if (feed.type === 'rss') {
                        discoveries.push(feed);
                    }
                }
            } catch {
                // Continue on error
            }

            if (discoveries.length >= limit) break;
        }

        return discoveries.slice(0, limit);
    } catch {
        return [];
    }
}

/**
 * Search using Bing Web Search API (requires API key)
 */
async function searchBing(topic: string, limit: number): Promise<DiscoveredFeedType[]> {
    try {
        const query = encodeURIComponent(`${topic} RSS`);
        const response = await fetch(
            `https://www.bing.com/search?q=${query}`,
            {
                headers: { 'User-Agent': USER_AGENT },
                signal: AbortSignal.timeout(15000),
            }
        );

        if (!response.ok) return [];

        const html = await response.text();
        const siteUrls: string[] = [];

        // Extract search result URLs
        const linkRegex = /href="([^"]* bing\.com\/ck\/a|https?:\/\/[^"|]*[^0-9])/g;
        const urls = new Set<string>();
        let match;

        while ((match = linkRegex.exec(html)) !== null) {
            try {
                const url = match[1];
                const urlObj = new URL(url);
                if (urlObj.hostname !== 'bing.com' && url.startsWith('http')) {
                    urls.add(urlObj.origin + urlObj.pathname);
                }
            } catch {
                // Continue
            }
        }

        // Discover feeds from URLs
        const discoveries: DiscoveredFeedType[] = [];
        const siteList = Array.from(urls).slice(0, 10);

        for (const siteUrl of siteList) {
            try {
                const feeds = await discoverFeedsFromUrl(siteUrl);
                for (const feed of feeds) {
                    if (feed.type === 'rss') {
                        discoveries.push(feed);
                    }
                }
            } catch {
                // Continue
            }

            if (discoveries.length >= limit) break;
        }

        return discoveries.slice(0, limit);
    } catch (err) {
        console.error('[RSS Discovery] Bing search failed:', err);
        return [];
    }
}

/**
 * Search using feed directories and aggregators (free)
 */
async function searchFeedDirectories(topic: string, limit: number): Promise<DiscoveredFeedType[]> {
    const discoveries: DiscoveredFeedType[] = [];

    try {
        // Search using public feed APIs
        const searchUrls = [
            `https://api.allorigins.win/raw?url=${encodeURIComponent(`https://feedly.com/i/discover/search/feeds?query=${encodeURIComponent(topic)}`)}`,
        ];

        for (const searchUrl of searchUrls) {
            try {
                const response = await fetch(searchUrl, {
                    headers: { 'User-Agent': USER_AGENT },
                    signal: AbortSignal.timeout(10000),
                });

                if (response.ok) {
                    const data = await response.json();
                    if (data.results && Array.isArray(data.results)) {
                        for (const item of data.results) {
                            if (item.feedId) {
                                discoveries.push({
                                    type: 'rss',
                                    title: item.title || topic,
                                    feed_url: item.feedId,
                                    site_url: item.website || item.feedId,
                                    icon_url: item.visual?.url || null,
                                    confidence: 0.85,
                                    method: 'directory',
                                });
                            }
                        }
                    }
                }
            } catch {
                // Continue to next directory
            }

            if (discoveries.length >= limit) break;
        }

        return discoveries.slice(0, limit);
    } catch (err) {
        console.error('[RSS Discovery] Directory search failed:', err);
        return [];
    }
}
