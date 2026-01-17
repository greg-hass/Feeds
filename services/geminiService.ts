import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const FEED_SCHEMA = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      title: { type: Type.STRING },
      url: { type: Type.STRING },
      type: { type: Type.STRING, description: 'One of RSS, YOUTUBE, REDDIT, PODCAST' },
      description: { type: Type.STRING, description: 'Short description of the feed if available' }
    },
    required: ['title', 'url', 'type']
  }
};

const ARTICLE_SCHEMA = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      title: { type: Type.STRING },
      url: { type: Type.STRING },
      author: { type: Type.STRING },
      summary: { type: Type.STRING },
      content: { type: Type.STRING, description: 'Full HTML content of the article' },
      publishedAt: { type: Type.NUMBER, description: 'Unix timestamp in milliseconds' },
      heroImage: { type: Type.STRING, description: 'Direct URL to a high-quality hero image (Unsplash preferred)' },
      videoId: { type: Type.STRING, description: 'YouTube video ID if the feed is YouTube-based' }
    },
    required: ['title', 'url', 'summary', 'content', 'publishedAt']
  }
};

export const GeminiService = {
  async summarizeArticle(title: string, content: string): Promise<string> {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Summarize this article in 3 bullet points. Be concise and capture the core value.
        
        Title: ${title}
        Content: ${content}`,
        config: {
          thinkingConfig: { thinkingBudget: 0 }
        }
      });
      return response.text || "Could not generate summary.";
    } catch (err) {
      console.error(err);
      return "Summary unavailable.";
    }
  },

  async fetchArticlesForFeed(feedTitle: string, feedUrl: string): Promise<any[]> {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Act as a Feed Sync Engine. Generate 5 realistic and current-looking articles for the following feed:
        
        Feed Title: ${feedTitle}
        Feed URL: ${feedUrl}
        
        Instructions:
        - The articles should be highly relevant to the feed's topic.
        - 'publishedAt' should be varied timestamps within the last 48 hours.
        - 'content' should be a rich HTML string with <p>, <h3>, and <ul> tags.
        - 'heroImage' should be a placeholder image URL (like https://images.unsplash.com/photo-...) matching the topic.
        - If the URL is YouTube, generate a realistic 'videoId' and 'heroImage' using the thumbnail pattern (https://img.youtube.com/vi/ID/maxresdefault.jpg).`,
        config: {
          responseMimeType: "application/json",
          responseSchema: ARTICLE_SCHEMA,
          thinkingConfig: { thinkingBudget: 0 }
        }
      });
      return JSON.parse(response.text || "[]");
    } catch (err) {
      console.error("Gemini sync failed:", err);
      throw err;
    }
  },

  async suggestFeedsByKeyword(keyword: string): Promise<any[]> {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `I want to follow high-quality content about "${keyword}". 
        Suggest 5 active and reputable feeds. 
        Include a mix of traditional RSS blogs, specific YouTube channels, and subreddits if applicable.
        Ensure the 'url' is the direct functional feed URL (e.g., ends in .rss, /feed, or the specific YT channel link).`,
        config: {
          responseMimeType: "application/json",
          responseSchema: FEED_SCHEMA
        }
      });
      return JSON.parse(response.text || "[]");
    } catch (err) {
      console.error(err);
      return [];
    }
  },

  async discoverFeedFromUrl(url: string): Promise<any[]> {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Act as an expert Web Crawler and Feed Discovery engine. Analyze this URL: "${url}".
        
        Your goal is to identify the direct machine-readable feed associated with this page.
        
        KNOWLEDGE BASE & PATTERNS:
        1. CMS Detection:
           - WordPress: check /feed/, /?feed=rss2, /comments/feed/
           - Substack: check /feed
           - Ghost: check /rss/
           - Medium: check /feed/@username
           - Shopify: check /collections/all.atom
        2. Platform Detection:
           - YouTube: If channel/user URL, generate https://www.youtube.com/feeds/videos.xml?channel_id=[ID] (or use the channel URL if ID is unknown).
           - Reddit: Append .rss to the subreddit or user URL.
           - Mastodon: Append .rss to the user profile URL.
           - GitHub: Check /releases.atom or /commits.atom.
        3. Podcast Detection:
           - Look for Apple Podcasts/Spotify links and infer the underlying RSS if possible (e.g., through Podlink patterns).
        
        INSTRUCTIONS:
        - Return a JSON array of discovered feeds.
        - If multiple feeds exist (e.g., a Main feed and a Comments feed), return the Main feed first.
        - Always provide a clean, user-friendly title.
        - If the URL is already a direct XML/RSS link, validate it and return it.`,
        config: {
          responseMimeType: "application/json",
          responseSchema: FEED_SCHEMA
        }
      });
      return JSON.parse(response.text || "[]");
    } catch (err) {
      console.error(err);
      return [];
    }
  }
};