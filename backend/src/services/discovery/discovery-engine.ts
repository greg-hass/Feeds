import { queryAll, queryOne, run } from '../../db/index.js';
import { GEMINI_API_KEY, GEMINI_API_URL } from '../ai.js';
import { searchYouTubeChannels } from './youtube.js';
import { searchRssFeeds } from './rss.js';
import { checkFeedActivity } from './activity-check.js';

export async function refreshRecommendations(userId: number = 1): Promise<void> {
    if (!GEMINI_API_KEY) return;

    try {
        // 1. Get user interests
        const interests = queryAll<{ topic: string }>(
            'SELECT topic FROM user_interests WHERE user_id = ? ORDER BY confidence DESC LIMIT 5',
            [userId]
        );

        const topics = interests.map(i => i.topic);
        if (topics.length === 0) {
            // Fallback: use current feed categories or a default list if no interests yet
            topics.push('technology', 'programming', 'world news');
        }

        // 2. Discover from multiple sources for each topic
        // Note: searchYouTubeChannels and searchRssFeeds now already filter for active feeds
        const allDiscovered: any[] = [];

        for (const topic of topics) {
            const [ytItems, rssItems] = await Promise.all([
                searchYouTubeChannels(topic, 3),
                searchRssFeeds(topic, 3)
            ]);

            allDiscovered.push(...ytItems.map(item => ({ ...item, type: 'youtube' })));
            allDiscovered.push(...rssItems.map(item => ({
                channelId: item.feed_url,
                title: item.title,
                description: '',
                thumbnailUrl: item.icon_url,
                type: item.type,
                feedUrl: item.feed_url
            })));
        }

        console.log(`[Discovery Engine] Found ${allDiscovered.length} active feeds for user ${userId}`);

        // 3. Filter out already subscribed
        const subscribedUrls = new Set(
            queryAll<{ url: string }>('SELECT url FROM feeds WHERE user_id = ?', [userId]).map(f => f.url)
        );

        const candidates = allDiscovered.filter(c => !subscribedUrls.has(c.feedUrl || `https://www.youtube.com/feeds/videos.xml?channel_id=${c.channelId}`));

        if (candidates.length === 0) return;

        // 4. Use Gemini to rank and reason
        const prompt = `Given the following user interests: ${topics.join(', ')}.
Rank these potential feed recommendations and provide a short "reason" (max 10 words) for each.
Return the result as a raw JSON array of objects with "id" (matching the index in candidates), "score" (0-100), and "reason".

Candidates:
${candidates.map((c, i) => `${i}: ${c.title} - ${c.description || ''}`).join('\n')}
`;

        const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { temperature: 0.1 }
            })
        });

        if (!response.ok) return;
        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) return;

        const jsonMatch = text.match(/\[.*\]/s);
        const ranked = JSON.parse(jsonMatch ? jsonMatch[0] : text);

        // 5. Save to database
        for (const r of ranked) {
            const c = candidates[r.id];
            if (!c) continue;

            const feedUrl = c.feedUrl || `https://www.youtube.com/feeds/videos.xml?channel_id=${c.channelId}`;

            run(
                `INSERT INTO feed_recommendations 
                (user_id, feed_url, feed_type, title, description, relevance_score, reason, metadata, status, discovered_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', datetime('now'))
                 ON CONFLICT(user_id, feed_url) DO UPDATE SET
                    relevance_score = ?,
                    reason = ?,
                    discovered_at = datetime('now')`,
                [
                    userId,
                    feedUrl,
                    c.type,
                    c.title,
                    c.description || '',
                    r.score,
                    r.reason,
                    JSON.stringify({ 
                        thumbnail: c.thumbnailUrl, 
                        subs: c.subscriberCount,
                        lastActive: c.lastVideoDate || (c as any).lastPostDate
                    }),
                    r.score,
                    r.reason
                ]
            );
        }
    } catch (err) {
        console.error('Refresh recommendations failed:', err);
    }
}
