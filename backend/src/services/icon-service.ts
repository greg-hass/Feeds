import { fetchYouTubeIcon, fetchRedditIcon } from './feed-parser.js';

type PlatformType = 'youtube' | 'reddit' | 'generic';

interface IconCache {
    url: string;
    timestamp: number;
}

class IconService {
    private cache: Map<string, IconCache> = new Map();
    private CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

    private getCacheKey(platform: PlatformType, identifier: string): string {
        return `${platform}:${identifier}`;
    }

    private isCacheValid(cacheEntry: IconCache): boolean {
        return Date.now() - cacheEntry.timestamp < this.CACHE_TTL;
    }

    private getCachedIcon(platform: PlatformType, identifier: string): string | null {
        const key = this.getCacheKey(platform, identifier);
        const cached = this.cache.get(key);
        
        if (cached && this.isCacheValid(cached)) {
            return cached.url;
        }
        
        return null;
    }

    private setCachedIcon(platform: PlatformType, identifier: string, url: string): void {
        const key = this.getCacheKey(platform, identifier);
        this.cache.set(key, { url, timestamp: Date.now() });
    }

    async getYouTubeIcon(channelId: string): Promise<string | null> {
        if (!channelId) return null;

        const cached = this.getCachedIcon('youtube', channelId);
        if (cached) return cached;

        const icon = await fetchYouTubeIcon(channelId);
        if (icon) {
            this.setCachedIcon('youtube', channelId, icon);
        }

        return icon;
    }

    async getRedditIcon(subreddit: string): Promise<string | null> {
        if (!subreddit) return null;

        const cached = this.getCachedIcon('reddit', subreddit);
        if (cached) return cached;

        const icon = await fetchRedditIcon(subreddit);
        if (icon) {
            this.setCachedIcon('reddit', subreddit, icon);
        }

        return icon;
    }

    clearCache(): void {
        this.cache.clear();
    }
}

export const iconService = new IconService();
export default iconService;
