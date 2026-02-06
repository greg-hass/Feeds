import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { join } from 'path';
import { tmpdir } from 'os';
import { unlinkSync } from 'fs';

// Import the functions we want to test
import {
    getDatabase,
    initializeDatabase,
    closeDatabase,
    queryOne,
    queryAll,
    run,
    runMany,
} from '../../src/db/index.js';

describe('Database Operations', () => {
    let testDbPath: string;
    let testDb: Database.Database;

    beforeEach(() => {
        // Create a temporary database for each test
        testDbPath = join(tmpdir(), `feeds-test-${Date.now()}.db`);
        
        // Clear any existing database connection
        closeDatabase();
    });

    afterEach(() => {
        // Clean up
        closeDatabase();
        try {
            unlinkSync(testDbPath);
        } catch {
            // File might not exist
        }
    });

    describe('getDatabase', () => {
        it('should create database with default path', () => {
            const db = getDatabase();
            expect(db).toBeDefined();
            expect(db.open).toBe(true);
        });

        it('should create database with custom path', () => {
            const db = getDatabase({ path: testDbPath });
            expect(db).toBeDefined();
            expect(db.open).toBe(true);
        });

        it('should return same database instance (singleton)', () => {
            const db1 = getDatabase({ path: testDbPath });
            const db2 = getDatabase({ path: testDbPath });
            expect(db1).toBe(db2);
        });

        it('should enable WAL mode', () => {
            const db = getDatabase({ path: testDbPath });
            const result = db.pragma('journal_mode');
            expect(result).toEqual([{ journal_mode: 'wal' }]);
        });

        it('should enable foreign keys', () => {
            const db = getDatabase({ path: testDbPath });
            const result = db.pragma('foreign_keys');
            expect(result).toEqual([{ foreign_keys: 1 }]);
        });
    });

    describe('queryOne', () => {
        beforeEach(() => {
            const db = getDatabase({ path: testDbPath });
            db.exec(`
                CREATE TABLE test_table (
                    id INTEGER PRIMARY KEY,
                    name TEXT NOT NULL,
                    value INTEGER
                )
            `);
            db.exec(`
                INSERT INTO test_table (id, name, value) VALUES
                (1, 'test1', 100),
                (2, 'test2', 200),
                (3, 'test3', 300)
            `);
        });

        it('should return single row by ID', () => {
            const row = queryOne<{ id: number; name: string; value: number }>('SELECT * FROM test_table WHERE id = ?', [1]);
            
            expect(row).toBeDefined();
            expect(row?.id).toBe(1);
            expect(row?.name).toBe('test1');
            expect(row?.value).toBe(100);
        });

        it('should return undefined for non-existent row', () => {
            const row = queryOne('SELECT * FROM test_table WHERE id = ?', [999]);
            expect(row).toBeUndefined();
        });

        it('should work without parameters', () => {
            const row = queryOne('SELECT * FROM test_table WHERE id = 1');
            expect(row).toBeDefined();
            expect(row?.name).toBe('test1');
        });
    });

    describe('queryAll', () => {
        beforeEach(() => {
            const db = getDatabase({ path: testDbPath });
            db.exec(`
                CREATE TABLE test_table (
                    id INTEGER PRIMARY KEY,
                    name TEXT NOT NULL,
                    value INTEGER
                )
            `);
            db.exec(`
                INSERT INTO test_table (id, name, value) VALUES
                (1, 'test1', 100),
                (2, 'test2', 200),
                (3, 'test3', 300)
            `);
        });

        it('should return all rows', () => {
            const rows = queryAll<{ id: number; name: string; value: number }>('SELECT * FROM test_table ORDER BY id');
            
            expect(rows).toHaveLength(3);
            expect(rows[0].name).toBe('test1');
            expect(rows[1].name).toBe('test2');
            expect(rows[2].name).toBe('test3');
        });

        it('should return filtered rows', () => {
            const rows = queryAll('SELECT * FROM test_table WHERE value > ?', [150]);
            
            expect(rows).toHaveLength(2);
            expect(rows[0].name).toBe('test2');
            expect(rows[1].name).toBe('test3');
        });

        it('should return empty array for no matches', () => {
            const rows = queryAll('SELECT * FROM test_table WHERE id > ?', [999]);
            expect(rows).toEqual([]);
        });
    });

    describe('run', () => {
        beforeEach(() => {
            const db = getDatabase({ path: testDbPath });
            db.exec(`
                CREATE TABLE test_table (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL,
                    value INTEGER
                )
            `);
        });

        it('should insert row and return lastInsertRowid', () => {
            const result = run('INSERT INTO test_table (name, value) VALUES (?, ?)', ['new-item', 42]);
            
            expect(result.changes).toBe(1);
            expect(result.lastInsertRowid).toBeGreaterThan(0);
        });

        it('should update rows and return changes count', () => {
            run('INSERT INTO test_table (name, value) VALUES (?, ?)', ['item1', 10]);
            run('INSERT INTO test_table (name, value) VALUES (?, ?)', ['item2', 20]);
            
            const result = run('UPDATE test_table SET value = ? WHERE value < ?', [100, 25]);
            
            expect(result.changes).toBe(2);
        });

        it('should delete rows and return changes count', () => {
            run('INSERT INTO test_table (name, value) VALUES (?, ?)', ['item1', 10]);
            run('INSERT INTO test_table (name, value) VALUES (?, ?)', ['item2', 20]);
            
            const result = run('DELETE FROM test_table WHERE value = ?', [10]);
            
            expect(result.changes).toBe(1);
        });
    });

    describe('runMany', () => {
        beforeEach(() => {
            const db = getDatabase({ path: testDbPath });
            db.exec(`
                CREATE TABLE test_table (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL,
                    value INTEGER
                )
            `);
        });

        it('should insert multiple rows in transaction', () => {
            const paramsList = [
                ['item1', 10],
                ['item2', 20],
                ['item3', 30],
            ];
            
            runMany('INSERT INTO test_table (name, value) VALUES (?, ?)', paramsList);
            
            const rows = queryAll('SELECT * FROM test_table ORDER BY id');
            expect(rows).toHaveLength(3);
            expect(rows[0].name).toBe('item1');
            expect(rows[1].name).toBe('item2');
            expect(rows[2].name).toBe('item3');
        });

        it('should rollback on error', () => {
            const paramsList = [
                ['item1', 10],
                ['item2', 20],
                [null, 30], // This should fail due to NOT NULL constraint
            ];
            
            expect(() => {
                runMany('INSERT INTO test_table (name, value) VALUES (?, ?)', paramsList);
            }).toThrow();
            
            // No rows should be inserted due to transaction rollback
            const rows = queryAll('SELECT * FROM test_table');
            expect(rows).toHaveLength(0);
        });
    });

    describe('closeDatabase', () => {
        it('should close database connection', () => {
            const db = getDatabase({ path: testDbPath });
            expect(db.open).toBe(true);
            
            closeDatabase();
            
            expect(db.open).toBe(false);
        });

        it('should allow reopening after close', () => {
            getDatabase({ path: testDbPath });
            closeDatabase();
            
            const db2 = getDatabase({ path: testDbPath });
            expect(db2.open).toBe(true);
        });
    });

    describe('Real-world feed operations', () => {
        beforeEach(() => {
            const db = getDatabase({ path: testDbPath });
            
            // Create tables similar to the actual schema
            db.exec(`
                CREATE TABLE feeds (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    url TEXT UNIQUE NOT NULL,
                    title TEXT,
                    description TEXT,
                    type TEXT DEFAULT 'rss',
                    folder_id INTEGER,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
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
                    published_at DATETIME,
                    is_read INTEGER DEFAULT 0,
                    is_starred INTEGER DEFAULT 0,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(feed_id, guid)
                )
            `);
            
            db.exec(`
                CREATE TABLE folders (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `);
        });

        it('should insert and retrieve feed', () => {
            const result = run(
                'INSERT INTO feeds (url, title, type) VALUES (?, ?, ?)',
                ['https://example.com/feed.xml', 'Test Feed', 'rss']
            );
            
            const feed = queryOne('SELECT * FROM feeds WHERE id = ?', [result.lastInsertRowid]);
            expect(feed?.title).toBe('Test Feed');
            expect(feed?.url).toBe('https://example.com/feed.xml');
        });

        it('should insert articles with foreign key constraint', () => {
            const feedResult = run(
                'INSERT INTO feeds (url, title) VALUES (?, ?)',
                ['https://example.com/feed.xml', 'Test Feed']
            );
            
            const articleResult = run(
                'INSERT INTO articles (feed_id, guid, title, url) VALUES (?, ?, ?, ?)',
                [feedResult.lastInsertRowid, 'article-1', 'Test Article', 'https://example.com/article-1']
            );
            
            expect(articleResult.changes).toBe(1);
            
            const article = queryOne('SELECT * FROM articles WHERE id = ?', [articleResult.lastInsertRowid]);
            expect(article?.title).toBe('Test Article');
        });

        it('should enforce unique constraint on feed URL', () => {
            run('INSERT INTO feeds (url, title) VALUES (?, ?)', ['https://example.com/feed.xml', 'Feed 1']);
            
            expect(() => {
                run('INSERT INTO feeds (url, title) VALUES (?, ?)', ['https://example.com/feed.xml', 'Feed 2']);
            }).toThrow();
        });

        it('should query articles by feed', () => {
            const feedResult = run(
                'INSERT INTO feeds (url, title) VALUES (?, ?)',
                ['https://example.com/feed.xml', 'Test Feed']
            );
            const feedId = feedResult.lastInsertRowid;
            
            runMany(
                'INSERT INTO articles (feed_id, guid, title) VALUES (?, ?, ?)',
                [
                    [feedId, 'article-1', 'Article 1'],
                    [feedId, 'article-2', 'Article 2'],
                    [feedId, 'article-3', 'Article 3'],
                ]
            );
            
            const articles = queryAll('SELECT * FROM articles WHERE feed_id = ? ORDER BY id', [feedId]);
            expect(articles).toHaveLength(3);
        });

        it('should update article read status', () => {
            const feedResult = run(
                'INSERT INTO feeds (url, title) VALUES (?, ?)',
                ['https://example.com/feed.xml', 'Test Feed']
            );
            
            const articleResult = run(
                'INSERT INTO articles (feed_id, guid, title, is_read) VALUES (?, ?, ?, ?)',
                [feedResult.lastInsertRowid, 'article-1', 'Test Article', 0]
            );
            
            run('UPDATE articles SET is_read = ? WHERE id = ?', [1, articleResult.lastInsertRowid]);
            
            const article = queryOne('SELECT * FROM articles WHERE id = ?', [articleResult.lastInsertRowid]);
            expect(article?.is_read).toBe(1);
        });

        it('should count unread articles', () => {
            const feedResult = run(
                'INSERT INTO feeds (url, title) VALUES (?, ?)',
                ['https://example.com/feed.xml', 'Test Feed']
            );
            const feedId = feedResult.lastInsertRowid;
            
            runMany(
                'INSERT INTO articles (feed_id, guid, title, is_read) VALUES (?, ?, ?, ?)',
                [
                    [feedId, 'article-1', 'Article 1', 0],
                    [feedId, 'article-2', 'Article 2', 0],
                    [feedId, 'article-3', 'Article 3', 1],
                ]
            );
            
            const result = queryOne<{ count: number }>('SELECT COUNT(*) as count FROM articles WHERE feed_id = ? AND is_read = 0', [feedId]);
            expect(result?.count).toBe(2);
        });
    });
});
