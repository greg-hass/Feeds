import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import Fastify from 'fastify';
import Database from 'better-sqlite3';
import { tmpdir } from 'os';
import { join } from 'path';
import { unlinkSync } from 'fs';
import { closeDatabase } from '../../src/db/index.js';

vi.mock('../../src/services/feed-cleanup.js', () => ({
    cleanupOldArticles: vi.fn(),
}));

describe('Settings API Routes', () => {
    let app: FastifyInstance;
    let testDbPath: string;
    let db: Database.Database;

    beforeEach(async () => {
        closeDatabase();
        testDbPath = join(tmpdir(), `settings-test-${Date.now()}.db`);

        db = new Database(testDbPath);
        db.pragma('journal_mode = WAL');
        db.pragma('foreign_keys = ON');

        db.exec(`
            CREATE TABLE users (
                id INTEGER PRIMARY KEY,
                username TEXT NOT NULL,
                settings_json TEXT DEFAULT '{}'
            );
            INSERT INTO users (id, username, settings_json) VALUES (1, 'admin', '{}');
        `);

        db.exec(`
            CREATE TABLE feeds (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                folder_id INTEGER,
                url TEXT UNIQUE NOT NULL,
                title TEXT,
                type TEXT DEFAULT 'rss',
                paused_at DATETIME,
                deleted_at DATETIME,
                refresh_interval_minutes INTEGER DEFAULT 15,
                next_fetch_at DATETIME,
                updated_at DATETIME
            );
            INSERT INTO feeds (id, user_id, folder_id, url, title, type) VALUES
            (1, 1, NULL, 'https://example.com/feed.xml', 'Example Feed', 'rss');
        `);

        db.exec(`
            CREATE TABLE articles (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                feed_id INTEGER NOT NULL,
                guid TEXT NOT NULL,
                title TEXT,
                url TEXT,
                published_at DATETIME,
                is_bookmarked INTEGER DEFAULT 0
            );
            INSERT INTO articles (id, feed_id, guid, title, url, published_at, is_bookmarked) VALUES
            (1, 1, 'article-1', 'Article 1', 'https://example.com/article1', datetime('now', '-1 day'), 0),
            (2, 1, 'article-2', 'Article 2', 'https://example.com/article2', datetime('now', '-2 days'), 1);
        `);

        process.env.DATABASE_PATH = testDbPath;

        const { settingsRoutes } = await import('../../src/routes/settings.js');
        app = Fastify();
        await app.register(settingsRoutes, { prefix: '/api/v1/settings' });
    });

    afterEach(async () => {
        await app.close();
        db.close();
        closeDatabase();
        try {
            unlinkSync(testDbPath);
        } catch {
            // ignore
        }
        delete process.env.DATABASE_PATH;
    });

    it('returns keep_screen_awake enabled by default', async () => {
        const response = await app.inject({
            method: 'GET',
            url: '/api/v1/settings',
        });

        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.payload);
        expect(body.settings.keep_screen_awake).toBe(true);
        expect(body.global_last_refresh_at).toBeNull();
    });

    it('exports settings with refresh schedule metadata', async () => {
        const response = await app.inject({
            method: 'GET',
            url: '/api/v1/settings/export',
        });

        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.payload);
        expect(body.exported_at).toBeTruthy();
        expect(body.settings.keep_screen_awake).toBe(true);
        expect(body.global_last_refresh_at).toBeNull();
        expect(body.global_next_refresh_at).toBeNull();
    });

    it('persists keep_screen_awake when updating settings', async () => {
        const response = await app.inject({
            method: 'PATCH',
            url: '/api/v1/settings',
            payload: {
                keep_screen_awake: false,
            },
        });

        expect(response.statusCode).toBe(200);
        expect(JSON.parse(response.payload).settings.keep_screen_awake).toBe(false);

        const refreshed = await app.inject({
            method: 'GET',
            url: '/api/v1/settings',
        });

        expect(refreshed.statusCode).toBe(200);
        expect(JSON.parse(refreshed.payload).settings.keep_screen_awake).toBe(false);
    });

    it('persists refresh_interval_minutes when updating settings', async () => {
        const response = await app.inject({
            method: 'PATCH',
            url: '/api/v1/settings',
            payload: {
                refresh_interval_minutes: 30,
            },
        });

        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.payload);
        expect(body.settings.refresh_interval_minutes).toBe(30);
        expect(body.global_last_refresh_at).toBeNull();
        expect(body.global_next_refresh_at).toBeTruthy();

        const refreshed = await app.inject({
            method: 'GET',
            url: '/api/v1/settings',
        });

        expect(refreshed.statusCode).toBe(200);
        expect(JSON.parse(refreshed.payload).settings.refresh_interval_minutes).toBe(30);
    });

    it('exports and restores combined backup data', async () => {
        const exportResponse = await app.inject({
            method: 'GET',
            url: '/api/v1/settings/backup',
        });

        expect(exportResponse.statusCode).toBe(200);
        const exportBody = JSON.parse(exportResponse.payload);
        expect(exportBody.exported_at).toBeTruthy();
        expect(exportBody.bookmarks).toHaveLength(1);

        const restoreResponse = await app.inject({
            method: 'POST',
            url: '/api/v1/settings/backup',
            payload: {
                settings: {
                    refresh_interval_minutes: 45,
                },
                global_next_refresh_at: null,
                bookmarks: [
                    {
                        guid: 'article-1',
                        url: 'https://example.com/article1',
                    },
                ],
            },
        });

        expect(restoreResponse.statusCode).toBe(200);
        const restoreBody = JSON.parse(restoreResponse.payload);
        expect(restoreBody.success).toBe(true);
        expect(restoreBody.restored.settings).toBe(true);
        expect(restoreBody.restored.bookmarks).toBe(1);

        const settingsResponse = await app.inject({
            method: 'GET',
            url: '/api/v1/settings',
        });

        expect(JSON.parse(settingsResponse.payload).settings.refresh_interval_minutes).toBe(45);
    });
});
