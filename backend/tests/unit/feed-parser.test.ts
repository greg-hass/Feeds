import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Mock the http module
vi.mock('../../src/services/http.js', () => ({
    fetchWithRetry: vi.fn(),
}));

// Mock the youtube-parser module
vi.mock('../../src/services/youtube-parser.js', () => ({
    fetchYouTubeIcon: vi.fn(),
    extractYouTubeChannelId: vi.fn(),
    YOUTUBE_FETCH_USER_AGENT: 'YouTube-Test-Agent',
}));

// Mock the reddit-parser module
vi.mock('../../src/services/reddit-parser.js', () => ({
    fetchRedditIcon: vi.fn(),
    cleanRedditContent: vi.fn((content: string) => content),
    upgradeRedditImageUrl: vi.fn((url: string) => url),
    normalizeRedditAuthor: vi.fn((author: string | null) => author),
    extractRedditThumbnail: vi.fn(),
}));

import { fetchWithRetry } from '../../src/services/http.js';
import { fetchYouTubeIcon } from '../../src/services/youtube-parser.js';
import { fetchRedditIcon } from '../../src/services/reddit-parser.js';

describe('Feed Parser', () => {
    beforeEach(() => {
        vi.resetModules();
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    describe('parseFeed - RSS', () => {
        it('should parse valid RSS feed', async () => {
            const rssXml = readFileSync(join(__dirname, '../fixtures/rss-valid.xml'), 'utf-8');
            (fetchWithRetry as any).mockResolvedValue({
                ok: true,
                text: () => Promise.resolve(rssXml),
            });

            const { parseFeed } = await import('../../src/services/feed-parser.js');
            const feed = await parseFeed('https://example.com/feed.xml', { skipIconFetch: true });

            expect(feed.title).toBe('Test RSS Feed');
            expect(feed.description).toBe('A test RSS feed for unit testing');
            expect(feed.link).toBe('https://example.com/'); // Parser normalizes to include trailing slash
            expect(feed.articles).toHaveLength(3);
            expect(feed.isPodcast).toBe(false);
        });

        it('should extract article fields correctly', async () => {
            const rssXml = readFileSync(join(__dirname, '../fixtures/rss-valid.xml'), 'utf-8');
            (fetchWithRetry as any).mockResolvedValue({
                ok: true,
                text: () => Promise.resolve(rssXml),
            });

            const { parseFeed } = await import('../../src/services/feed-parser.js');
            const feed = await parseFeed('https://example.com/feed.xml', { skipIconFetch: true });

            const firstArticle = feed.articles[0];
            expect(firstArticle.title).toBe('First Test Article');
            expect(firstArticle.guid).toBe('https://example.com/article/1');
            expect(firstArticle.link).toBe('https://example.com/article/1');
            expect(firstArticle.author).toBe('Test Author');
            expect(firstArticle.summary).toBe('This is the first test article description.');
        });

        it('should handle HTML in descriptions', async () => {
            const rssXml = readFileSync(join(__dirname, '../fixtures/rss-valid.xml'), 'utf-8');
            (fetchWithRetry as any).mockResolvedValue({
                ok: true,
                text: () => Promise.resolve(rssXml),
            });

            const { parseFeed } = await import('../../src/services/feed-parser.js');
            const feed = await parseFeed('https://example.com/feed.xml', { skipIconFetch: true });

            const secondArticle = feed.articles[1];
            expect(secondArticle.summary).not.toContain('<strong>');
            expect(secondArticle.summary).toContain('HTML');
        });

        it('should use dc:creator as fallback for author', async () => {
            const rssXml = readFileSync(join(__dirname, '../fixtures/rss-valid.xml'), 'utf-8');
            (fetchWithRetry as any).mockResolvedValue({
                ok: true,
                text: () => Promise.resolve(rssXml),
            });

            const { parseFeed } = await import('../../src/services/feed-parser.js');
            const feed = await parseFeed('https://example.com/feed.xml', { skipIconFetch: true });

            const secondArticle = feed.articles[1];
            expect(secondArticle.author).toBe('Another Author');
        });
    });

    describe('parseFeed - Atom', () => {
        it('should parse valid Atom feed', async () => {
            const atomXml = readFileSync(join(__dirname, '../fixtures/atom-valid.xml'), 'utf-8');
            (fetchWithRetry as any).mockResolvedValue({
                ok: true,
                text: () => Promise.resolve(atomXml),
            });

            const { parseFeed } = await import('../../src/services/feed-parser.js');
            const feed = await parseFeed('https://example.com/atom.xml', { skipIconFetch: true });

            expect(feed.title).toBe('Test Atom Feed');
            expect(feed.articles).toHaveLength(2);
        });

        it('should extract Atom entry fields', async () => {
            const atomXml = readFileSync(join(__dirname, '../fixtures/atom-valid.xml'), 'utf-8');
            (fetchWithRetry as any).mockResolvedValue({
                ok: true,
                text: () => Promise.resolve(atomXml),
            });

            const { parseFeed } = await import('../../src/services/feed-parser.js');
            const feed = await parseFeed('https://example.com/atom.xml', { skipIconFetch: true });

            const firstEntry = feed.articles[0];
            expect(firstEntry.title).toBe('First Atom Entry');
            expect(firstEntry.guid).toBe('https://example.com/entry/1');
            expect(firstEntry.link).toBe('https://example.com/entry/1');
        });
    });

    describe('parseFeed - YouTube', () => {
        it('should parse YouTube feed', async () => {
            const youtubeXml = readFileSync(join(__dirname, '../fixtures/youtube-feed.xml'), 'utf-8');
            (fetchWithRetry as any).mockResolvedValue({
                ok: true,
                text: () => Promise.resolve(youtubeXml),
            });

            const { parseFeed } = await import('../../src/services/feed-parser.js');
            const feed = await parseFeed('https://www.youtube.com/feeds/videos.xml?channel_id=UC_x5XG1OV2P6uZZ5FSM9Ttw', { skipIconFetch: true });

            expect(feed.title).toBe('YouTube Test Channel');
            expect(feed.articles).toHaveLength(1);
            // youtubeChannelId is extracted from the feed metadata, may not be present in this test
        });

        it('should extract YouTube video ID from yt:videoId', async () => {
            const youtubeXml = readFileSync(join(__dirname, '../fixtures/youtube-feed.xml'), 'utf-8');
            (fetchWithRetry as any).mockResolvedValue({
                ok: true,
                text: () => Promise.resolve(youtubeXml),
            });

            const { parseFeed, normalizeArticle, detectFeedType } = await import('../../src/services/feed-parser.js');
            const feed = await parseFeed('https://www.youtube.com/feeds/videos.xml?channel_id=UC_x5XG1OV2P6uZZ5FSM9Ttw', { skipIconFetch: true });
            const feedType = detectFeedType('https://www.youtube.com/feeds/videos.xml?channel_id=UC_x5XG1OV2P6uZZ5FSM9Ttw', feed);
            const normalized = normalizeArticle(feed.articles[0], feedType);

            expect(normalized.url).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
            // Thumbnail can come from media:group or be constructed from video ID
            expect(normalized.thumbnail_url).toContain('dQw4w9WgXcQ');
        });

        it('should detect YouTube feed type', async () => {
            const { detectFeedType } = await import('../../src/services/feed-parser.js');
            
            const feed = {
                title: 'Test',
                description: null,
                link: null,
                favicon: null,
                articles: [],
                isPodcast: false,
                youtubeChannelId: null,
            };

            expect(detectFeedType('https://youtube.com/feeds/videos.xml', feed)).toBe('youtube');
            expect(detectFeedType('https://www.youtube.com/channel/UC123', feed)).toBe('youtube');
            expect(detectFeedType('https://youtu.be/video', feed)).toBe('youtube');
        });
    });

    describe('parseFeed - Podcast', () => {
        it('should detect podcast from audio enclosures', async () => {
            const podcastXml = readFileSync(join(__dirname, '../fixtures/podcast-feed.xml'), 'utf-8');
            (fetchWithRetry as any).mockResolvedValue({
                ok: true,
                text: () => Promise.resolve(podcastXml),
            });

            const { parseFeed } = await import('../../src/services/feed-parser.js');
            const feed = await parseFeed('https://example.com/podcast.xml', { skipIconFetch: true });

            expect(feed.isPodcast).toBe(true);
            expect(feed.articles[0].enclosures).toHaveLength(1);
            expect(feed.articles[0].enclosures[0].type).toBe('audio/mpeg');
        });

        it('should detect podcast from iTunes namespace', async () => {
            const podcastXml = readFileSync(join(__dirname, '../fixtures/podcast-feed.xml'), 'utf-8');
            (fetchWithRetry as any).mockResolvedValue({
                ok: true,
                text: () => Promise.resolve(podcastXml),
            });

            const { parseFeed } = await import('../../src/services/feed-parser.js');
            const feed = await parseFeed('https://example.com/podcast.xml', { skipIconFetch: true });

            expect(feed.isPodcast).toBe(true);
        });
    });

    describe('parseFeed - Error Handling', () => {
        it('should throw error for invalid URL', async () => {
            const { parseFeed } = await import('../../src/services/feed-parser.js');
            
            await expect(parseFeed('')).rejects.toThrow('URL must be a non-empty string');
            await expect(parseFeed('not-a-url')).rejects.toThrow('Invalid URL');
            await expect(parseFeed('ftp://example.com')).rejects.toThrow('Invalid protocol');
        });

        it('should throw error for HTTP error response', async () => {
            (fetchWithRetry as any).mockResolvedValue({
                ok: false,
                status: 404,
                statusText: 'Not Found',
            });

            const { parseFeed } = await import('../../src/services/feed-parser.js');
            
            await expect(parseFeed('https://example.com/feed.xml', { skipIconFetch: true }))
                .rejects.toThrow('Failed to fetch feed: 404 Not Found');
        });

        it('should throw error for malformed XML', async () => {
            const malformedXml = readFileSync(join(__dirname, '../fixtures/malformed-feed.xml'), 'utf-8');
            (fetchWithRetry as any).mockResolvedValue({
                ok: true,
                text: () => Promise.resolve(malformedXml),
            });

            const { parseFeed } = await import('../../src/services/feed-parser.js');
            
            await expect(parseFeed('https://example.com/feed.xml', { skipIconFetch: true }))
                .rejects.toThrow();
        });

        it('should handle network errors gracefully', async () => {
            (fetchWithRetry as any).mockRejectedValue(new Error('Network error'));

            const { parseFeed } = await import('../../src/services/feed-parser.js');
            
            await expect(parseFeed('https://example.com/feed.xml', { skipIconFetch: true }))
                .rejects.toThrow('Network error');
        });
    });

    describe('normalizeArticle', () => {
        it('should normalize RSS article', async () => {
            const { normalizeArticle, detectFeedType } = await import('../../src/services/feed-parser.js');
            
            const rawArticle = {
                guid: 'test-guid',
                title: 'Test Article',
                link: 'https://example.com/article',
                author: 'Test Author',
                summary: 'Test summary',
                description: 'Test description',
                pubdate: new Date('2026-02-02T10:00:00Z'),
                enclosures: [],
                image: undefined,
                thumbnail: undefined,
            };

            const feed = {
                title: 'Test',
                description: null,
                link: 'https://example.com',
                favicon: null,
                articles: [],
                isPodcast: false,
            };

            const normalized = normalizeArticle(rawArticle, detectFeedType('https://example.com/feed.xml', feed));

            expect(normalized.guid).toBe('test-guid');
            expect(normalized.title).toBe('Test Article');
            expect(normalized.url).toBe('https://example.com/article');
            expect(normalized.author).toBe('Test Author');
            expect(normalized.published_at).toBe('2026-02-02T10:00:00.000Z');
        });

        it('should handle article without link', async () => {
            const { normalizeArticle, detectFeedType } = await import('../../src/services/feed-parser.js');
            
            const rawArticle = {
                guid: 'test-guid',
                title: 'Test Article',
                link: '',
                author: null,
                summary: null,
                description: null,
                pubdate: null,
                enclosures: [],
            };

            const feed = {
                title: 'Test',
                description: null,
                link: null,
                favicon: null,
                articles: [],
                isPodcast: false,
            };

            const normalized = normalizeArticle(rawArticle, detectFeedType('https://example.com/feed.xml', feed));

            expect(normalized.url).toBeNull();
        });

        it('should extract enclosure information', async () => {
            const { normalizeArticle, detectFeedType } = await import('../../src/services/feed-parser.js');
            
            const rawArticle = {
                guid: 'test-guid',
                title: 'Podcast Episode',
                link: 'https://example.com/episode',
                author: null,
                summary: null,
                description: null,
                pubdate: null,
                enclosures: [{
                    url: 'https://example.com/episode.mp3',
                    type: 'audio/mpeg',
                    length: '12345678',
                }],
            };

            const feed = {
                title: 'Test',
                description: null,
                link: null,
                favicon: null,
                articles: [],
                isPodcast: true,
            };

            const normalized = normalizeArticle(rawArticle, detectFeedType('https://example.com/podcast.xml', feed));

            expect(normalized.enclosure_url).toBe('https://example.com/episode.mp3');
            expect(normalized.enclosure_type).toBe('audio/mpeg');
        });
    });

    describe('detectFeedType', () => {
        it('should detect Reddit feeds', async () => {
            const { detectFeedType } = await import('../../src/services/feed-parser.js');
            
            const feed = {
                title: 'Test',
                description: null,
                link: null,
                favicon: null,
                articles: [],
                isPodcast: false,
            };

            expect(detectFeedType('https://reddit.com/r/test/.rss', feed)).toBe('reddit');
            expect(detectFeedType('https://www.reddit.com/r/test.rss', feed)).toBe('reddit');
        });

        it('should detect podcast from isPodcast flag', async () => {
            const { detectFeedType } = await import('../../src/services/feed-parser.js');
            
            const feed = {
                title: 'Test',
                description: null,
                link: null,
                favicon: null,
                articles: [],
                isPodcast: true,
            };

            expect(detectFeedType('https://example.com/feed.xml', feed)).toBe('podcast');
        });

        it('should default to RSS', async () => {
            const { detectFeedType } = await import('../../src/services/feed-parser.js');
            
            const feed = {
                title: 'Test',
                description: null,
                link: null,
                favicon: null,
                articles: [],
                isPodcast: false,
            };

            expect(detectFeedType('https://example.com/feed.xml', feed)).toBe('rss');
        });
    });
});
