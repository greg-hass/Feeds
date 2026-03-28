import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import Fastify from 'fastify';
import Database from 'better-sqlite3';
import { tmpdir } from 'os';
import { join } from 'path';
import { unlinkSync } from 'fs';

describe('Analytics API Routes', () => {
    let app: FastifyInstance;
    let testDbPath: string;
    let db: Database.Database;

    beforeEach(async () => {
        testDbPath = join(tmpdir(), `analytics-test-${Date.now()}.db`);

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
            CREATE TABLE reading_sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                article_id INTEGER NOT NULL,
                started_at TEXT NOT NULL,
                ended_at TEXT,
                duration_seconds INTEGER,
                scroll_depth_percent INTEGER DEFAULT 0,
                completed BOOLEAN DEFAULT 0,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            );
        `);

        db.exec(`
            CREATE TABLE article_stats (
                article_id INTEGER PRIMARY KEY,
                total_read_time_seconds INTEGER DEFAULT 0,
                read_count INTEGER DEFAULT 0,
                avg_scroll_depth INTEGER DEFAULT 0,
                completion_rate REAL DEFAULT 0,
                last_read_at TEXT,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            );
        `);

        db.exec(`
            CREATE TABLE feed_stats (
                feed_id INTEGER PRIMARY KEY,
                total_articles_read INTEGER DEFAULT 0,
                total_read_time_seconds INTEGER DEFAULT 0,
                avg_read_time_seconds INTEGER DEFAULT 0,
                engagement_score REAL DEFAULT 0,
                articles_completed INTEGER DEFAULT 0,
                last_engagement_at TEXT,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            );
        `);

        db.exec(`
            CREATE TABLE daily_reading_stats (
                user_id INTEGER NOT NULL,
                date TEXT NOT NULL,
                articles_read INTEGER DEFAULT 0,
                total_read_time_seconds INTEGER DEFAULT 0,
                sessions_count INTEGER DEFAULT 0,
                PRIMARY KEY (user_id, date)
            );
        `);

        db.exec(`
            INSERT INTO feeds (id, user_id, folder_id, url, title, type, created_at, updated_at)
            VALUES
                (1, 1, 1, 'https://example.com/active.xml', 'Active Feed', 'rss', '2026-03-04 10:00:00.000', '2026-03-04 10:00:00.000'),
                (2, 1, 1, 'https://example.com/paused.xml', 'Paused Feed', 'rss', '2026-03-04 10:00:00.000', '2026-03-04 12:10:00.000');

            UPDATE feeds SET paused_at = '2026-03-04 12:10:00.000' WHERE id = 2;
        `);

        db.exec(`
            INSERT INTO articles (id, feed_id, guid, title, url, summary, published_at, fetched_at, created_at, updated_at)
            VALUES
                (1, 1, 'active-guid-1', 'Active Article', 'https://example.com/active/1', 'Active summary', '2026-03-04 12:00:00.000', '2026-03-04 12:00:00.000', '2026-03-04 12:00:00.000', '2026-03-04 12:00:00.000'),
                (2, 2, 'paused-guid-1', 'Paused Article', 'https://example.com/paused/1', 'Paused summary', '2026-03-04 12:11:00.000', '2026-03-04 12:11:00.000', '2026-03-04 12:11:00.000', '2026-03-04 12:11:00.000');

            INSERT INTO reading_sessions (user_id, article_id, started_at, ended_at, duration_seconds, scroll_depth_percent, completed)
            VALUES (1, 1, '2026-03-04 12:00:00.000', '2026-03-04 12:05:00.000', 300, 100, 1);

            INSERT INTO article_stats (article_id, total_read_time_seconds, read_count, avg_scroll_depth, completion_rate, last_read_at)
            VALUES (1, 300, 1, 100, 1.0, '2026-03-04 12:05:00.000');

            INSERT INTO feed_stats (feed_id, total_articles_read, total_read_time_seconds, avg_read_time_seconds, engagement_score, articles_completed, last_engagement_at)
            VALUES
                (1, 1, 300, 300, 0.95, 1, '2026-03-04 12:05:00.000'),
                (2, 5, 1500, 300, 0.85, 4, '2026-03-04 12:10:00.000');

            INSERT INTO daily_reading_stats (user_id, date, articles_read, total_read_time_seconds, sessions_count)
            VALUES (1, date('now'), 1, 300, 1);
        `);

        process.env.DATABASE_PATH = testDbPath;

        app = Fastify();
        app.addHook('onRequest', async (request) => {
            (request as any).user = { userId: 1, username: 'admin' };
        });

        const { analyticsRoutes } = await import('../../src/routes/analytics.js');
        await app.register(analyticsRoutes, { prefix: '/api/v1/analytics' });
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

    it('excludes paused feeds from analytics top-feed rankings', async () => {
        const topResponse = await app.inject({
            method: 'GET',
            url: '/api/v1/analytics/feeds/top?limit=10',
        });

        expect(topResponse.statusCode).toBe(200);
        const topBody = JSON.parse(topResponse.payload);
        expect(topBody.feeds).toHaveLength(1);
        expect(topBody.feeds[0]).toMatchObject({
            feed_id: 1,
            title: 'Active Feed',
            total_articles_read: 1,
        });

        const overviewResponse = await app.inject({
            method: 'GET',
            url: '/api/v1/analytics/overview',
        });

        expect(overviewResponse.statusCode).toBe(200);
        const overviewBody = JSON.parse(overviewResponse.payload);
        expect(overviewBody.top_feeds).toHaveLength(1);
        expect(overviewBody.top_feeds[0]).toMatchObject({
            feed_id: 1,
            feed_title: 'Active Feed',
            articles_read: 1,
        });
    });
});
