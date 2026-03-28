/**
 * Initialize sync infrastructure on app start.
 *
 * This currently remains a no-op, but lives in its own module so the app root
 * does not need to import the entire store barrel just to call it.
 */
export function initializeSync(): void {
    // Manual sync only. No background work to initialize.
}
