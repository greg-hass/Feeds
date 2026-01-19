import { queryAll, queryOne, run } from '../db/index.js';
import { GEMINI_API_KEY, GEMINI_API_URL } from './ai.js';

export async function generateDailyDigest(userId: number = 1): Promise<boolean> {
    if (!GEMINI_API_KEY) {
        console.warn('GEMINI_API_KEY not set, skipping digest generation');
        return false;
    }

    try {
        // 1. Get digest settings
        const settings = queryOne<{ enabled: number; included_feeds: string | null; style: string }>(
            'SELECT enabled, included_feeds, style FROM digest_settings WHERE user_id = ?',
            [userId]
        );

        if (settings && !settings.enabled) return false;

        // 2. Fetch unread articles
        let query = `
            SELECT a.title, a.summary, a.url, f.title as feed_title, f.type as feed_type
            FROM articles a
            JOIN feeds f ON f.id = a.feed_id
            LEFT JOIN read_state rs ON rs.article_id = a.id AND rs.user_id = ?
            WHERE f.user_id = ? AND f.deleted_at IS NULL AND (rs.is_read IS NULL OR rs.is_read = 0)
        `;
        const params: any[] = [userId, userId];

        if (settings?.included_feeds) {
            const feedIds = JSON.parse(settings.included_feeds);
            if (Array.isArray(feedIds) && feedIds.length > 0) {
                const placeholders = feedIds.map(() => '?').join(',');
                query += ` AND f.id IN (${placeholders})`;
                params.push(...feedIds);
            }
        }

        query += ' ORDER BY a.published_at DESC LIMIT 100';

        const unreadArticles = queryAll<{
            title: string;
            summary: string | null;
            url: string | null;
            feed_title: string;
            feed_type: string;
        }>(query, params);

        if (unreadArticles.length === 0) return false;

        // 3. Prepare prompt
        const sanitize = (text: string | null | undefined, length: number) => {
            if (!text) return '';
            return text.replace(/[\n\r]/g, ' ').substring(0, length).trim();
        };

        const articleData = unreadArticles.map(a => ({
            title: sanitize(a.title, 100),
            source: sanitize(a.feed_title, 50),
            type: a.feed_type,
            summary: sanitize(a.summary, 200),
            url: a.url
        }));

        const stylePrompt = settings?.style === 'paragraphs'
            ? 'Write a cohesive narrative summary in paragraphs, grouped by topic.'
            : 'Provide a structured summary using bullet points, grouped clearly by topic.';

        const prompt = `You are a helpful reading assistant. Generate a "Daily Digest" summarizing the following ${unreadArticles.length} unread articles.
${stylePrompt}

Include links to the articles where available.
Make the tone professional yet engaging.
Group related stories together under interesting headers.

Articles to summarize:
${JSON.stringify(articleData)}

Return your response as Markdown.`;

        // 4. Call Gemini
        const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    temperature: 0.3,
                    topP: 0.9,
                },
            }),
        });

        if (!response.ok) {
            console.error('Gemini API error for digest:', await response.text());
            return false;
        }

        const data = await response.json();
        const digestContent = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!digestContent) return false;

        // 5. Store digest
        const feedCount = new Set(unreadArticles.map(a => a.feed_title)).size;

        run(
            `INSERT INTO digests (user_id, content, article_count, feed_count, generated_at)
             VALUES (?, ?, ?, ?, datetime('now'))`,
            [userId, digestContent, unreadArticles.length, feedCount]
        );

        return true;
    } catch (err) {
        console.error('Failed to generate daily digest:', err);
        return false;
    }
}
