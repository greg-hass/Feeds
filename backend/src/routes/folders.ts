import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { queryOne, queryAll, run } from '../db/index.js';
import { Folder, SmartFolder } from '../types/index.js';

const createFolderSchema = z.object({
    name: z.string().min(1).max(100),
    position: z.number().optional(),
});

const updateFolderSchema = z.object({
    name: z.string().min(1).max(100).optional(),
    position: z.number().optional(),
});

export async function foldersRoutes(app: FastifyInstance) {
    // Single user app - user_id is always 1
    const userId = 1;

    // List folders with smart folders
    app.get('/', async (request: FastifyRequest) => {

        // Pre-aggregate feed counts and unread counts in single query (O(1) instead of O(N) subqueries)
        const folderFeedCounts = queryAll<{ folder_id: number; feed_count: number }>(
            `SELECT folder_id, COUNT(*) as feed_count
             FROM feeds
             WHERE user_id = ? AND deleted_at IS NULL AND folder_id IS NOT NULL
             GROUP BY folder_id`,
            [userId]
        );

        const folderUnreadCounts = queryAll<{ folder_id: number; unread_count: number }>(
            `SELECT fe.folder_id, COUNT(*) as unread_count
             FROM articles a
             JOIN feeds fe ON fe.id = a.feed_id
             LEFT JOIN read_state rs ON rs.article_id = a.id AND rs.user_id = ?
             WHERE fe.user_id = ? AND fe.deleted_at IS NULL AND fe.folder_id IS NOT NULL
             AND (rs.is_read IS NULL OR rs.is_read = 0)
             GROUP BY fe.folder_id`,
            [userId, userId]
        );

        // Create lookup maps for O(1) access
        const feedCountMap = new Map(folderFeedCounts.map(fc => [fc.folder_id, fc.feed_count]));
        const unreadCountMap = new Map(folderUnreadCounts.map(uc => [uc.folder_id, uc.unread_count]));

        // Fetch folders without expensive subqueries
        const folders = queryAll<Folder>(
            `SELECT f.*
             FROM folders f
             WHERE f.user_id = ? AND f.deleted_at IS NULL
             ORDER BY f.position, f.name`,
            [userId]
        ).map(folder => ({
            ...folder,
            feed_count: feedCountMap.get(folder.id) || 0,
            unread_count: unreadCountMap.get(folder.id) || 0
        }));

        // Smart folders (by feed type)
        const smartFolders: SmartFolder[] = [];
        const types = ['rss', 'youtube', 'reddit', 'podcast'];
        const displayNames: Record<string, string> = {
            rss: 'RSS',
            youtube: 'YouTube',
            reddit: 'Reddit',
            podcast: 'Podcasts',
        };

        // Single query with GROUP BY to get all counts at once (was 5 separate queries)
        const typeCounts = queryAll<{ type: string; unread_count: number }>(
            `SELECT f.type, COUNT(*) as unread_count
             FROM articles a
             JOIN feeds f ON f.id = a.feed_id
             LEFT JOIN read_state rs ON rs.article_id = a.id AND rs.user_id = ?
             WHERE f.user_id = ? AND f.deleted_at IS NULL
             AND (rs.is_read IS NULL OR rs.is_read = 0)
             GROUP BY f.type`,
            [userId, userId]
        );

        // Create a map for O(1) lookups
        const typeCountMap = new Map(typeCounts.map(tc => [tc.type, tc.unread_count]));

        // Build smart folders with counts
        for (const type of types) {
            smartFolders.push({
                type,
                name: displayNames[type] || type,
                unread_count: typeCountMap.get(type) || 0,
            });
        }

        // Calculate "All" total from the counts we already have
        const allUnread = { unread_count: typeCounts.reduce((sum, tc) => sum + tc.unread_count, 0) };

        return {
            folders,
            smart_folders: smartFolders,
            totals: {
                all_unread: allUnread?.unread_count || 0,
            },
        };
    });

    // Create folder
    app.post('/', async (request: FastifyRequest, reply: FastifyReply) => {
        const body = createFolderSchema.parse(request.body);

        // Check for duplicate name
        const existing = queryOne<Folder>(
            'SELECT id FROM folders WHERE user_id = ? AND name = ? AND deleted_at IS NULL',
            [userId, body.name]
        );

        if (existing) {
            return reply.status(409).send({ error: 'Folder with this name already exists' });
        }

        // Get next position if not specified
        let position = body.position;
        if (position === undefined) {
            const maxPos = queryOne<{ max_pos: number }>(
                'SELECT COALESCE(MAX(position), -1) as max_pos FROM folders WHERE user_id = ? AND deleted_at IS NULL',
                [userId]
            );
            position = (maxPos?.max_pos || 0) + 1;
        }

        const result = run(
            'INSERT INTO folders (user_id, name, position) VALUES (?, ?, ?)',
            [userId, body.name, position]
        );

        const folder = queryOne<Folder>('SELECT * FROM folders WHERE id = ?', [result.lastInsertRowid]);

        return { folder };
    });

    // Update folder
    app.patch('/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
        const folderId = parseInt(request.params.id, 10);
        const body = updateFolderSchema.parse(request.body);

        const existing = queryOne<Folder>(
            'SELECT id FROM folders WHERE id = ? AND user_id = ? AND deleted_at IS NULL',
            [folderId, userId]
        );

        if (!existing) {
            return reply.status(404).send({ error: 'Folder not found' });
        }

        // Check for duplicate name if renaming
        if (body.name) {
            const duplicate = queryOne<Folder>(
                'SELECT id FROM folders WHERE user_id = ? AND name = ? AND id != ? AND deleted_at IS NULL',
                [userId, body.name, folderId]
            );
            if (duplicate) {
                return reply.status(409).send({ error: 'Folder with this name already exists' });
            }
        }

        const updates: string[] = [];
        const params: unknown[] = [];

        if (body.name !== undefined) {
            updates.push('name = ?');
            params.push(body.name);
        }
        if (body.position !== undefined) {
            updates.push('position = ?');
            params.push(body.position);
        }

        if (updates.length > 0) {
            updates.push(`updated_at = datetime('now')`);
            params.push(folderId, userId);
            run(
                `UPDATE folders SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`,
                params
            );
        }

        const folder = queryOne<Folder>('SELECT * FROM folders WHERE id = ?', [folderId]);
        return { folder };
    });

    // Delete folder
    app.delete('/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
        const folderId = parseInt(request.params.id, 10);

        // Soft delete folder (feeds become uncategorized)
        const result = run(
            `UPDATE folders SET deleted_at = datetime('now'), updated_at = datetime('now') WHERE id = ? AND user_id = ? AND deleted_at IS NULL`,
            [folderId, userId]
        );

        if (result.changes === 0) {
            return reply.status(404).send({ error: 'Folder not found' });
        }

        // Uncategorize feeds
        run('UPDATE feeds SET folder_id = NULL WHERE folder_id = ?', [folderId]);

        return { deleted: true };
    });
}
