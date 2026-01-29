import { FeedType } from '../feed-parser.js';

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';

// Number of weeks to consider a feed "active"
const ACTIVITY_THRESHOLD_WEEKS = 6;

export interface YouTubeRecommendation {
    channelId: string;
    title: string;
    description: string;
    thumbnailUrl: string;
    subscriberCount?: string;
    videoCount?: string;
    lastVideoDate?: string;
    isActive?: boolean;
}

/**
 * Check if a YouTube channel has recent activity
 */
async function checkChannelActivity(channelId: string): Promise<{ isActive: boolean; lastVideoDate?: string }> {
    if (!YOUTUBE_API_KEY) {
        return { isActive: true }; // Can't check without API key, assume active
    }

    try {
        // Get the most recent video
        const searchUrl = `${YOUTUBE_API_BASE}/search?part=snippet&channelId=${channelId}&type=video&order=date&maxResults=1&key=${YOUTUBE_API_KEY}`;
        const searchResponse = await fetch(searchUrl);
        
        if (!searchResponse.ok) {
            return { isActive: false };
        }

        const searchData = await searchResponse.json();
        const videos = searchData.items || [];

        if (videos.length === 0) {
            return { isActive: false };
        }

        const lastVideoDate = new Date(videos[0].snippet.publishedAt);
        const threshold = new Date();
        threshold.setDate(threshold.getDate() - (ACTIVITY_THRESHOLD_WEEKS * 7));

        return {
            isActive: lastVideoDate >= threshold,
            lastVideoDate: videos[0].snippet.publishedAt
        };
    } catch (err) {
        console.error(`Failed to check activity for channel ${channelId}:`, err);
        return { isActive: true }; // Assume active on error
    }
}

/**
 * Search for YouTube channels based on a topic string
 * Only returns channels with recent activity (within last 6 weeks)
 */
export async function searchYouTubeChannels(topic: string, maxResults: number = 5): Promise<YouTubeRecommendation[]> {
    if (!YOUTUBE_API_KEY) {
        console.warn('YOUTUBE_API_KEY not set, skipping YouTube discovery');
        return [];
    }

    try {
        // 1. Search for channels by topic (get more to account for filtering)
        const searchUrl = `${YOUTUBE_API_BASE}/search?part=snippet&type=channel&q=${encodeURIComponent(topic)}&maxResults=${maxResults * 3}&key=${YOUTUBE_API_KEY}`;
        const searchResponse = await fetch(searchUrl);
        if (!searchResponse.ok) return [];

        const searchData = await searchResponse.json();
        const channelIds = searchData.items?.map((item: any) => item.snippet.channelId).filter(Boolean) || [];

        if (channelIds.length === 0) return [];

        // 2. Get detailed channel info (subscriber count, video count)
        const detailsUrl = `${YOUTUBE_API_BASE}/channels?part=snippet,statistics&id=${channelIds.join(',')}&key=${YOUTUBE_API_KEY}`;
        const detailsResponse = await fetch(detailsUrl);
        if (!detailsResponse.ok) return [];

        const detailsData = await detailsResponse.json();

        const channels = detailsData.items?.map((item: any) => ({
            channelId: item.id,
            title: item.snippet.title,
            description: item.snippet.description,
            thumbnailUrl: item.snippet.thumbnails?.default?.url,
            subscriberCount: item.statistics.subscriberCount,
            videoCount: item.statistics.videoCount,
        })) || [];

        // 3. Check activity for each channel and filter out stale ones
        const channelsWithActivity = await Promise.all(
            channels.map(async (channel: YouTubeRecommendation) => {
                const activity = await checkChannelActivity(channel.channelId);
                return {
                    ...channel,
                    isActive: activity.isActive,
                    lastVideoDate: activity.lastVideoDate
                };
            })
        );

        // Filter to only active channels and return up to maxResults
        const activeChannels = channelsWithActivity.filter(c => c.isActive);
        
        if (activeChannels.length === 0) {
            console.log(`[YouTube Discovery] No active channels found for topic: ${topic}`);
        } else {
            console.log(`[YouTube Discovery] Found ${activeChannels.length}/${channels.length} active channels for topic: ${topic}`);
        }

        return activeChannels.slice(0, maxResults);
    } catch (err) {
        console.error('YouTube search failed:', err);
        return [];
    }
}

/**
 * Find related channels for a given channel ID
 * Only returns channels with recent activity
 */
export async function findRelatedChannels(channelId: string, maxResults: number = 5): Promise<YouTubeRecommendation[]> {
    if (!YOUTUBE_API_KEY) return [];

    try {
        // YouTube doesn't have a direct "related channels" API anymore in v3 for all channels,
        // but we can search for channels related to the topic of the current one or from its playlists if needed.
        // For now, we'll use keyword-based search using the channel's title/description as a proxy for similarity.

        const channelInfoUrl = `${YOUTUBE_API_BASE}/channels?part=snippet&id=${channelId}&key=${YOUTUBE_API_KEY}`;
        const infoResponse = await fetch(channelInfoUrl);
        if (!infoResponse.ok) return [];
        const infoData = await infoResponse.json();
        const title = infoData.items?.[0]?.snippet?.title;

        if (!title) return [];

        return await searchYouTubeChannels(title, maxResults);
    } catch (err) {
        console.error('YouTube related channels search failed:', err);
        return [];
    }
}
