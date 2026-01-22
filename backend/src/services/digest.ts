import { queryAll, queryOne, run } from '../db/index.js';
import { GEMINI_API_KEY, GEMINI_API_URL } from './ai.js';

export type DigestEdition = 'morning' | 'evening';

export interface GenerateDigestResult {
    success: boolean;
    digestId?: number;
    error?: string;
}

/**
 * Determine which edition based on current hour
 */
export function getCurrentEdition(): DigestEdition {
    const hour = new Date().getHours();
    return hour < 14 ? 'morning' : 'evening';
}

/**
 * Extract topic headers from markdown content (## headers)
 */
function extractTopics(markdown: string): string[] {
    const headerRegex = /^##\s+(.+)$/gm;
    const topics: string[] = [];
    let match;
    while ((match = headerRegex.exec(markdown)) !== null) {
        topics.push(match[1].trim());
    }
    return topics.slice(0, 5); // Max 5 topics
}

/**
 * Generate a title based on edition and top topics
 */
function generateTitle(edition: DigestEdition, topics: string[]): string {
    const editionLabel = edition === 'morning' ? 'Morning Edition' : 'Evening Edition';
    if (topics.length === 0) return `Your Daily Digest - ${editionLabel}`;
    return `Your Daily Digest - ${editionLabel}`;
}

export async function generateDailyDigest(
    userId: number = 1,
    edition?: DigestEdition
): Promise<GenerateDigestResult> {
    if (!GEMINI_API_KEY) {
        console.warn('GEMINI_API_KEY not set, skipping digest generation');
        return { success: false, error: 'API key not configured' };
    }

    const digestEdition = edition || getCurrentEdition();

    try {
        // 1. Get digest settings
        const settings = queryOne<{ enabled: number; included_feeds: string | null; style: string }>(
            'SELECT enabled, included_feeds, style FROM digest_settings WHERE user_id = ?',
            [userId]
        );

        if (settings && !settings.enabled) {
            return { success: false, error: 'Digest is disabled' };
        }

        // 2. Check if we already generated a digest for this edition today
        const today = new Date().toISOString().split('T')[0];
        const existingDigest = queryOne<{ id: number }>(
            `SELECT id FROM digests 
             WHERE user_id = ? AND edition = ? AND date(generated_at) = ?`,
            [userId, digestEdition, today]
        );

        if (existingDigest) {
            console.log(`[Digest] Already generated ${digestEdition} edition for today`);
            return { success: true, digestId: existingDigest.id };
        }

        // 3. Fetch unread articles from the last 24 hours
        let query = `
            SELECT a.title, a.summary, a.url, f.title as feed_title, f.type as feed_type
            FROM articles a
            JOIN feeds f ON f.id = a.feed_id
            LEFT JOIN read_state rs ON rs.article_id = a.id AND rs.user_id = ?
            WHERE f.user_id = ? AND f.deleted_at IS NULL 
            AND (rs.is_read IS NULL OR rs.is_read = 0)
            AND a.published_at >= datetime('now', '-24 hours')
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

        if (unreadArticles.length === 0) {
            console.log(`[Digest] No new articles for ${digestEdition} edition`);
            return { success: false, error: 'No new articles to summarize' };
        }

        // 4. Prepare prompt
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

        const editionName = digestEdition === 'morning' ? 'Morning' : 'Evening';
        const stylePrompt = settings?.style === 'paragraphs'
            ? 'Write a cohesive narrative summary in paragraphs, grouped by topic.'
            : 'Provide a structured summary using bullet points, grouped clearly by topic.';

        const prompt = `You are a helpful reading assistant. Generate a "${editionName} Digest" summarizing the following ${unreadArticles.length} articles.
${stylePrompt}

IMPORTANT FORMATTING:
- Use ## headers for each topic group (these will be extracted as preview topics)
- Include links to articles where available
- Make the tone professional yet engaging
- Group related stories together under interesting, descriptive headers
- Start with a brief 1-2 sentence overview

Articles to summarize:
${JSON.stringify(articleData)}

Return your response as Markdown.`;

        // 5. Call Gemini
        console.log(`[Digest] Generating ${digestEdition} edition with ${unreadArticles.length} articles...`);
        
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
            const errorText = await response.text();
            console.error('Gemini API error for digest:', errorText);
            return { success: false, error: 'AI generation failed' };
        }

        const data = await response.json();
        const digestContent = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!digestContent) {
            return { success: false, error: 'Empty response from AI' };
        }

        // 6. Extract metadata
        const topics = extractTopics(digestContent);
        const title = generateTitle(digestEdition, topics);
        const feedCount = new Set(unreadArticles.map(a => a.feed_title)).size;

        // 7. Store digest
        const result = run(
            `INSERT INTO digests (user_id, content, article_count, feed_count, edition, title, topics, generated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
            [userId, digestContent, unreadArticles.length, feedCount, digestEdition, title, JSON.stringify(topics)]
        );

        console.log(`[Digest] Generated ${digestEdition} edition: ${topics.length} topics, ${unreadArticles.length} articles`);

        return { success: true, digestId: result.lastInsertRowid as number };
    } catch (err) {
        console.error('Failed to generate daily digest:', err);
        return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
}

