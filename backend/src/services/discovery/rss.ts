import { discoverFeedsFromUrl, DiscoveredFeed } from '../discovery.js';
import { checkRssFeedActivity } from './activity-check.js';
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

    // Method 1: DuckDuckGo HTML scraping (free, no API key)
    const duckduckgoResults = await searchDuckDuckGo(topic, maxResults);
    if (duckduckgoResults.length > 0) {
        console.log(`[RSS Discovery] DuckDuckGo found ${duckduckgoResults.length} feeds`);
        return duckduckgoResults;
    }

    // Method 2: Bing Web Search API (free tier available)
    if (GOOGLE_SEARCH_API_KEY && GOOGLE_SEARCH_ENGINE_ID) {
        const bingResults = await searchBing(topic, maxResults);
        if (bingResults.length > 0) {
            console.log(`[RSS Discovery] Bing found ${bingResults.length} feeds`);
            return bingResults;
        }
    }

    // Method 3: Feed目录/aggregator APIs
    const directoryResults = await searchFeedDirectories(topic, maxResults);
    if (directoryResults.length > 0) {
        console.log(`[RSS Discovery] Directories found ${directoryResults.length} feeds`);
        return directoryResults;
    }

    console.log(`[RSS Discovery] No results found for: "${topic}"`);
    return [];
}

/**
 * Search using DuckDuckGo HTML (free, no API key)
 */
async function searchDuckDuckGo(topic: string, limit: number): Promise<DiscoveredFeedType[]> {
    try {
        const query = encodeURIComponent(`${topic} RSS feed`);
        const response = await fetch(
            `https://html.duckduckgo.com/html/?q=${query}`,
            {
                headers: { 'User-Agent': USER_AGENT },
                signal: AbortSignal.timeout(15000),
            }
        );

        if (!response.ok) return [];

        const html = await response.text();
        const siteUrls: string[] = [];

        // Extract URLs from search results
        const urlRegex = /href="([^"]*)"/g;
        const urls = new Set<string>();
        let match;

        while ((match = urlRegex.exec(html)) !== null) {
            const url = match[1];
            if (url && !url.includes('duckduckgo') && url.startsWith('http')) {
                try {
                    const urlObj = new URL(url);
                    if (urlObj.hostname !== 'duckduckgo.com') {
                        urls.add(urlObj.origin + urlObj.pathname);
                    }
                } catch {
                    // Invalid URL, skip
                }
            }
        }

        // Discover feeds from each URL
        const discoveries: DiscoveredFeedType[] = [];
        const siteList = Array.from(urls).slice(0, 10); // Limit to 10 URLs

        for (const siteUrl of siteList) {
            try {
                const feeds = await discoverFeedsFromUrl(siteUrl);
                for (const feed of feeds) {
                    if (feed.type === 'rss' || feed.type === 'podcast') {
                        discoveries.push(feed);
                    }
                }
            } catch {
                // Continue on error
            }

            if (discoveries.length >= limit) break;
        }

        return discoveries.slice(0, limit);
    } catch (err) {
        console.error('[RSS Discovery] DuckDuckGo search failed:', err);
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
                    discoveries.push(feed);
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
