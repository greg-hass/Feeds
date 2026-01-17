const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

export interface AiSuggestedUrl {
    url: string;
    title: string;
    reason: string;
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
