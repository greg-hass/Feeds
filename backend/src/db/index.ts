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

export function initializeDatabase(): void {
    const database = getDatabase();

    // Read schema
    const schemaPath = join(__dirname, 'schema.sql');
    const schema = readFileSync(schemaPath, 'utf-8');

    // better-sqlite3's exec() can handle multiple statements including triggers
    // We just need to remove PRAGMA statements (handled above) and comments
    const cleanedSchema = schema
        .split('\n')
        .map(line => {
            // Keep trigger lines that start with whitespace
            if (line.match(/^\s+/) && !line.trim().startsWith('--')) {
                return line;
            }
            // Remove comment-only lines
            if (line.trim().startsWith('--')) {
                return '';
            }
            // Remove PRAGMA lines (we handle these in code)
            if (line.trim().startsWith('PRAGMA')) {
                return '';
            }
            return line;
        })
        .join('\n');

    console.log('Initializing database schema...');

    try {
        // Execute the entire schema at once
        database.exec(cleanedSchema);
        console.log('Database initialized successfully');
    } catch (err) {
        // If it fails with "already exists", that's fine - tables exist
        if (err instanceof Error && err.message.includes('already exists')) {
            console.log('Database tables already exist');
        } else {
            console.error('Database initialization error:', err);
            throw err;
        }
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

export { db };
