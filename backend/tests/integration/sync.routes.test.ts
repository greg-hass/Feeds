import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import Fastify from 'fastify';
import Database from 'better-sqlite3';
import { tmpdir } from 'os';
import { join } from 'path';
import { unlinkSync } from 'fs';

describe('Sync API Routes', () => {
    let app: FastifyInstance;
    let testDbPath: string;
    let db: Database.Database;

    beforeEach(async () => {
        testDbPath = join(tmpdir(), `sync-routes-test-${Date.now()}.db`);

        db = new Database(testDbPath);
        db.pragma('journal_mode = WAL');
        db.pragma('foreign_keys = ON');

        db.exec(`
            CREATE TABLE users (
                id INTEGER PRIMARY KEY,
                username TEXT NOT NULL,
                password_hash TEXT,
                settings_json TEXT DEFAULT '{}'
            );
            INSERT INTO users (id, username, settings_json) VALUES (1, 'admin', '{}');
        `);

        db.exec(`
            CREATE TABLE folders (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                name TEXT NOT NULL,
                position INTEGER DEFAULT 0,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
                deleted_at TEXT
            );
            INSERT INTO folders (id, user_id, name, created_at, updated_at) VALUES (1, 1, 'Default', '2026-03-04 10:00:00.000', '2026-03-04 10:00:00.000');
        `);

        db.exec(`
            CREATE TABLE feeds (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                folder_id INTEGER,
                url TEXT NOT NULL,
                title TEXT,
                type TEXT DEFAULT 'rss',
                icon_url TEXT,
                icon_cached_path TEXT,
                paused_at TEXT,
                deleted_at TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            );
            INSERT INTO feeds (id, user_id, folder_id, url, title, type, icon_url, created_at, updated_at)
            VALUES (1, 1, 1, 'https://example.com/feed.xml', 'Feed 1', 'rss', 'https://example.com/icon.png', '2026-03-04 10:00:00.000', '2026-03-04 10:00:00.000');
            INSERT INTO feeds (id, user_id, folder_id, url, title, type, icon_url, paused_at, created_at, updated_at)
            VALUES (2, 1, 1, 'https://example.com/paused-feed.xml', 'Paused Feed', 'rss', 'https://example.com/paused-icon.png', '2026-03-04 12:10:00.000', '2026-03-04 10:00:00.000', '2026-03-04 12:10:00.000');
        `);

        db.exec(`
            CREATE TABLE articles (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                feed_id INTEGER NOT NULL,
                guid TEXT NOT NULL,
                title TEXT,
                url TEXT,
                author TEXT,
                summary TEXT,
                enclosure_url TEXT,
                thumbnail_url TEXT,
                thumbnail_cached_path TEXT,
                is_bookmarked INTEGER DEFAULT 0,
                published_at TEXT,
                fetched_at TEXT DEFAULT CURRENT_TIMESTAMP,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            );
        `);

        db.exec(`
            CREATE TABLE read_state (
                user_id INTEGER NOT NULL,
                article_id INTEGER NOT NULL,
                is_read INTEGER DEFAULT 0,
                read_at TEXT,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (user_id, article_id)
            );
        `);

        const insertArticle = db.prepare(`
            INSERT INTO articles (
                id, feed_id, guid, title, url, author, summary, enclosure_url, thumbnail_url,
                published_at, fetched_at, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        const insertReadState = db.prepare(`
            INSERT INTO read_state (user_id, article_id, is_read, read_at, updated_at)
            VALUES (?, ?, ?, ?, ?)
        `);

        for (let i = 1; i <= 505; i++) {
            const articleId = i;
            const fetchedAt = `2026-03-04 12:${String(Math.floor((505 - i) / 60)).padStart(2, '0')}:${String((505 - i) % 60).padStart(2, '0')}.000`;
            insertArticle.run(
                articleId,
                1,
                `guid-${articleId}`,
                `Article ${articleId}`,
                `https://example.com/articles/${articleId}`,
                `Author ${articleId}`,
                `Summary ${articleId}`,
                articleId % 2 === 0 ? `https://example.com/audio/${articleId}.mp3` : null,
                `https://example.com/thumb/${articleId}.jpg`,
                fetchedAt,
                fetchedAt,
                fetchedAt,
                fetchedAt,
            );

            if (articleId % 10 === 0) {
                insertReadState.run(1, articleId, 1, fetchedAt, fetchedAt);
            }
        }

        insertArticle.run(
            506,
            2,
            'paused-guid-506',
            'Paused Feed Article',
            'https://example.com/paused/articles/506',
            'Paused Author',
            'Paused Summary',
            null,
            'https://example.com/thumb/506.jpg',
            '2026-03-04 12:11:00.000',
            '2026-03-04 12:11:00.000',
            '2026-03-04 12:11:00.000',
            '2026-03-04 12:11:00.000',
        );

        process.env.DATABASE_PATH = testDbPath;

        app = Fastify();
        app.addHook('onRequest', async (request) => {
            (request as any).user = { userId: 1, username: 'admin' };
        });

        const { syncRoutes } = await import('../../src/routes/sync.js');
        await app.register(syncRoutes, { prefix: '/api/v1/sync' });
    });

    afterEach(async () => {
        await app.close();
        db.close();
        try {
            unlinkSync(testDbPath);
        } catch {}
        delete process.env.DATABASE_PATH;

        const { closeDatabase } = await import('../../src/db/index.js');
        closeDatabase();
    });

    it('pages article sync windows without dropping articles', async () => {
        const firstResponse = await app.inject({
            method: 'GET',
            url: '/api/v1/sync?include=articles,read_state',
        });

        expect(firstResponse.statusCode).toBe(200);
        const firstBody = JSON.parse(firstResponse.payload);
        expect(firstBody.changes.articles.created).toHaveLength(500);
        expect(firstBody.changes.articles.created[0]).toMatchObject({
            id: 1,
            feed_id: 1,
            feed_title: 'Feed 1',
            feed_icon_url: 'https://example.com/icon.png',
            feed_type: 'rss',
            is_bookmarked: false,
        });
        expect(firstBody.changes.articles.created[1].has_audio).toBe(true);
        expect(firstBody.changes.read_state.read).toContain(10);

        const firstCursor = JSON.parse(Buffer.from(firstBody.next_cursor, 'base64').toString());
        expect(firstCursor.partial_articles).toBe(true);
        expect(firstCursor.window_end).toBeDefined();

        const secondResponse = await app.inject({
            method: 'GET',
            url: `/api/v1/sync?include=articles,read_state&cursor=${encodeURIComponent(firstBody.next_cursor)}`,
        });

        expect(secondResponse.statusCode).toBe(200);
        const secondBody = JSON.parse(secondResponse.payload);
        expect(secondBody.changes.articles.created).toHaveLength(5);
        expect(secondBody.changes.articles.created.map((article: { id: number }) => article.id)).toEqual([501, 502, 503, 504, 505]);

        const secondCursor = JSON.parse(Buffer.from(secondBody.next_cursor, 'base64').toString());
        expect(secondCursor.partial_articles).not.toBe(true);
        expect(secondCursor.last_sync_at).toBe(firstCursor.window_end);
    });

    it('does not surface newly fetched articles from paused feeds', async () => {
        const response = await app.inject({
            method: 'GET',
            url: '/api/v1/sync?include=articles',
        });

        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.payload);
        const pausedArticles = body.changes.articles.created.filter((article: { feed_id: number }) => article.feed_id === 2);
        expect(pausedArticles).toHaveLength(0);
    });
});
