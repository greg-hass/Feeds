import { Feed, DiscoveredFeed } from '@/services/api';

/**
 * Check if a discovered feed is already in the user's subscriptions
 */
export const isDuplicateFeed = (
    discovered: DiscoveredFeed,
    existingFeeds: Feed[]
): boolean => {
    const discoveredUrl = normalizeFeedUrl(discovered.feed_url);
    
    return existingFeeds.some((feed) => {
        const existingUrl = normalizeFeedUrl(feed.url);
        return existingUrl === discoveredUrl;
    });
};

/**
 * Normalize feed URL for comparison
 */
const normalizeFeedUrl = (url: string): string => {
    try {
        const urlObj = new URL(url);
        // Remove trailing slashes and normalize protocol
        return `${urlObj.protocol}//${urlObj.host}${urlObj.pathname.replace(/\/$/, '')}${urlObj.search}`;
    } catch {
        return url.toLowerCase().trim();
    }
};

/**
 * Suggest a folder name based on feed type and content
 */
export const suggestFolderName = (
    feedType: string,
    feedTitle?: string
): string | null => {
    // Type-based suggestions
    const typeSuggestions: Record<string, string> = {
        youtube: 'YouTube',
        podcast: 'Podcasts',
        reddit: 'Reddit',
    };

    if (typeSuggestions[feedType]) {
        return typeSuggestions[feedType];
    }

    // Content-based suggestions from title
    if (feedTitle) {
        const title = feedTitle.toLowerCase();
        
        const keywordMap: Record<string, string[]> = {
            'Tech': ['tech', 'software', 'programming', 'code', 'developer', 'ai', 'startup'],
            'News': ['news', 'breaking', 'daily', 'update'],
            'Blogs': ['blog', 'personal', 'life'],
            'Science': ['science', 'research', 'physics', 'biology', 'space'],
            'Design': ['design', 'ux', 'ui', 'creative', 'art'],
            'Business': ['business', 'finance', 'money', 'invest', 'crypto'],
        };

        for (const [folder, keywords] of Object.entries(keywordMap)) {
            if (keywords.some((kw) => title.includes(kw))) {
                return folder;
            }
        }
    }

    return null;
};

/**
 * Extract domain from URL for display
 */
export const extractDomain = (url: string): string => {
    try {
        const urlObj = new URL(url);
        return urlObj.hostname.replace(/^www\./, '');
    } catch {
        return url;
    }
};

/**
 * Format subscriber count for display
 */
export const formatSubscriberCount = (count?: number): string => {
    if (!count || count < 0) return '';
    
    if (count >= 1_000_000) {
        return `${(count / 1_000_000).toFixed(1)}M`;
    }
    if (count >= 1_000) {
        return `${(count / 1_000).toFixed(1)}K`;
    }
    return count.toString();
};
