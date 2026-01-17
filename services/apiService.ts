import { Feed, Article, Folder, AppSettings, UserProfile } from '../types';
import { GeminiService } from './geminiService';

const STORAGE_KEYS = {
  FEEDS: 'feeds_data',
  ARTICLES: 'articles_data',
  FOLDERS: 'folders_data',
  SETTINGS: 'app_settings',
  USER: 'user_profile',
  ONBOARDED: 'onboarding_complete'
};

const DEFAULT_SETTINGS: AppSettings = {
  baseUrl: window.location.origin,
  refreshInterval: 60,
  retentionDays: 30,
  theme: 'system',
  readerFontSize: 'base',
  readerFontFamily: 'sans'
};

const DEMO_FEEDS: Feed[] = [
  { id: 'f1', type: 'RSS', title: 'The Verge', url: 'https://theverge.com/rss', siteUrl: 'https://theverge.com', unreadCount: 5, lastFetched: Date.now() },
  { id: 'f2', type: 'YOUTUBE', title: 'MKBHD', url: 'https://youtube.com/user/marquesbrownlee', siteUrl: 'https://youtube.com', unreadCount: 2, lastFetched: Date.now() },
  { id: 'f3', type: 'REDDIT', title: 'r/Technology', url: 'https://reddit.com/r/technology', siteUrl: 'https://reddit.com', unreadCount: 12, lastFetched: Date.now() }
];

const DEMO_ARTICLES: Article[] = Array.from({ length: 50 }).map((_, i) => ({
  id: `a${i}`,
  feedId: i % 3 === 0 ? 'f1' : i % 3 === 1 ? 'f2' : 'f3',
  title: i % 2 === 0 ? `The future of computing is spatial (Part ${i})` : `Tech Review: The Newest Gadget v${i}`,
  url: `https://example.com/art${i}`,
  author: i % 3 === 0 ? 'Nilay Patel' : i % 3 === 1 ? 'Marques Brownlee' : 'r/Technology',
  publishedAt: Date.now() - (i * 3600000 * 2),
  summary: `This is a summary for article ${i}. It discusses various aspects of modern technology and how it impacts our lives on a daily basis.`,
  content: `<p>Full content for article ${i} goes here. It is quite long and detailed to demonstrate the reader view capabilities.</p><p>Technology is evolving faster than ever before...</p>`,
  read: i > 10,
  bookmarked: i < 5,
  heroImage: i % 5 === 0 ? `https://images.unsplash.com/photo-${1600000000000 + i}?auto=format&fit=crop&q=80&w=1200` : undefined
}));

const getStored = <T>(key: string, fallback: T): T => {
  const data = localStorage.getItem(key);
  if (!data) return fallback;
  return JSON.parse(data);
};

export const ApiService = {
  isOnboarded: (): boolean => {
    return localStorage.getItem(STORAGE_KEYS.ONBOARDED) === 'true';
  },

  completeOnboarding: async (user: UserProfile, settings: AppSettings, importDemo: boolean) => {
    localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
    if (importDemo) {
      localStorage.setItem(STORAGE_KEYS.FEEDS, JSON.stringify(DEMO_FEEDS));
      localStorage.setItem(STORAGE_KEYS.ARTICLES, JSON.stringify(DEMO_ARTICLES));
    } else {
      localStorage.setItem(STORAGE_KEYS.FEEDS, JSON.stringify([]));
      localStorage.setItem(STORAGE_KEYS.ARTICLES, JSON.stringify([]));
    }
    localStorage.setItem(STORAGE_KEYS.ONBOARDED, 'true');
  },

  getUser: async (): Promise<UserProfile | null> => {
    return getStored(STORAGE_KEYS.USER, null);
  },

  getSettings: async (): Promise<AppSettings> => {
    return getStored(STORAGE_KEYS.SETTINGS, DEFAULT_SETTINGS);
  },

  updateSettings: async (settings: Partial<AppSettings>): Promise<void> => {
    const current = await ApiService.getSettings();
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify({ ...current, ...settings }));
  },

  getFolders: async (): Promise<Folder[]> => {
    return getStored(STORAGE_KEYS.FOLDERS, []);
  },

  createFolder: async (name: string): Promise<Folder> => {
    const folders = await ApiService.getFolders();
    const existing = folders.find(f => f.name.toLowerCase() === name.toLowerCase());
    if (existing) return existing;

    const newFolder: Folder = {
      id: `fol-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name,
      updatedAt: Date.now()
    };
    const updated = [...folders, newFolder];
    localStorage.setItem(STORAGE_KEYS.FOLDERS, JSON.stringify(updated));
    return newFolder;
  },

  addFolders: async (names: string[]): Promise<Folder[]> => {
    const folders = await ApiService.getFolders();
    const results: Folder[] = [];
    const uniqueNames = Array.from(new Set(names));
    
    let updated = [...folders];
    for (const name of uniqueNames) {
      let folder = updated.find(f => f.name.toLowerCase() === name.toLowerCase());
      if (!folder) {
        folder = {
          id: `fol-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          name,
          updatedAt: Date.now()
        };
        updated.push(folder);
      }
      results.push(folder);
    }
    
    localStorage.setItem(STORAGE_KEYS.FOLDERS, JSON.stringify(updated));
    return results;
  },

  getFeeds: async (): Promise<Feed[]> => {
    return getStored(STORAGE_KEYS.FEEDS, []);
  },

  refreshFeed: async (feedId: string): Promise<{ feed: Feed, newArticles: Article[] }> => {
    const feeds = await ApiService.getFeeds();
    const feed = feeds.find(f => f.id === feedId);
    if (!feed) throw new Error("Feed not found");

    try {
      const rawArticles = await GeminiService.fetchArticlesForFeed(feed.title, feed.url);
      
      const newArticles: Article[] = rawArticles.map((ra: any) => ({
        id: `art-${Math.random().toString(36).substr(2, 9)}`,
        feedId: feed.id,
        title: ra.title,
        url: ra.url,
        author: ra.author,
        publishedAt: ra.publishedAt,
        summary: ra.summary,
        content: ra.content,
        heroImage: ra.heroImage,
        videoId: ra.videoId,
        read: false,
        bookmarked: false
      }));

      // Update storage
      const currentArticles = getStored(STORAGE_KEYS.ARTICLES, []);
      localStorage.setItem(STORAGE_KEYS.ARTICLES, JSON.stringify([...newArticles, ...currentArticles]));

      // Update feed metadata
      const updatedFeed = { 
        ...feed, 
        lastFetched: Date.now(), 
        unreadCount: feed.unreadCount + newArticles.length,
        error: undefined
      };
      
      const updatedFeeds = feeds.map(f => f.id === feedId ? updatedFeed : f);
      localStorage.setItem(STORAGE_KEYS.FEEDS, JSON.stringify(updatedFeeds));

      return { feed: updatedFeed, newArticles };
    } catch (err: any) {
      const errorFeed = { ...feed, error: err.message || "Failed to sync" };
      const updatedFeeds = feeds.map(f => f.id === feedId ? errorFeed : f);
      localStorage.setItem(STORAGE_KEYS.FEEDS, JSON.stringify(updatedFeeds));
      throw { ...err, feed: errorFeed };
    }
  },

  getArticles: async (options?: { feedId?: string; folderId?: string; bookmarked?: boolean; limit?: number; offset?: number }): Promise<{ articles: Article[], hasMore: boolean }> => {
    const allArticles = getStored(STORAGE_KEYS.ARTICLES, []);
    const allFeeds = getStored(STORAGE_KEYS.FEEDS, []);
    let filtered = allArticles;
    
    if (options?.feedId) {
      filtered = allArticles.filter(a => a.feedId === options.feedId);
    } else if (options?.folderId) {
      const folderFeedIds = allFeeds.filter(f => f.folderId === options.folderId).map(f => f.id);
      filtered = allArticles.filter(a => folderFeedIds.includes(a.feedId));
    } else if (options?.bookmarked) {
      filtered = allArticles.filter(a => a.bookmarked);
    }
    
    const sorted = filtered.sort((a, b) => b.publishedAt - a.publishedAt);
    const limit = options?.limit ?? 20;
    const offset = options?.offset ?? 0;
    
    const paginated = sorted.slice(offset, offset + limit);
    return {
      articles: paginated,
      hasMore: offset + limit < sorted.length
    };
  },

  addFeed: async (feed: Partial<Feed>): Promise<Feed> => {
    const feeds = await ApiService.getFeeds();
    const newFeed: Feed = {
      id: `f-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: feed.type || 'RSS',
      title: feed.title || 'Untitled Feed',
      url: feed.url || '',
      siteUrl: feed.siteUrl || '',
      folderId: feed.folderId,
      unreadCount: 0,
      lastFetched: 0 // Initialize to 0 so we know it hasn't been fetched
    };
    const updated = [...feeds, newFeed];
    localStorage.setItem(STORAGE_KEYS.FEEDS, JSON.stringify(updated));
    return newFeed;
  },

  addFeeds: async (feedsData: Partial<Feed>[]): Promise<Feed[]> => {
    const existingFeeds = await ApiService.getFeeds();
    const newFeeds = feedsData.map(feed => ({
      id: `f-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: feed.type || 'RSS',
      title: feed.title || 'Untitled Feed',
      url: feed.url || '',
      siteUrl: feed.siteUrl || '',
      folderId: feed.folderId,
      unreadCount: 0,
      lastFetched: 0
    })) as Feed[];

    const updated = [...existingFeeds, ...newFeeds];
    localStorage.setItem(STORAGE_KEYS.FEEDS, JSON.stringify(updated));
    return newFeeds;
  },

  updateFeed: async (feedId: string, updates: Partial<Feed>): Promise<void> => {
    const feeds = await ApiService.getFeeds();
    const updated = feeds.map(f => f.id === feedId ? { ...f, ...updates } : f);
    localStorage.setItem(STORAGE_KEYS.FEEDS, JSON.stringify(updated));
  },

  updateFeedFolder: async (feedId: string, folderId: string | undefined): Promise<void> => {
    const feeds = await ApiService.getFeeds();
    const updated = feeds.map(f => f.id === feedId ? { ...f, folderId } : f);
    localStorage.setItem(STORAGE_KEYS.FEEDS, JSON.stringify(updated));
  },

  markAsRead: async (articleId: string, read: boolean): Promise<void> => {
    const articles = getStored(STORAGE_KEYS.ARTICLES, []);
    const updated = articles.map(a => a.id === articleId ? { ...a, read } : a);
    localStorage.setItem(STORAGE_KEYS.ARTICLES, JSON.stringify(updated));
    
    const article = articles.find(a => a.id === articleId);
    if (article) {
      const feeds = await ApiService.getFeeds();
      const updatedFeeds = feeds.map(f => {
        if (f.id === article.feedId) {
          const change = read ? -1 : 1;
          return { ...f, unreadCount: Math.max(0, f.unreadCount + change) };
        }
        return f;
      });
      localStorage.setItem(STORAGE_KEYS.FEEDS, JSON.stringify(updatedFeeds));
    }
  },

  toggleBookmark: async (articleId: string, bookmarked: boolean): Promise<void> => {
    const articles = getStored(STORAGE_KEYS.ARTICLES, []);
    const updated = articles.map(a => a.id === articleId ? { ...a, bookmarked } : a);
    localStorage.setItem(STORAGE_KEYS.ARTICLES, JSON.stringify(updated));
  },

  deleteFeed: async (feedId: string): Promise<void> => {
    const feeds = await ApiService.getFeeds();
    const updatedFeeds = feeds.filter(f => f.id !== feedId);
    localStorage.setItem(STORAGE_KEYS.FEEDS, JSON.stringify(updatedFeeds));

    const articles = getStored(STORAGE_KEYS.ARTICLES, []);
    const updatedArticles = articles.filter(a => a.feedId !== feedId);
    localStorage.setItem(STORAGE_KEYS.ARTICLES, JSON.stringify(updatedArticles));
  }
};