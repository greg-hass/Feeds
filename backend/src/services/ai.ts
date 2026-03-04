export const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
export const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
export const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
export const GROQ_API_KEY = process.env.GROQ_API_KEY;
export const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
export const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
type DailyDigestAiProvider = 'gemini' | 'groq';
export const DAILY_DIGEST_AI_PROVIDER: DailyDigestAiProvider =
    process.env.DAILY_DIGEST_AI_PROVIDER === 'groq' ? 'groq' : 'gemini';

export interface AiSuggestedUrl {
    url: string;
    title: string;
    reason: string;
}

export interface GenerateTextResult {
    text?: string;
    error?: string;
}

export function canGenerateDailyDigestWithAi(): boolean {
    if (DAILY_DIGEST_AI_PROVIDER === 'groq') {
        return Boolean(GROQ_API_KEY);
    }
    return Boolean(GEMINI_API_KEY);
}

export function getDailyDigestAiProviderName(): string {
    return DAILY_DIGEST_AI_PROVIDER;
}

export async function generateDailyDigestText(prompt: string): Promise<GenerateTextResult> {
    try {
        if (DAILY_DIGEST_AI_PROVIDER === 'groq') {
            if (!GROQ_API_KEY) {
                return { error: 'Groq API key not configured' };
            }

            const response = await fetch(GROQ_API_URL, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${GROQ_API_KEY}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: GROQ_MODEL,
                    messages: [{ role: 'user', content: prompt }],
                    temperature: 0.3,
                    top_p: 0.9,
                }),
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('Groq API error for digest:', errorText);
                return { error: 'AI generation failed' };
            }

            const data = await response.json();
            const text = data.choices?.[0]?.message?.content;
            if (!text) {
                return { error: 'Empty response from AI' };
            }

            return { text };
        }

        if (!GEMINI_API_KEY) {
            return { error: 'Gemini API key not configured' };
        }

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
            return { error: 'AI generation failed' };
        }

        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) {
            return { error: 'Empty response from AI' };
        }

        return { text };
    } catch (err) {
        return { error: err instanceof Error ? err.message : 'Unknown error' };
    }
}

export async function getAiSuggestedFeeds(keyword: string): Promise<AiSuggestedUrl[]> {
    if (!GEMINI_API_KEY) {
        console.warn('GEMINI_API_KEY not set, skipping AI discovery');
        return [];
    }

    const prompt = `You are a feed discovery assistant. Given the keyword "${keyword}", suggest 5-8 high-quality websites, blogs, YouTube channels, or subreddits that likely have RSS or Atom feeds. 
Return the result as a raw JSON array of objects with "url", "title", and "reason" fields.
Make sure the URLs are direct links to the homepages or channel pages.
Do not include any other text in your response, only the raw JSON array.`;

    try {
        const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: [
                    {
                        parts: [
                            {
                                text: prompt,
                            },
                        ],
                    },
                ],
                generationConfig: {
                    temperature: 0.2,
                    topP: 0.8,
                    topK: 40,
                },
            }),
        });

        if (!response.ok) {
            const error = await response.text();
            console.error('Gemini API error:', error);
            return [];
        }

        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!text) return [];

        // Clean up markdown code blocks if present
        const jsonMatch = text.match(/\[.*\]/s);
        const jsonStr = jsonMatch ? jsonMatch[0] : text;

        const suggestions = JSON.parse(jsonStr);
        if (!Array.isArray(suggestions)) return [];

        return suggestions.map(s => ({
            url: s.url,
            title: s.title || 'Suggested Site',
            reason: s.reason || '',
        }));
    } catch (err) {
        console.error('AI suggested feeds failed:', err);
        return [];
    }
}
