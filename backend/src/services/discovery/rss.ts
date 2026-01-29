import { discoverFeedsFromUrl, DiscoveredFeed } from '../discovery.js';
import { checkRssFeedActivity } from './activity-check.js';

const GOOGLE_SEARCH_API_KEY = process.env.GOOGLE_SEARCH_API_KEY;
const GOOGLE_SEARCH_ENGINE_ID = process.env.GOOGLE_SEARCH_ENGINE_ID;

/**
 * Search for RSS feeds based on a topic string using Google Custom Search
 * Only returns feeds with recent activity (within last 6 weeks)
 */
export async function searchRssFeeds(topic: string, maxResults: number = 5): Promise<DiscoveredFeed[]> {
    if (!GOOGLE_SEARCH_API_KEY || !GOOGLE_SEARCH_ENGINE_ID) {
        console.warn('Google Search API credentials not set, skipping RSS-specific discovery');
        return [];
    }

    try {
        const query = encodeURIComponent(`${topic} blog rss`);
        const url = `https://www.googleapis.com/customsearch/v1?q=${query}&key=${GOOGLE_SEARCH_API_KEY}&cx=${GOOGLE_SEARCH_ENGINE_ID}&num=${maxResults * 2}`;

        const response = await fetch(url);
        if (!response.ok) return [];

        const data = await response.json();
        const siteUrls = data.items?.map((item: any) => item.link) || [];

        // Discover feeds from each site
        const discoveryPromises = siteUrls.map(async (siteUrl: string) => {
            try {
                const feeds = await discoverFeedsFromUrl(siteUrl);
                return feeds.slice(0, 2); // Max 2 feeds per site
            } catch {
                return [];
            }
        });

        const results = await Promise.all(discoveryPromises);
        const allFeeds = results.flat();

        // Check activity for each discovered feed
        const feedsWithActivity = await Promise.all(
            allFeeds.map(async (feed) => {
                try {
                    const activity = await checkRssFeedActivity(feed.feed_url);
                    return {
                        ...feed,
                        isActive: activity.isActive,
                        lastPostDate: activity.lastPostDate
                    };
                } catch {
                    return { ...feed, isActive: true }; // Assume active on error
                }
            })
        );

        // Filter to only active feeds
        const activeFeeds = feedsWithActivity.filter(f => f.isActive);
        
        if (activeFeeds.length === 0) {
            console.log(`[RSS Discovery] No active feeds found for topic: ${topic}`);
        } else {
            console.log(`[RSS Discovery] Found ${activeFeeds.length}/${allFeeds.length} active feeds for topic: ${topic}`);
        }

        return activeFeeds.slice(0, maxResults);
    } catch (err) {
        console.error('RSS search failed:', err);
        return [];
    }
}
