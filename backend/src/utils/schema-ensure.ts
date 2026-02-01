import { db } from '../db/index.js';

let feedsSchemaEnsured = false;

export function ensureFeedsSchema() {
    if (feedsSchemaEnsured) return;
    try {
        const database = db();
        // Ensure icon_updated_at column exists
        try { 
            database.exec("ALTER TABLE feeds ADD COLUMN icon_updated_at TEXT"); 
            // If we just added it, initialize it
            database.exec("UPDATE feeds SET icon_updated_at = updated_at WHERE icon_updated_at IS NULL");
        } catch {}
        
        // Ensure other critical columns if needed
        try { database.exec("ALTER TABLE feeds ADD COLUMN icon_cached_path TEXT"); } catch {}
        try { database.exec("ALTER TABLE feeds ADD COLUMN icon_cached_content_type TEXT"); } catch {}
        try { database.exec("ALTER TABLE feeds ADD COLUMN paused_at TEXT"); } catch {}
        try { database.exec("ALTER TABLE feeds ADD COLUMN deleted_at TEXT"); } catch {}
        
    } catch (err) {
        console.error('Failed to ensure feeds schema:', err);
    }
    feedsSchemaEnsured = true;
}
