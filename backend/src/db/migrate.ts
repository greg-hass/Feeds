import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Database } from 'better-sqlite3';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export function runMigrations(db: Database): void {
    const migrationsDir = join(__dirname, 'migrations');

    // Ensure migration table exists
    db.exec(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
            version INTEGER PRIMARY KEY,
            applied_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
    `);

    // Get applied migrations
    const appliedRows = db.prepare('SELECT version FROM schema_migrations ORDER BY version ASC').all() as { version: number }[];
    const appliedVersions = new Set(appliedRows.map(row => row.version));

    // Read and sort migration files
    const files = readdirSync(migrationsDir)
        .filter((f: string) => f.endsWith('.sql'))
        .sort();

    console.log(`Checking for migrations in ${migrationsDir}...`);

    for (const file of files) {
        const versionMatch = file.match(/^(\d+)/);
        if (!versionMatch) {
            console.warn(`Skipping invalid migration file: ${file}`);
            continue;
        }

        const version = parseInt(versionMatch[1], 10);
        if (appliedVersions.has(version)) {
            continue;
        }

        console.log(`Applying migration: ${file}`);
        const sql = readFileSync(join(migrationsDir, file), 'utf-8');

        // Use transaction for each migration
        const migrate = db.transaction((sqlText: string) => {
            db.exec(sqlText);
            db.prepare('INSERT INTO schema_migrations (version) VALUES (?)').run(version);
        });

        try {
            migrate(sql);
            console.log(`Successfully applied migration ${version}`);
        } catch (err: any) {
            // Handle idempotent migrations (e.g., column already exists)
            const msg = err?.message || '';
            if (msg.includes('duplicate column name') || msg.includes('already exists')) {
                console.log(`Migration ${version} already applied (idempotent), marking as complete`);
                db.prepare('INSERT OR IGNORE INTO schema_migrations (version) VALUES (?)').run(version);
            } else {
                console.error(`Failed to apply migration ${file}:`, err);
                throw err;
            }
        }
    }

    console.log('All migrations applied successfully');
}
