import { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import {
    getHighlights,
    createHighlight,
    updateHighlight,
    deleteHighlight,
    getReadingProgress,
    updateReadingProgress,
    deleteReadingProgress,
    generateTableOfContents,
    injectHeadingIds,
    Highlight,
} from '../services/highlights.js';

const createHighlightSchema = z.object({
    article_id: z.number(),
    text: z.string().min(1).max(5000),
    start_offset: z.number().min(0),
    end_offset: z.number().min(0),
    color: z.enum(['yellow', 'green', 'blue', 'pink', 'purple']).default('yellow'),
    note: z.string().max(1000).optional(),
});

const updateHighlightSchema = z.object({
    color: z.enum(['yellow', 'green', 'blue', 'pink', 'purple']).optional(),
    note: z.string().max(1000).optional(),
});

const updateProgressSchema = z.object({
    article_id: z.number(),
    scroll_position: z.number().min(0),
    scroll_percentage: z.number().min(0).max(100),
});

export async function highlightsRoutes(app: FastifyInstance): Promise<void> {
    const userId = 1;

    app.get('/article/:articleId', async (request: FastifyRequest<{ Params: { articleId: string } }>) => {
        const articleId = parseInt(request.params.articleId);
        if (isNaN(articleId)) {
            return { error: 'Invalid article ID' };
        }

        const highlights = getHighlights(userId, articleId);
        return { highlights };
    });

    app.post('/', async (request: FastifyRequest) => {
        const body = createHighlightSchema.parse(request.body);
        const highlightId = createHighlight(
            userId,
            body.article_id,
            body.text,
            body.start_offset,
            body.end_offset,
            body.color,
            body.note
        );

        return { id: highlightId };
    });

    app.patch('/:id', async (request: FastifyRequest<{ Params: { id: string } }>) => {
        const highlightId = parseInt(request.params.id);
        if (isNaN(highlightId)) {
            return { error: 'Invalid highlight ID' };
        }

        const body = updateHighlightSchema.parse(request.body);
        updateHighlight(highlightId, userId, body);

        return { success: true };
    });

    app.delete('/:id', async (request: FastifyRequest<{ Params: { id: string } }>) => {
        const highlightId = parseInt(request.params.id);
        if (isNaN(highlightId)) {
            return { error: 'Invalid highlight ID' };
        }

        deleteHighlight(highlightId, userId);
        return { success: true };
    });

    app.get('/progress/:articleId', async (request: FastifyRequest<{ Params: { articleId: string } }>) => {
        const articleId = parseInt(request.params.articleId);
        if (isNaN(articleId)) {
            return { error: 'Invalid article ID' };
        }

        const progress = getReadingProgress(userId, articleId);
        return { progress };
    });

    app.post('/progress', async (request: FastifyRequest) => {
        const body = updateProgressSchema.parse(request.body);
        updateReadingProgress(userId, body.article_id, body.scroll_position, body.scroll_percentage);

        return { success: true };
    });

    app.delete('/progress/:articleId', async (request: FastifyRequest<{ Params: { articleId: string } }>) => {
        const articleId = parseInt(request.params.articleId);
        if (isNaN(articleId)) {
            return { error: 'Invalid article ID' };
        }

        deleteReadingProgress(userId, articleId);
        return { success: true };
    });

    app.post('/toc/generate', async (request: FastifyRequest<{ Body: { content: string } }>) => {
        const { content } = request.body as { content: string };
        if (!content) {
            return { error: 'Content is required' };
        }

        const toc = generateTableOfContents(content);
        const modifiedContent = injectHeadingIds(content, toc);

        return { toc, modifiedContent };
    });
}
