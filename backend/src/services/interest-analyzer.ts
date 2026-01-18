import { queryAll, queryOne, run } from '../db/index.js';
import { GEMINI_API_KEY, GEMINI_API_URL } from './ai.js';

export async function analyzeUserInterests(userId: number = 1): Promise<void> {
    if (!GEMINI_API_KEY) return;

    try {
        // 1. Get recently read articles (last 50)
        const recentlyRead = queryAll<{ title: string; summary: string | null }>(
            `SELECT a.title, a.summary
             FROM articles a
             JOIN read_state rs ON rs.article_id = a.id
             WHERE rs.user_id = ? AND rs.is_read = 1
             ORDER BY rs.read_at DESC
             LIMIT 50`,
            [userId]
        );

        if (recentlyRead.length < 5) return; // Need a minimum signal

        // 2. Ask Gemini to extract topics
        const prompt = `Analyze the following list of article titles and summaries that a user has read. 
Identify the top 5-10 specific interest topics or categories.
Return the result as a raw JSON array of strings. Do not include any other text.

Articles:
${recentlyRead.map(a => `- ${a.title}: ${a.summary?.substring(0, 100)}`).join('\n')}
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

        // Clean up markdown
        const jsonMatch = text.match(/\[.*\]/s);
        const jsonStr = jsonMatch ? jsonMatch[0] : text;
        const topics = JSON.parse(jsonStr);

        if (!Array.isArray(topics)) return;

        // 3. Update user_interests table
        for (const topic of topics) {
            run(
                `INSERT INTO user_interests (user_id, topic, source, confidence, created_at)
                 VALUES (?, ?, 'derived', 0.8, datetime('now'))
                 ON CONFLICT(user_id, topic) DO UPDATE SET 
                    confidence = MIN(1.0, confidence + 0.1),
                    created_at = datetime('now')`,
                [userId, topic]
            );
        }
    } catch (err) {
        console.error('Interest analysis failed:', err);
    }
}
