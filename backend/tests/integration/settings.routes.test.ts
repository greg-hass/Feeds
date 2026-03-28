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
                deleted_at DATETIME,
                refresh_interval_minutes INTEGER DEFAULT 15,
                next_fetch_at DATETIME,
                updated_at DATETIME
            );
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
        expect(body.global_next_refresh_at).toBeTruthy();

        const refreshed = await app.inject({
            method: 'GET',
            url: '/api/v1/settings',
        });

        expect(refreshed.statusCode).toBe(200);
        expect(JSON.parse(refreshed.payload).settings.refresh_interval_minutes).toBe(30);
    });
});
