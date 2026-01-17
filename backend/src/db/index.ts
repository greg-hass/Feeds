import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Database singleton
let db: Database.Database | null = null;

export interface DatabaseConfig {
    path: string;
    verbose?: boolean;
}

export function getDatabase(config?: DatabaseConfig): Database.Database {
    if (db) return db;

    const dbPath = config?.path || process.env.DATABASE_PATH || './data/feeds.db';

    db = new Database(dbPath, {
        verbose: config?.verbose ? console.log : undefined,
    });

    // Enable WAL mode and foreign keys
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');

    return db;
}

import { runMigrations } from './migrate.js';

export function initializeDatabase(): void {
    const database = getDatabase();
    console.log('Initializing database and running migrations...');

    try {
        runMigrations(database);
    } catch (err) {
        console.error('Database migration error:', err);
        throw err;
    }
}

export function closeDatabase(): void {
    if (db) {
        db.close();
        db = null;
    }
}

// Type-safe query helpers
export type Row = Record<string, unknown>;

export function queryOne<T = Row>(sql: string, params: unknown[] = []): T | undefined {
    const database = getDatabase();
    return database.prepare(sql).get(...params) as T | undefined;
}

export function queryAll<T = Row>(sql: string, params: unknown[] = []): T[] {
    const database = getDatabase();
    return database.prepare(sql).all(...params) as T[];
}

export function run(sql: string, params: unknown[] = []): Database.RunResult {
    const database = getDatabase();
    return database.prepare(sql).run(...params);
}

export function runMany(sql: string, paramsList: unknown[][]): void {
    const database = getDatabase();
    const stmt = database.prepare(sql);
    const runAll = database.transaction((list: unknown[][]) => {
        for (const params of list) {
            stmt.run(...params);
        }
    });
    runAll(paramsList);
}

// Export db getter as 'db' for convenience
export { getDatabase as db };
