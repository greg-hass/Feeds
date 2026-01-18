import { FeedType } from '../feed-parser.js';

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';

export interface YouTubeRecommendation {
    channelId: string;
    title: string;
    description: string;
    thumbnailUrl: string;
    subscriberCount?: string;
    videoCount?: string;
    lastVideoDate?: string;
}

/**
 * Search for YouTube channels based on a topic string
 */
export async function searchYouTubeChannels(topic: string, maxResults: number = 5): Promise<YouTubeRecommendation[]> {
    if (!YOUTUBE_API_KEY) {
        console.warn('YOUTUBE_API_KEY not set, skipping YouTube discovery');
        return [];
    }

    try {
        // 1. Search for channels by topic
        const searchUrl = `${YOUTUBE_API_BASE}/search?part=snippet&type=channel&q=${encodeURIComponent(topic)}&maxResults=${maxResults}&key=${YOUTUBE_API_KEY}`;
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

        return detailsData.items?.map((item: any) => ({
            channelId: item.id,
            title: item.snippet.title,
            description: item.snippet.description,
            thumbnailUrl: item.snippet.thumbnails?.default?.url,
            subscriberCount: item.statistics.subscriberCount,
            videoCount: item.statistics.videoCount,
        })) || [];
    } catch (err) {
        console.error('YouTube search failed:', err);
        return [];
    }
}

/**
 * Find related channels for a given channel ID
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
