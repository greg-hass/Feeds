import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { onFeedChange, FeedChangeEvent } from '../services/feed-changes.js';

const KEEPALIVE_INTERVAL = 30_000; // 30 seconds

export async function feedChangesStreamRoutes(app: FastifyInstance) {
    // Subscribe to feed changes (SSE for real-time sync)
    app.get('/feed-changes', async (request: FastifyRequest, reply: FastifyReply) => {
        let isCancelled = false;
        request.raw.on('close', () => {
            isCancelled = true;
        });

        await reply.hijack();

        reply.raw.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': process.env.CORS_ORIGIN || '*',
            'X-Accel-Buffering': 'no',
        });

        const sendEvent = (event: FeedChangeEvent) => {
            if (isCancelled) return;
            reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
        };

        const keepaliveTimer = setInterval(() => {
            reply.raw.write(`: keepalive\n\n`);
        }, KEEPALIVE_INTERVAL);

        const unsubscribe = onFeedChange(sendEvent);

        request.raw.on('close', () => {
            clearInterval(keepaliveTimer);
            unsubscribe();
        });
    });
}
