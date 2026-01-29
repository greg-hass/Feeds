/**
 * Feed Activity Checker
 * Validates that feeds have recent content (within last 4-6 weeks)
 */

import FeedParser from 'feedparser';
import { Readable } from 'stream';

const USER_AGENT = 'Feeds/1.0 (Feed Reader; +https://github.com/greg-hass/Feeds)';

// Number of weeks to consider a feed "active"
const ACTIVITY_THRESHOLD_WEEKS = 6;

export interface ActivityCheckResult {
    isActive: boolean;
    lastPostDate: Date | null;
    daysSinceLastPost: number | null;
}

/**
 * Check if a date is within the activity threshold
 */
export function isDateActive(date: Date): boolean {
    const threshold = new Date();
    threshold.setDate(threshold.getDate() - (ACTIVITY_THRESHOLD_WEEKS * 7));
    return date >= threshold;
}

/**
 * Check RSS/Atom feed activity by parsing the feed and checking latest post date
 */
export async function checkRssFeedActivity(feedUrl: string): Promise<ActivityCheckResult> {
    try {
        const response = await fetch(feedUrl, {
            headers: { 'User-Agent': USER_AGENT },
            signal: AbortSignal.timeout(15000),
        });

        if (!response.ok) {
            return { isActive: false, lastPostDate: null, daysSinceLastPost: null };
        }

        const feedText = await response.text();
        
        return new Promise((resolve) => {
            const feedparser = new FeedParser({});
            let latestDate: Date | null = null;
            let itemCount = 0;

            feedparser.on('readable', () => {
                let item: any;
                while ((item = feedparser.read())) {
                    itemCount++;
                    if (item.pubdate) {
                        const itemDate = new Date(item.pubdate);
                        if (!latestDate || itemDate > latestDate) {
                            latestDate = itemDate;
                        }
                    }
                    // Only check first 10 items to avoid parsing entire feed
                    if (itemCount >= 10) break;
                }
            });

            feedparser.on('end', () => {
                if (!latestDate) {
                    resolve({ isActive: false, lastPostDate: null, daysSinceLastPost: null });
                    return;
                }

                const daysSinceLastPost = Math.floor((Date.now() - latestDate.getTime()) / (1000 * 60 * 60 * 24));
                resolve({
                    isActive: isDateActive(latestDate),
                    lastPostDate: latestDate,
                    daysSinceLastPost
                });
            });

            feedparser.on('error', () => {
                resolve({ isActive: false, lastPostDate: null, daysSinceLastPost: null });
            });

            // Feed the parser
            const stream = Readable.from([feedText]);
            stream.pipe(feedparser);
        });
    } catch (err) {
        return { isActive: false, lastPostDate: null, daysSinceLastPost: null };
    }
}

/**
 * Check YouTube channel activity using YouTube API
 * Requires YOUTUBE_API_KEY to be set
 */
export async function checkYouTubeChannelActivity(channelId: string): Promise<ActivityCheckResult> {
    const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
    
    if (!YOUTUBE_API_KEY) {
        // If no API key, we can't check activity - assume active
        return { isActive: true, lastPostDate: null, daysSinceLastPost: null };
    }

    try {
        // Search for recent videos from this channel
        const sixWeeksAgo = new Date();
        sixWeeksAgo.setDate(sixWeeksAgo.getDate() - (ACTIVITY_THRESHOLD_WEEKS * 7));
        const publishedAfter = sixWeeksAgo.toISOString();

        const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&type=video&order=date&maxResults=1&publishedAfter=${encodeURIComponent(publishedAfter)}&key=${YOUTUBE_API_KEY}`;
        
        const response = await fetch(searchUrl);
        if (!response.ok) {
            return { isActive: false, lastPostDate: null, daysSinceLastPost: null };
        }

        const data = await response.json();
        const videos = data.items || [];

        if (videos.length === 0) {
            // No videos in last 6 weeks - check when last video was published
            const lastVideoUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&type=video&order=date&maxResults=1&key=${YOUTUBE_API_KEY}`;
            const lastVideoResponse = await fetch(lastVideoUrl);
            
            if (!lastVideoResponse.ok) {
                return { isActive: false, lastPostDate: null, daysSinceLastPost: null };
            }

            const lastVideoData = await lastVideoResponse.json();
            const lastVideo = lastVideoData.items?.[0];

            if (!lastVideo) {
                return { isActive: false, lastPostDate: null, daysSinceLastPost: null };
            }

            const lastPostDate = new Date(lastVideo.snippet.publishedAt);
            const daysSinceLastPost = Math.floor((Date.now() - lastPostDate.getTime()) / (1000 * 60 * 60 * 24));
            
            return {
                isActive: false,
                lastPostDate,
                daysSinceLastPost
            };
        }

        // Has recent videos
        const lastPostDate = new Date(videos[0].snippet.publishedAt);
        const daysSinceLastPost = Math.floor((Date.now() - lastPostDate.getTime()) / (1000 * 60 * 60 * 24));

        return {
            isActive: true,
            lastPostDate,
            daysSinceLastPost
        };
    } catch (err) {
        console.error('YouTube activity check failed:', err);
        return { isActive: false, lastPostDate: null, daysSinceLastPost: null };
    }
}

/**
 * Check Reddit subreddit activity by fetching recent posts
 */
export async function checkRedditActivity(subredditName: string): Promise<ActivityCheckResult> {
    try {
        const response = await fetch(`https://www.reddit.com/r/${subredditName}/new.json?limit=10`, {
            headers: { 'User-Agent': USER_AGENT },
            signal: AbortSignal.timeout(10000),
        });

        if (!response.ok) {
            return { isActive: false, lastPostDate: null, daysSinceLastPost: null };
        }

        const data = await response.json();
        const posts = data.data?.children || [];

        if (posts.length === 0) {
            return { isActive: false, lastPostDate: null, daysSinceLastPost: null };
        }

        // Get the most recent post date
        const lastPost = posts[0].data;
        const lastPostDate = new Date(lastPost.created_utc * 1000);
        const daysSinceLastPost = Math.floor((Date.now() - lastPostDate.getTime()) / (1000 * 60 * 60 * 24));

        return {
            isActive: isDateActive(lastPostDate),
            lastPostDate,
            daysSinceLastPost
        };
    } catch (err) {
        return { isActive: false, lastPostDate: null, daysSinceLastPost: null };
    }
}

/**
 * Generic feed activity check based on feed type
 */
export async function checkFeedActivity(
    feedUrl: string, 
    feedType: 'rss' | 'youtube' | 'reddit' | 'podcast'
): Promise<ActivityCheckResult> {
    switch (feedType) {
        case 'youtube': {
            // Extract channel ID from YouTube feed URL
            const channelMatch = feedUrl.match(/channel_id=([a-zA-Z0-9_-]+)/);
            if (channelMatch) {
                return checkYouTubeChannelActivity(channelMatch[1]);
            }
            return { isActive: true, lastPostDate: null, daysSinceLastPost: null }; // Can't check, assume active
        }
        case 'reddit': {
            // Extract subreddit name from Reddit feed URL
            const subredditMatch = feedUrl.match(/\/r\/([a-zA-Z0-9_]+)/);
            if (subredditMatch) {
                return checkRedditActivity(subredditMatch[1]);
            }
            return { isActive: true, lastPostDate: null, daysSinceLastPost: null };
        }
        case 'rss':
        case 'podcast':
        default:
            return checkRssFeedActivity(feedUrl);
    }
}
