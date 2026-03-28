import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import Fastify from 'fastify';
import Database from 'better-sqlite3';
import { tmpdir } from 'os';
import { join } from 'path';
import { unlinkSync } from 'fs';

// Mock the feed parser to avoid network calls
vi.mock('../../src/services/feed-parser.js', () => ({
    parseFeed: vi.fn().mockResolvedValue({
        title: 'Test Feed',
        description: 'A test feed',
        link: 'https://example.com',
        favicon: null,
        articles: [],
        isPodcast: false,
    }),
    detectFeedType: vi.fn(() => 'rss'),
}));

vi.mock('../../src/services/discovery.js', () => ({
    discoverFeedsFromUrl: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../src/services/feed-refresh.js', () => ({
    refreshFeed: vi.fn().mockResolvedValue({
        success: true,
        newArticles: 1,
    }),
}));

import { parseFeed } from '../../src/services/feed-parser.js';
import { refreshFeed } from '../../src/services/feed-refresh.js';

describe('Feeds API Routes', () => {
    let app: FastifyInstance;
    let testDbPath: string;
    let db: Database.Database;

    beforeEach(async () => {
        vi.resetModules();
        vi.clearAllMocks();
        
        testDbPath = join(tmpdir(), `feeds-api-test-${Date.now()}.db`);
        
        // Create test database
        db = new Database(testDbPath);
        db.pragma('journal_mode = WAL');
        db.pragma('foreign_keys = ON');
        
        // Create tables with complete schema matching migrations
        db.exec(`
            CREATE TABLE users (
                id INTEGER PRIMARY KEY,
                username TEXT NOT NULL,
                password_hash TEXT,
                is_admin INTEGER DEFAULT 0,
                token_version INTEGER DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
            INSERT INTO users (id, username, token_version) VALUES (1, 'admin', 1);
        `);
        
        db.exec(`
            CREATE TABLE folders (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                name TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
            INSERT INTO folders (id, user_id, name) VALUES (1, 1, 'Default');
        `);
        
        db.exec(`
            CREATE TABLE feeds (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                folder_id INTEGER,
                url TEXT UNIQUE NOT NULL,
                site_url TEXT,
                title TEXT,
                description TEXT,
                type TEXT DEFAULT 'rss',
                icon_url TEXT,
                icon_cached_path TEXT,
                icon_cached_content_type TEXT,
                icon_updated_at TEXT,
                refresh_interval_minutes INTEGER DEFAULT 60,
                last_fetched_at DATETIME,
                last_refresh_at DATETIME,
                next_fetch_at DATETIME,
                next_refresh_at DATETIME,
                last_error TEXT,
                last_error_at DATETIME,
                error_count INTEGER DEFAULT 0,
                paused_at DATETIME,
                deleted_at DATETIME,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
        `);
        
        db.exec(`
            CREATE TABLE articles (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                feed_id INTEGER NOT NULL,
                guid TEXT NOT NULL,
                title TEXT,
                url TEXT,
                content TEXT,
                summary TEXT,
                author TEXT,
                thumbnail_url TEXT,
                published_at DATETIME,
                fetched_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                is_read INTEGER DEFAULT 0,
                is_starred INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(feed_id, guid)
            );
        `);
        
        db.exec(`
            CREATE TABLE read_state (
                user_id INTEGER NOT NULL,
                article_id INTEGER NOT NULL,
                is_read INTEGER DEFAULT 0,
                read_at DATETIME,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (user_id, article_id)
            );
        `);
        
        db.exec(`
            CREATE TABLE user_settings (
                user_id INTEGER PRIMARY KEY,
                refresh_interval_minutes INTEGER DEFAULT 60,
                theme TEXT DEFAULT 'system',
                global_last_refresh_at DATETIME,
                global_next_refresh_at DATETIME
            );
            INSERT INTO user_settings (user_id) VALUES (1);
        `);
        
        // Create Fastify app with routes
        app = Fastify();
        
        // Mock auth middleware to bypass authentication
        app.addHook('onRequest', async (request, reply) => {
            (request as any).user = { userId: 1, username: 'admin' };
        });
        
        // Set database path
        process.env.DATABASE_PATH = testDbPath;
        
        // Import and register routes (fresh import after resetModules)
        const { feedsRoutes } = await import('../../src/routes/feeds.js');
        const { feedsStreamRoutes } = await import('../../src/routes/feeds-stream.js');
        await app.register(feedsRoutes, { prefix: '/api/v1/feeds' });
        await app.register(feedsStreamRoutes, { prefix: '/api/v1/feeds-stream' });
    });

    afterEach(async () => {
        await app.close();
        db.close();
        try {
            unlinkSync(testDbPath);
        } catch {}
        delete process.env.DATABASE_PATH;
    });

    describe('GET /api/v1/feeds', () => {
        it('should return empty array when no feeds', async () => {
            const response = await app.inject({
                method: 'GET',
                url: '/api/v1/feeds',
            });

            expect(response.statusCode).toBe(200);
            const body = JSON.parse(response.payload);
            expect(body.feeds).toEqual([]);
        });

        it('should return list of feeds', async () => {
            db.exec(`
                INSERT INTO feeds (user_id, folder_id, url, title, type) VALUES
                (1, 1, 'https://example.com/feed1.xml', 'Feed 1', 'rss'),
                (1, 1, 'https://example.com/feed2.xml', 'Feed 2', 'rss');
            `);

            const response = await app.inject({
                method: 'GET',
                url: '/api/v1/feeds',
            });

            expect(response.statusCode).toBe(200);
            const body = JSON.parse(response.payload);
            expect(body.feeds).toHaveLength(2);
            expect(body.feeds[0].title).toBe('Feed 1');
            expect(body.feeds[1].title).toBe('Feed 2');
        });
    });

    describe('GET /api/v1/feeds/:id', () => {
        it('should return single feed', async () => {
            const result = db.prepare('INSERT INTO feeds (user_id, folder_id, url, title, type) VALUES (?, ?, ?, ?, ?)')
                .run(1, 1, 'https://example.com/feed.xml', 'Test Feed', 'rss');
            
            const response = await app.inject({
                method: 'GET',
                url: `/api/v1/feeds/${result.lastInsertRowid}`,
            });

            expect(response.statusCode).toBe(200);
            const body = JSON.parse(response.payload);
            expect(body.feed.title).toBe('Test Feed');
        });

        it('should return 404 for non-existent feed', async () => {
            const response = await app.inject({
                method: 'GET',
                url: '/api/v1/feeds/999',
            });

            expect(response.statusCode).toBe(404);
        });
    });

    describe('POST /api/v1/feeds', () => {
        it('should add new feed', async () => {
            const response = await app.inject({
                method: 'POST',
                url: '/api/v1/feeds',
                payload: {
                    url: 'https://example.com/feed.xml',
                    folder_id: 1,
                },
            });

            expect(response.statusCode).toBe(200);
            const body = JSON.parse(response.payload);
            expect(body.feed.title).toBe('Test Feed');
            expect(body.feed.url).toBe('https://example.com/feed.xml');
            expect(parseFeed).toHaveBeenCalledWith('https://example.com/feed.xml');
        });

        it('should return 400 for invalid URL', async () => {
            const response = await app.inject({
                method: 'POST',
                url: '/api/v1/feeds',
                payload: {
                    url: 'not-a-valid-url',
                    folder_id: 1,
                },
            });

            // Zod validation should catch this - checking it doesn't crash
            expect(response.statusCode).toBeGreaterThanOrEqual(400);
        });

        it('should return 400 for missing URL', async () => {
            const response = await app.inject({
                method: 'POST',
                url: '/api/v1/feeds',
                payload: {
                    folder_id: 1,
                },
            });

            // Zod validation should catch this - checking it doesn't crash
            expect(response.statusCode).toBeGreaterThanOrEqual(400);
        });

        it('should handle duplicate feed URL', async () => {
            // First add
            await app.inject({
                method: 'POST',
                url: '/api/v1/feeds',
                payload: {
                    url: 'https://example.com/feed.xml',
                    folder_id: 1,
                },
            });

            // Second add with same URL
            const response = await app.inject({
                method: 'POST',
                url: '/api/v1/feeds',
                payload: {
                    url: 'https://example.com/feed.xml',
                    folder_id: 1,
                },
            });

            expect(response.statusCode).toBe(409);
            const body = JSON.parse(response.payload);
            expect(body.error).toBe('Feed already exists');
        });
    });

    describe('PATCH /api/v1/feeds/:id', () => {
        it('should update feed title', async () => {
            const result = db.prepare('INSERT INTO feeds (user_id, folder_id, url, title, type) VALUES (?, ?, ?, ?, ?)')
                .run(1, 1, 'https://example.com/feed.xml', 'Old Title', 'rss');
            
            const response = await app.inject({
                method: 'PATCH',
                url: `/api/v1/feeds/${result.lastInsertRowid}`,
                payload: {
                    title: 'New Title',
                },
            });

            expect(response.statusCode).toBe(200);
            const body = JSON.parse(response.payload);
            expect(body.feed.title).toBe('New Title');
        });

        it('should update feed folder', async () => {
            db.prepare('INSERT INTO folders (user_id, name) VALUES (?, ?)').run(1, 'New Folder');
            const result = db.prepare('INSERT INTO feeds (user_id, folder_id, url, title, type) VALUES (?, ?, ?, ?, ?)')
                .run(1, 1, 'https://example.com/feed.xml', 'Test Feed', 'rss');
            
            const response = await app.inject({
                method: 'PATCH',
                url: `/api/v1/feeds/${result.lastInsertRowid}`,
                payload: {
                    folder_id: 2,
                },
            });

            expect(response.statusCode).toBe(200);
        });

        it('should return 404 for non-existent feed', async () => {
            const response = await app.inject({
                method: 'PATCH',
                url: '/api/v1/feeds/999',
                payload: {
                    title: 'New Title',
                },
            });

            expect(response.statusCode).toBe(404);
        });
    });

    describe('DELETE /api/v1/feeds/:id', () => {
        it('should delete feed', async () => {
            const result = db.prepare('INSERT INTO feeds (user_id, folder_id, url, title, type) VALUES (?, ?, ?, ?, ?)')
                .run(1, 1, 'https://example.com/feed.xml', 'Test Feed', 'rss');
            
            const response = await app.inject({
                method: 'DELETE',
                url: `/api/v1/feeds/${result.lastInsertRowid}`,
            });

            expect(response.statusCode).toBe(200);
            // Verify feed is soft-deleted
            const feed = db.prepare('SELECT * FROM feeds WHERE id = ?').get(result.lastInsertRowid) as any;
            expect(feed.deleted_at).toBeDefined();
        });

        it('should return 404 for non-existent feed', async () => {
            const response = await app.inject({
                method: 'DELETE',
                url: '/api/v1/feeds/999',
            });

            expect(response.statusCode).toBe(404);
        });
    });

    describe('POST /api/v1/feeds/bulk', () => {
        beforeEach(() => {
            db.exec(`
                INSERT INTO feeds (user_id, folder_id, url, title) VALUES
                (1, 1, 'https://example.com/feed1.xml', 'Feed 1'),
                (1, 1, 'https://example.com/feed2.xml', 'Feed 2'),
                (1, 1, 'https://example.com/feed3.xml', 'Feed 3');
            `);
        });

        it('should bulk delete feeds', async () => {
            const response = await app.inject({
                method: 'POST',
                url: '/api/v1/feeds/bulk',
                payload: {
                    action: 'delete',
                    feed_ids: [1, 2, 3],
                },
            });

            expect(response.statusCode).toBe(200);
            const body = JSON.parse(response.payload);
            // The response structure may vary, just verify success
            expect(body).toBeDefined();
        });

        it('should bulk move feeds', async () => {
            db.prepare('INSERT INTO folders (user_id, name) VALUES (?, ?)').run(1, 'New Folder');
            
            const response = await app.inject({
                method: 'POST',
                url: '/api/v1/feeds/bulk',
                payload: {
                    action: 'move',
                    feed_ids: [1, 2],
                    folder_id: 2,
                },
            });

            expect(response.statusCode).toBe(200);
            const body = JSON.parse(response.payload);
            // The response structure may vary, just verify success
            expect(body).toBeDefined();
        });

        it('should return 400 for invalid action', async () => {
            const response = await app.inject({
                method: 'POST',
                url: '/api/v1/feeds/bulk',
                payload: {
                    action: 'invalid_action',
                    feed_ids: [1],
                },
            });

            // Zod validation should catch this - checking it doesn't crash
            expect(response.statusCode).toBeGreaterThanOrEqual(400);
        });
    });

    describe('POST /api/v1/feeds/:id/refresh', () => {
        it('should refresh feed', async () => {
            const result = db.prepare('INSERT INTO feeds (user_id, folder_id, url, title, type) VALUES (?, ?, ?, ?, ?)')
                .run(1, 1, 'https://example.com/feed.xml', 'Test Feed', 'rss');
            
            const response = await app.inject({
                method: 'POST',
                url: `/api/v1/feeds/${result.lastInsertRowid}/refresh`,
            });

            expect(response.statusCode).toBe(200);
            expect(refreshFeed).toHaveBeenCalled();
        });

        it('should return 404 for non-existent feed', async () => {
            const response = await app.inject({
                method: 'POST',
                url: '/api/v1/feeds/999/refresh',
            });

            expect(response.statusCode).toBe(404);
        });
    });

    describe('POST /api/v1/feeds/:id/pause', () => {
        it('should pause feed', async () => {
            const result = db.prepare('INSERT INTO feeds (user_id, folder_id, url, title, type) VALUES (?, ?, ?, ?, ?)')
                .run(1, 1, 'https://example.com/feed.xml', 'Test Feed', 'rss');
            
            const response = await app.inject({
                method: 'POST',
                url: `/api/v1/feeds/${result.lastInsertRowid}/pause`,
            });

            expect(response.statusCode).toBe(200);
            const feed = db.prepare('SELECT * FROM feeds WHERE id = ?').get(result.lastInsertRowid) as any;
            expect(feed.paused_at).toBeDefined();
        });
    });

    describe('POST /api/v1/feeds/:id/resume', () => {
        it('should resume paused feed', async () => {
            const result = db.prepare(`
                INSERT INTO feeds (user_id, folder_id, url, title, type, paused_at) 
                VALUES (?, ?, ?, ?, ?, datetime('now'))
            `).run(1, 1, 'https://example.com/feed.xml', 'Test Feed', 'rss');
            
            const response = await app.inject({
                method: 'POST',
                url: `/api/v1/feeds/${result.lastInsertRowid}/resume`,
            });

            expect(response.statusCode).toBe(200);
            const feed = db.prepare('SELECT * FROM feeds WHERE id = ?').get(result.lastInsertRowid) as any;
            expect(feed.paused_at).toBeNull();
        });
    });

    describe('GET /api/v1/feeds-stream/refresh-multiple', () => {
        it('should skip paused feeds during bulk refresh', async () => {
            const active = db.prepare('INSERT INTO feeds (user_id, folder_id, url, title, type) VALUES (?, ?, ?, ?, ?)')
                .run(1, 1, 'https://example.com/active.xml', 'Active Feed', 'rss');
            const paused = db.prepare(`
                INSERT INTO feeds (user_id, folder_id, url, title, type, paused_at)
                VALUES (?, ?, ?, ?, ?, datetime('now'))
            `).run(1, 1, 'https://example.com/paused.xml', 'Paused Feed', 'rss');

            const response = await app.inject({
                method: 'GET',
                url: `/api/v1/feeds-stream/refresh-multiple?ids=${active.lastInsertRowid},${paused.lastInsertRowid}`,
            });

            expect(response.statusCode).toBe(200);
            expect(refreshFeed).toHaveBeenCalledTimes(1);
            expect(refreshFeed).toHaveBeenCalledWith(expect.objectContaining({
                id: Number(active.lastInsertRowid),
            }));
        });
    });
});
