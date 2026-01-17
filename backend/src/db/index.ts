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

    // Read and execute schema
    const schemaPath = join(__dirname, 'schema.sql');
    const schema = readFileSync(schemaPath, 'utf-8');

    // Split by semicolons and execute each statement
    const statements = schema
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'));

    database.transaction(() => {
        for (const statement of statements) {
            try {
                database.exec(statement);
            } catch (err) {
                // Ignore "already exists" errors for IF NOT EXISTS statements
                if (!(err instanceof Error && err.message.includes('already exists'))) {
                    console.error('Failed to execute:', statement.substring(0, 100));
                    throw err;
                }
            }
        }
    })();

    console.log('Database initialized successfully');
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
