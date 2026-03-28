import { queryAll, queryOne, run } from '../db/index.js';

// Alias for convenience
const query = queryAll;

// ============================================================================
// TYPES
// ============================================================================

export interface SearchFilters {
    query?: string;
    unread_only?: boolean;
    feed_id?: number;
    folder_id?: number;
    feed_ids?: number[];
    folder_ids?: number[];
    author?: string;
    tags?: string[];
    is_read?: boolean;
    is_bookmarked?: boolean;
    has_video?: boolean;
    has_audio?: boolean;
    date_from?: string; // ISO date
    date_to?: string; // ISO date
    type?: string; // rss, youtube, reddit, podcast
}

export interface SearchResult {
    id: number;
    title: string;
    url: string | null;
    author: string | null;
    summary: string | null;
    feed_id: number;
    feed_title: string;
    published_at: string | null;
    is_read: boolean;
    is_bookmarked: boolean;
    snippet?: string; // Highlighted snippet
    rank?: number; // FTS rank score
}

export interface SavedSearch {
    id: number;
    user_id: number;
    name: string;
    query: string;
    filters: SearchFilters;
    use_count: number;
    last_used_at: string | null;
    created_at: string;
    updated_at: string;
}

export interface SearchHistoryEntry {
    id: number;
    user_id: number;
    query: string;
    filters: SearchFilters;
    result_count: number;
    searched_at: string;
}

export interface SearchSuggestions {
    query: string;
    recent_searches: SearchHistoryEntry[];
    popular_searches: Array<{ query: string; count: number }>;
    saved_searches: SavedSearch[];
    tags: string[];
    authors: string[];
    feeds: Array<{ id: number; title: string; type: string }>;
    folders: Array<{ id: number; name: string }>;
    articles: SearchResult[];
}

// ============================================================================
// SEARCH OPERATIONS
// ============================================================================

/**
 * Advanced search with multiple filters
 */
export function searchArticles(
    userId: number,
    filters: SearchFilters,
    limit: number = 50,
    offset: number = 0
): SearchResult[] {
    const whereClauses: string[] = ['a.user_id = ?', 'a.deleted_at IS NULL'];
    const params: any[] = [userId];

    // Full-text search query
    if (filters.query && filters.query.trim()) {
        whereClauses.push(`(
            a.id IN (
                SELECT rowid FROM articles_fts
                WHERE articles_fts MATCH ?
            )
        )`);
        params.push(filters.query.trim());
    }

    // Feed filter
    if (filters.feed_ids && filters.feed_ids.length > 0) {
        whereClauses.push(`a.feed_id IN (${filters.feed_ids.map(() => '?').join(', ')})`);
        params.push(...filters.feed_ids);
    }

    // Folder filter
    if (filters.folder_ids && filters.folder_ids.length > 0) {
        whereClauses.push(`a.folder_id IN (${filters.folder_ids.map(() => '?').join(', ')})`);
        params.push(...filters.folder_ids);
    }

    // Author filter
    if (filters.author) {
        whereClauses.push('a.author LIKE ?');
        params.push(`%${filters.author}%`);
    }

    // Tags filter
    if (filters.tags && filters.tags.length > 0) {
        whereClauses.push(`a.id IN (
            SELECT article_id FROM article_tags
            WHERE tag IN (${filters.tags.map(() => '?').join(', ')})
        )`);
        params.push(...filters.tags);
    }

    // Read status filter
    if (filters.is_read !== undefined) {
        if (filters.is_read) {
            whereClauses.push('EXISTS (SELECT 1 FROM read_state WHERE article_id = a.id AND is_read = 1)');
        } else {
            whereClauses.push('NOT EXISTS (SELECT 1 FROM read_state WHERE article_id = a.id AND is_read = 1)');
        }
    }

    // Bookmark filter
    if (filters.is_bookmarked !== undefined) {
        whereClauses.push('a.is_bookmarked = ?');
        params.push(filters.is_bookmarked ? 1 : 0);
    }

    // Video filter
    if (filters.has_video !== undefined) {
        whereClauses.push('a.has_video = ?');
        params.push(filters.has_video ? 1 : 0);
    }

    // Audio filter
    if (filters.has_audio !== undefined) {
        whereClauses.push('a.has_audio = ?');
        params.push(filters.has_audio ? 1 : 0);
    }

    // Type filter
    if (filters.type) {
        whereClauses.push('f.type = ?');
        params.push(filters.type);
    }

    // Date range filter
    if (filters.date_from) {
        whereClauses.push('a.published_at >= ?');
        params.push(filters.date_from);
    }
    if (filters.date_to) {
        whereClauses.push('a.published_at <= ?');
        params.push(filters.date_to);
    }

    // Add limit and offset
    params.push(limit, offset);

    const sql = `
        SELECT
            a.id,
            a.title,
            a.url,
            a.author,
            a.summary,
            a.feed_id,
            f.title as feed_title,
            a.published_at,
            COALESCE(rs.is_read, 0) as is_read,
            a.is_bookmarked
        FROM articles a
        LEFT JOIN feeds f ON a.feed_id = f.id
        LEFT JOIN read_state rs ON a.id = rs.article_id AND rs.user_id = ?
        WHERE ${whereClauses.join(' AND ')}
        ORDER BY a.published_at DESC
        LIMIT ? OFFSET ?
    `;

    // Insert userId for read_state join at the beginning
    params.unshift(userId);

    const results = query<SearchResult>(sql, params);

    // Add snippets if there's a search query
    if (filters.query && filters.query.trim()) {
        return results.map(result => ({
            ...result,
            snippet: generateSnippet(result.title, result.summary || '', filters.query!),
        }));
    }

    return results;
}

/**
 * Count search results
 */
export function countSearchResults(userId: number, filters: SearchFilters): number {
    const whereClauses: string[] = ['a.user_id = ?', 'a.deleted_at IS NULL'];
    const params: any[] = [userId];

    // Apply same filters as searchArticles (without snippets)
    if (filters.query && filters.query.trim()) {
        whereClauses.push(`(
            a.id IN (
                SELECT rowid FROM articles_fts
                WHERE articles_fts MATCH ?
            )
        )`);
        params.push(filters.query.trim());
    }

    if (filters.feed_ids && filters.feed_ids.length > 0) {
        whereClauses.push(`a.feed_id IN (${filters.feed_ids.map(() => '?').join(', ')})`);
        params.push(...filters.feed_ids);
    }

    if (filters.folder_ids && filters.folder_ids.length > 0) {
        whereClauses.push(`a.folder_id IN (${filters.folder_ids.map(() => '?').join(', ')})`);
        params.push(...filters.folder_ids);
    }

    if (filters.author) {
        whereClauses.push('a.author LIKE ?');
        params.push(`%${filters.author}%`);
    }

    if (filters.tags && filters.tags.length > 0) {
        whereClauses.push(`a.id IN (
            SELECT article_id FROM article_tags
            WHERE tag IN (${filters.tags.map(() => '?').join(', ')})
        )`);
        params.push(...filters.tags);
    }

    if (filters.is_read !== undefined) {
        if (filters.is_read) {
            whereClauses.push('EXISTS (SELECT 1 FROM read_state WHERE article_id = a.id AND is_read = 1)');
        } else {
            whereClauses.push('NOT EXISTS (SELECT 1 FROM read_state WHERE article_id = a.id AND is_read = 1)');
        }
    }

    if (filters.is_bookmarked !== undefined) {
        whereClauses.push('a.is_bookmarked = ?');
        params.push(filters.is_bookmarked ? 1 : 0);
    }

    if (filters.has_video !== undefined) {
        whereClauses.push('a.has_video = ?');
        params.push(filters.has_video ? 1 : 0);
    }

    if (filters.has_audio !== undefined) {
        whereClauses.push('a.has_audio = ?');
        params.push(filters.has_audio ? 1 : 0);
    }

    if (filters.type) {
        whereClauses.push('f.type = ?');
        params.push(filters.type);
    }

    if (filters.date_from) {
        whereClauses.push('a.published_at >= ?');
        params.push(filters.date_from);
    }

    if (filters.date_to) {
        whereClauses.push('a.published_at <= ?');
        params.push(filters.date_to);
    }

    const sql = `
        SELECT COUNT(*) as count
        FROM articles a
        LEFT JOIN feeds f ON a.feed_id = f.id
        WHERE ${whereClauses.join(' AND ')}
    `;

    const result = queryOne<{ count: number }>(sql, params);
    return result?.count || 0;
}

/**
 * Generate snippet with highlighted query terms
 */
function generateSnippet(title: string, content: string, query: string, maxLength: number = 200): string {
    const terms = query.toLowerCase().split(/\s+/);
    const text = `${title} ${content}`.toLowerCase();

    // Find first occurrence of any term
    let startIndex = -1;
    for (const term of terms) {
        const index = text.indexOf(term);
        if (index !== -1 && (startIndex === -1 || index < startIndex)) {
            startIndex = index;
        }
    }

    if (startIndex === -1) {
        return content.substring(0, maxLength) + (content.length > maxLength ? '...' : '');
    }

    // Extract snippet around the match
    const snippetStart = Math.max(0, startIndex - 50);
    const snippetEnd = Math.min(text.length, startIndex + maxLength);
    let snippet = `${title} ${content}`.substring(snippetStart, snippetEnd);

    if (snippetStart > 0) snippet = '...' + snippet;
    if (snippetEnd < text.length) snippet = snippet + '...';

    return snippet.trim();
}

// ============================================================================
// SAVED SEARCHES
// ============================================================================

interface SavedSearchRow {
    id: number;
    user_id: number;
    name: string;
    query: string;
    filters: string; // JSON string
    use_count: number;
    last_used_at: string | null;
    created_at: string;
    updated_at: string;
}

/**
 * Get all saved searches for a user
 */
export function getSavedSearches(userId: number): SavedSearch[] {
    const searches = query<SavedSearchRow>(
        'SELECT * FROM saved_searches WHERE user_id = ? ORDER BY last_used_at DESC, name ASC',
        [userId]
    );

    return searches.map(search => ({
        ...search,
        filters: JSON.parse(search.filters) as SearchFilters,
    }));
}

/**
 * Create a saved search
 */
export function createSavedSearch(
    userId: number,
    name: string,
    searchQuery: string,
    filters: SearchFilters
): number {
    const result = run(
        `INSERT INTO saved_searches (user_id, name, query, filters)
         VALUES (?, ?, ?, ?)`,
        [userId, name, searchQuery, JSON.stringify(filters)]
    );
    return result.lastInsertRowid as number;
}

/**
 * Update a saved search
 */
export function updateSavedSearch(
    searchId: number,
    userId: number,
    updates: Partial<Pick<SavedSearch, 'name' | 'query' | 'filters'>>
): void {
    const setClauses: string[] = [];
    const values: any[] = [];

    if (updates.name !== undefined) {
        setClauses.push('name = ?');
        values.push(updates.name);
    }
    if (updates.query !== undefined) {
        setClauses.push('query = ?');
        values.push(updates.query);
    }
    if (updates.filters !== undefined) {
        setClauses.push('filters = ?');
        values.push(JSON.stringify(updates.filters));
    }

    setClauses.push('updated_at = datetime("now")');
    values.push(searchId, userId);

    run(
        `UPDATE saved_searches SET ${setClauses.join(', ')} WHERE id = ? AND user_id = ?`,
        values
    );
}

/**
 * Delete a saved search
 */
export function deleteSavedSearch(searchId: number, userId: number): void {
    run('DELETE FROM saved_searches WHERE id = ? AND user_id = ?', [searchId, userId]);
}

/**
 * Increment use count for a saved search
 */
export function incrementSavedSearchUseCount(searchId: number, userId: number): void {
    run(
        `UPDATE saved_searches
         SET use_count = use_count + 1, last_used_at = datetime("now")
         WHERE id = ? AND user_id = ?`,
        [searchId, userId]
    );
}

// ============================================================================
// SEARCH HISTORY
// ============================================================================

interface SearchHistoryRow {
    id: number;
    user_id: number;
    query: string;
    filters: string; // JSON string
    result_count: number;
    searched_at: string;
}

/**
 * Get search history for a user
 */
export function getSearchHistory(userId: number, limit: number = 50): SearchHistoryEntry[] {
    const history = query<SearchHistoryRow>(
        'SELECT * FROM search_history WHERE user_id = ? ORDER BY searched_at DESC LIMIT ?',
        [userId, limit]
    );

    return history.map(entry => ({
        ...entry,
        filters: JSON.parse(entry.filters) as SearchFilters,
    }));
}

/**
 * Add entry to search history
 */
export function addSearchHistory(
    userId: number,
    searchQuery: string,
    filters: SearchFilters,
    resultCount: number
): number {
    const result = run(
        `INSERT INTO search_history (user_id, query, filters, result_count)
         VALUES (?, ?, ?, ?)`,
        [userId, searchQuery, JSON.stringify(filters), resultCount]
    );
    return result.lastInsertRowid as number;
}

/**
 * Clear search history for a user
 */
export function clearSearchHistory(userId: number): void {
    run('DELETE FROM search_history WHERE user_id = ?', [userId]);
}

/**
 * Get popular search queries
 */
export function getPopularSearches(userId: number, limit: number = 10): Array<{ query: string; count: number }> {
    return query<{ query: string; count: number }>(
        `SELECT query, COUNT(*) as count
         FROM search_history
         WHERE user_id = ? AND query != ''
         GROUP BY query
         ORDER BY count DESC, MAX(searched_at) DESC
         LIMIT ?`,
        [userId, limit]
    );
}

function escapeLike(term: string): string {
    return term.replace(/[\\%_]/g, '\\$&');
}

/**
 * Get all unique tags for autocomplete
 */
export function getAllTags(userId: number, searchTerm: string = '', limit: number = 20): string[] {
    const trimmed = searchTerm.trim().toLowerCase();
    const params: unknown[] = [userId];
    let whereClause = 'article_id IN (SELECT id FROM articles WHERE user_id = ?)';

    if (trimmed) {
        whereClause += ' AND LOWER(tag) LIKE ? ESCAPE \'\\\'';
        params.push(`%${escapeLike(trimmed)}%`);
    }

    const tags = query<{ tag: string }>(
        `SELECT DISTINCT tag FROM article_tags
         WHERE ${whereClause}
         ORDER BY tag ASC
         LIMIT ?`,
        [...params, limit]
    );
    return tags.map(t => t.tag);
}

/**
 * Get all unique authors for autocomplete
 */
export function getAllAuthors(userId: number, searchTerm: string = '', limit: number = 20): string[] {
    const trimmed = searchTerm.trim().toLowerCase();
    const params: unknown[] = [userId];
    let whereClause = 'user_id = ? AND author IS NOT NULL AND author != \'\' AND deleted_at IS NULL';

    if (trimmed) {
        whereClause += ' AND LOWER(author) LIKE ? ESCAPE \'\\\'';
        params.push(`%${escapeLike(trimmed)}%`);
    }

    const authors = query<{ author: string }>(
        `SELECT DISTINCT author FROM articles
         WHERE ${whereClause}
         ORDER BY author ASC
         LIMIT ?`,
        [...params, limit]
    );
    return authors.map(a => a.author);
}

/**
 * Get all matching feeds for autocomplete
 */
export function getAllFeeds(
    userId: number,
    searchTerm: string = '',
    limit: number = 10
): Array<{ id: number; title: string; type: string }> {
    const trimmed = searchTerm.trim().toLowerCase();
    const params: unknown[] = [userId];
    let whereClause = 'user_id = ? AND deleted_at IS NULL';

    if (trimmed) {
        whereClause += ' AND (LOWER(title) LIKE ? ESCAPE \'\\\' OR LOWER(url) LIKE ? ESCAPE \'\\\' )';
        const like = `%${escapeLike(trimmed)}%`;
        params.push(like, like);
    }

    return query<{ id: number; title: string; type: string }>(
        `SELECT id, title, type
         FROM feeds
         WHERE ${whereClause}
         ORDER BY title ASC
         LIMIT ?`,
        [...params, limit]
    );
}

/**
 * Get all matching folders for autocomplete
 */
export function getAllFolders(
    userId: number,
    searchTerm: string = '',
    limit: number = 10
): Array<{ id: number; name: string }> {
    const trimmed = searchTerm.trim().toLowerCase();
    const params: unknown[] = [userId];
    let whereClause = 'user_id = ?';

    if (trimmed) {
        whereClause += ' AND LOWER(name) LIKE ? ESCAPE \'\\\'';
        params.push(`%${escapeLike(trimmed)}%`);
    }

    return query<{ id: number; name: string }>(
        `SELECT id, name
         FROM folders
         WHERE ${whereClause}
         ORDER BY name ASC
         LIMIT ?`,
        [...params, limit]
    );
}

/**
 * Build search suggestions for quick discovery
 */
export function getSearchSuggestions(
    userId: number,
    query: string = '',
    limit: number = 8
): SearchSuggestions {
    const trimmed = query.trim();
    const normalized = trimmed.toLowerCase();
    const suggestionLimit = Math.max(1, Math.min(limit, 20));
    const history = getSearchHistory(userId, suggestionLimit);
    const savedSearches = getSavedSearches(userId);

    return {
        query: trimmed,
        recent_searches: normalized
            ? history.filter(entry => entry.query.toLowerCase().includes(normalized)).slice(0, suggestionLimit)
            : history,
        popular_searches: getPopularSearches(userId, suggestionLimit),
        saved_searches: normalized
            ? savedSearches.filter(search =>
                search.name.toLowerCase().includes(normalized) ||
                search.query.toLowerCase().includes(normalized)
            ).slice(0, suggestionLimit)
            : savedSearches.slice(0, suggestionLimit),
        tags: getAllTags(userId, trimmed, suggestionLimit),
        authors: getAllAuthors(userId, trimmed, suggestionLimit),
        feeds: getAllFeeds(userId, trimmed, suggestionLimit),
        folders: getAllFolders(userId, trimmed, suggestionLimit),
        articles: trimmed.length > 1
            ? searchArticles(userId, { query: trimmed }, Math.min(suggestionLimit, 5), 0)
            : [],
    };
}
