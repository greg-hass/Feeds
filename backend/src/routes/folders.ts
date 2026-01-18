import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { queryOne, queryAll, run } from '../db/index.js';

const createFolderSchema = z.object({
    name: z.string().min(1).max(100),
    position: z.number().optional(),
});

const updateFolderSchema = z.object({
    name: z.string().min(1).max(100).optional(),
    position: z.number().optional(),
});

interface Folder {
    id: number;
    user_id: number;
    name: string;
    position: number;
    created_at: string;
    updated_at: string;
}

interface SmartFolder {
    type: string;
    name: string;
    unread_count: number;
}

export async function foldersRoutes(app: FastifyInstance) {
    // Single user app - user_id is always 1
    const userId = 1;

    // List folders with smart folders
    app.get('/', async (request: FastifyRequest) => {

        // User folders
        const folders = queryAll<Folder & { feed_count: number; unread_count: number }>(
            `SELECT f.*, 
        (SELECT COUNT(*) FROM feeds WHERE folder_id = f.id AND deleted_at IS NULL) as feed_count,
        (SELECT COUNT(*) FROM articles a 
         JOIN feeds fe ON fe.id = a.feed_id
         LEFT JOIN read_state rs ON rs.article_id = a.id AND rs.user_id = ?
         WHERE fe.folder_id = f.id AND fe.deleted_at IS NULL AND (rs.is_read IS NULL OR rs.is_read = 0)
        ) as unread_count
       FROM folders f
       WHERE f.user_id = ? AND f.deleted_at IS NULL
       ORDER BY f.position, f.name`,
            [userId, userId]
        );

        // Smart folders (by feed type)
        const smartFolders: SmartFolder[] = [];
        const types = ['rss', 'youtube', 'reddit', 'podcast'];
        const displayNames: Record<string, string> = {
            rss: 'RSS',
            youtube: 'YouTube',
            reddit: 'Reddit',
            podcast: 'Podcasts',
        };

        for (const type of types) {
            const result = queryOne<{ unread_count: number }>(
                `SELECT COUNT(*) as unread_count FROM articles a
         JOIN feeds f ON f.id = a.feed_id
         LEFT JOIN read_state rs ON rs.article_id = a.id AND rs.user_id = ?
         WHERE f.user_id = ? AND f.type = ? AND f.deleted_at IS NULL 
         AND (rs.is_read IS NULL OR rs.is_read = 0)`,
                [userId, userId, type]
            );

            smartFolders.push({
                type,
                name: displayNames[type] || type,
                unread_count: result?.unread_count || 0,
            });
        }

        // Also include "All" totals
        const allUnread = queryOne<{ unread_count: number }>(
            `SELECT COUNT(*) as unread_count FROM articles a
       JOIN feeds f ON f.id = a.feed_id
       LEFT JOIN read_state rs ON rs.article_id = a.id AND rs.user_id = ?
       WHERE f.user_id = ? AND f.deleted_at IS NULL 
       AND (rs.is_read IS NULL OR rs.is_read = 0)`,
            [userId, userId]
        );

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
