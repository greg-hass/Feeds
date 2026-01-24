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
 * Update a highlight
 */
export function updateHighlight(
    highlightId: number,
    userId: number,
    updates: Partial<Pick<Highlight, 'color' | 'note'>>
): void {
    const setClauses: string[] = [];
    const values: any[] = [];

    if (updates.color !== undefined) {
        setClauses.push('color = ?');
        values.push(updates.color);
    }
    if (updates.note !== undefined) {
        setClauses.push('note = ?');
        values.push(updates.note);
    }

    if (setClauses.length === 0) return;

    setClauses.push('updated_at = datetime("now")');
    values.push(highlightId, userId);

    run(
        `UPDATE highlights SET ${setClauses.join(', ')} WHERE id = ? AND user_id = ?`,
        values
    );
}

/**
 * Delete a highlight
 */
export function deleteHighlight(highlightId: number, userId: number): void {
    run('DELETE FROM highlights WHERE id = ? AND user_id = ?', [highlightId, userId]);
}

// ============================================================================
// READING PROGRESS
// ============================================================================

/**
 * Get reading progress for an article
 */
export function getReadingProgress(userId: number, articleId: number): ReadingProgress | null {
    return queryOne<ReadingProgress>(
        `SELECT * FROM reading_progress WHERE user_id = ? AND article_id = ?`,
        [userId, articleId]
    );
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

/**
 * Delete reading progress
 */
export function deleteReadingProgress(userId: number, articleId: number): void {
    run('DELETE FROM reading_progress WHERE user_id = ? AND article_id = ?', [userId, articleId]);
}

// ============================================================================
// TABLE OF CONTENTS
// ============================================================================

export interface TocItem {
    level: number;
    text: string;
    id: string;
}

/**
 * Generate table of contents from HTML content
 */
export function generateTableOfContents(htmlContent: string): TocItem[] {
    const toc: TocItem[] = [];
    const headingRegex = /<h([1-6])[^>]*>(.*?)<\/h\1>/gi;
    let match;
    let counter = 1;

    while ((match = headingRegex.exec(htmlContent)) !== null) {
        const level = parseInt(match[1], 10);
        const rawText = match[2];
        const text = rawText.replace(/<[^>]*>/g, '').trim();

        if (text) {
            const id = `heading-${counter}-${text
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/^-|-$/g, '')
                .substring(0, 50)}`;

            toc.push({ level, text, id });
            counter++;
        }
    }

    return toc;
}

/**
 * Inject IDs into heading tags for TOC navigation
 */
export function injectHeadingIds(htmlContent: string, toc: TocItem[]): string {
    let modifiedContent = htmlContent;
    let tocIndex = 0;

    modifiedContent = modifiedContent.replace(/<h([1-6])[^>]*>(.*?)<\/h\1>/gi, (match, level, content) => {
        if (tocIndex < toc.length) {
            const tocItem = toc[tocIndex];
            tocIndex++;
            return `<h${level} id="${tocItem.id}">${content}</h${level}>`;
        }
        return match;
    });

    return modifiedContent;
}
