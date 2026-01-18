import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import multipart from '@fastify/multipart';
import { queryAll, run, queryOne } from '../db/index.js';
import { parseOPML, generateOPML, OPMLFeed, OPMLFolder } from '../services/opml-parser.js';

interface Feed {
    id: number;
    folder_id: number | null;
    type: string;
    title: string;
    url: string;
    site_url: string | null;
}

interface Folder {
    id: number;
    name: string;
}

export async function opmlRoutes(app: FastifyInstance) {
    // Single user app - user_id is always 1
    const userId = 1;

    await app.register(multipart, {
        limits: {
            fileSize: 10 * 1024 * 1024, // 10MB
        },
    });

    // Import OPML
    app.post('/import', async (request: FastifyRequest, reply: FastifyReply) => {

        const file = await request.file();
        if (!file) {
            return reply.status(400).send({ error: 'No file uploaded' });
        }

        const buffer = await file.toBuffer();
        const opmlContent = buffer.toString('utf-8');

        let parsed: { folders: OPMLFolder[]; feeds: OPMLFeed[] };
        try {
            parsed = parseOPML(opmlContent);
        } catch (err) {
            return reply.status(400).send({
                error: 'Invalid OPML format',
                details: err instanceof Error ? err.message : 'Parse error',
            });
        }

        const stats = {
            imported: { folders: 0, feeds: 0 },
            skipped: { duplicates: 0, invalid: 0 },
            errors: [] as { url: string; error: string }[],
        };

        // Create folders
        const folderMap = new Map<string, number>();

        for (const folder of parsed.folders) {
            const existing = queryOne<Folder>(
                'SELECT id FROM folders WHERE user_id = ? AND name = ? AND deleted_at IS NULL',
                [userId, folder.name]
            );

            if (existing) {
                folderMap.set(folder.name, existing.id);
            } else {
                const result = run(
                    'INSERT INTO folders (user_id, name) VALUES (?, ?)',
                    [userId, folder.name]
                );
                folderMap.set(folder.name, Number(result.lastInsertRowid));
                stats.imported.folders++;
            }
        }

        // Import feeds
        for (const feed of parsed.feeds) {
            if (!feed.xmlUrl) {
                stats.skipped.invalid++;
                continue;
            }

            // Check for duplicate
            const existing = queryOne<Feed>(
                'SELECT id FROM feeds WHERE user_id = ? AND url = ? AND deleted_at IS NULL',
                [userId, feed.xmlUrl]
            );

            if (existing) {
                stats.skipped.duplicates++;
                continue;
            }

            try {
                const folderId = feed.folder ? folderMap.get(feed.folder) || null : null;

                run(
                    `INSERT INTO feeds (user_id, folder_id, type, title, url, site_url)
           VALUES (?, ?, ?, ?, ?, ?)`,
                    [userId, folderId, 'rss', feed.title || feed.xmlUrl, feed.xmlUrl, feed.htmlUrl || null]
                );
                stats.imported.feeds++;
            } catch (err) {
                stats.errors.push({
                    url: feed.xmlUrl,
                    error: err instanceof Error ? err.message : 'Unknown error',
                });
            }
        }

        return stats;
    });

    // Export OPML
    app.get('/export', async (request: FastifyRequest, reply: FastifyReply) => {

        // Get folders
        const folders = queryAll<Folder>(
            'SELECT id, name FROM folders WHERE user_id = ? AND deleted_at IS NULL ORDER BY position, name',
            [userId]
        );

        // Get feeds
        const feeds = queryAll<Feed>(
            'SELECT id, folder_id, type, title, url, site_url FROM feeds WHERE user_id = ? AND deleted_at IS NULL ORDER BY title',
            [userId]
        );

        // Group feeds by folder
        const folderMap = new Map<number, Folder>();
        for (const folder of folders) {
            folderMap.set(folder.id, folder);
        }

        const opmlFolders: OPMLFolder[] = folders.map(f => ({ name: f.name }));
        const opmlFeeds: OPMLFeed[] = feeds.map(f => ({
            title: f.title,
            xmlUrl: f.url,
            htmlUrl: f.site_url || undefined,
            folder: f.folder_id ? folderMap.get(f.folder_id)?.name : undefined,
        }));

        const opml = generateOPML(opmlFolders, opmlFeeds, 'Feeds Export');

        reply.header('Content-Type', 'text/xml');
        reply.header('Content-Disposition', 'attachment; filename="feeds-export.opml"');
        return opml;
    });
}
