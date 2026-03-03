import { db } from '../db/index.js';

let feedsSchemaEnsured = false;

/**
 * Schema self-healing is disabled in favor of deterministic migrations.
 * All schema changes should be applied via migrations in db/migrations/.
 * This function is kept as a no-op for backward compatibility.
 */
export function ensureFeedsSchema() {
    if (feedsSchemaEnsured) return;
    // Migrations handle all schema changes deterministically.
    // This function remains as a hook point for future runtime schema validation
    // (e.g., checking that required columns exist and logging warnings).
    feedsSchemaEnsured = true;
}
