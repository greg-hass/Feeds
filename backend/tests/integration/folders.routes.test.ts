import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import Fastify from 'fastify';
import Database from 'better-sqlite3';
import { tmpdir } from 'os';
import { join } from 'path';
import { unlinkSync } from 'fs';

describe('Folders API Routes', () => {
    let app: FastifyInstance;
    let testDbPath: string;
    let db: Database.Database;

    beforeEach(async () => {
        testDbPath = join(tmpdir(), `folders-test-${Date.now()}.db`);

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
            INSERT INTO folders (id, user_id, name, created_at, updated_at)
            VALUES (1, 1, 'Default', '2026-03-04 10:00:00.000', '2026-03-04 10:00:00.000');
        `);

        db.exec(`
            CREATE TABLE feeds (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                folder_id INTEGER,
                url TEXT NOT NULL,
                title TEXT,
                type TEXT DEFAULT 'rss',
                paused_at TEXT,
                deleted_at TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            );
        `);

        db.exec(`
            CREATE TABLE articles (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                feed_id INTEGER NOT NULL,
                guid TEXT NOT NULL,
                title TEXT,
                url TEXT,
                summary TEXT,
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

        db.exec(`
            INSERT INTO feeds (id, user_id, folder_id, url, title, type, created_at, updated_at)
            VALUES (1, 1, 1, 'https://example.com/active.xml', 'Active Feed', 'rss', '2026-03-04 10:00:00.000', '2026-03-04 10:00:00.000');

            INSERT INTO feeds (id, user_id, folder_id, url, title, type, paused_at, created_at, updated_at)
            VALUES (2, 1, 1, 'https://example.com/paused.xml', 'Paused Feed', 'rss', '2026-03-04 12:10:00.000', '2026-03-04 10:00:00.000', '2026-03-04 12:10:00.000');
        `);

        db.exec(`
            INSERT INTO articles (id, feed_id, guid, title, url, summary, published_at, fetched_at, created_at, updated_at)
            VALUES
                (1, 1, 'active-guid-1', 'Active Article', 'https://example.com/active/1', 'Active summary', '2026-03-04 12:00:00.000', '2026-03-04 12:00:00.000', '2026-03-04 12:00:00.000', '2026-03-04 12:00:00.000'),
                (2, 2, 'paused-guid-1', 'Paused Article', 'https://example.com/paused/1', 'Paused summary', '2026-03-04 12:11:00.000', '2026-03-04 12:11:00.000', '2026-03-04 12:11:00.000', '2026-03-04 12:11:00.000');
        `);

        process.env.DATABASE_PATH = testDbPath;

        app = Fastify();
        app.addHook('onRequest', async (request) => {
            (request as any).user = { userId: 1, username: 'admin' };
        });

        const { foldersRoutes } = await import('../../src/routes/folders.js');
        await app.register(foldersRoutes, { prefix: '/api/v1/folders' });
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

    it('omits paused feeds from unread folder and smart-folder counts', async () => {
        const response = await app.inject({
            method: 'GET',
            url: '/api/v1/folders',
        });

        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.payload);

        expect(body.folders).toHaveLength(1);
        expect(body.folders[0]).toMatchObject({
            id: 1,
            feed_count: 2,
            unread_count: 1,
        });

        const rssFolder = body.smart_folders.find((folder: { type: string }) => folder.type === 'rss');
        expect(rssFolder).toMatchObject({
            type: 'rss',
            unread_count: 1,
        });

        expect(body.totals.all_unread).toBe(1);
    });
});
