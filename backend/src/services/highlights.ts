import { queryAll, queryOne, run } from '../db/index.js';

// Alias for convenience
const query = queryAll;

// ============================================================================
// TYPES
// ============================================================================

export interface Highlight {
    id: number;
    user_id: number;
    article_id: number;
    text: string;
    start_offset: number;
    end_offset: number;
    color: 'yellow' | 'green' | 'blue' | 'pink' | 'purple';
    note: string | null;
    created_at: string;
    updated_at: string;
}

export interface ReadingProgress {
    id: number;
    user_id: number;
    article_id: number;
    scroll_position: number;
    scroll_percentage: number;
    last_read_at: string;
}

// ============================================================================
// HIGHLIGHTS
// ============================================================================

/**
 * Get all highlights for an article
 */
export function getHighlights(userId: number, articleId: number): Highlight[] {
    return query<Highlight>(
        `SELECT * FROM highlights
         WHERE user_id = ? AND article_id = ?
         ORDER BY start_offset ASC`,
        [userId, articleId]
    );
}

/**
 * Create a highlight
 */
export function createHighlight(
    userId: number,
    articleId: number,
    text: string,
    startOffset: number,
    endOffset: number,
    color: Highlight['color'] = 'yellow',
    note?: string
): number {
    const result = run(
        `INSERT INTO highlights (user_id, article_id, text, start_offset, end_offset, color, note)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [userId, articleId, text, startOffset, endOffset, color, note || null]
    );
    return result.lastInsertRowid as number;
}

/**
 * Update reading progress
 */
export function updateReadingProgress(
    userId: number,
    articleId: number,
    scrollPosition: number,
    scrollPercentage: number
): void {
    run(
        `INSERT INTO reading_progress (user_id, article_id, scroll_position, scroll_percentage, last_read_at)
         VALUES (?, ?, ?, ?, datetime('now'))
         ON CONFLICT(user_id, article_id) DO UPDATE SET
             scroll_position = excluded.scroll_position,
             scroll_percentage = excluded.scroll_percentage,
             last_read_at = excluded.last_read_at`,
        [userId, articleId, scrollPosition, scrollPercentage]
    );
}
