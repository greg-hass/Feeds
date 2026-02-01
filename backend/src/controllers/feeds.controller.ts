import { FastifyRequest, FastifyReply } from 'fastify';
import { FeedsService, AddFeedInput, UpdateFeedInput, BulkFeedInput } from '../services/feeds.service.js';
import { AppError } from '../utils/errors.js';

function handleControllerError(err: unknown, reply: FastifyReply, context: string): FastifyReply {
    if (err instanceof AppError) {
        return reply.status(err.statusCode).send({ 
            error: err.message, 
            code: err.code 
        });
    }
    console.error(`[FeedsController.${context}] Error:`, err);
    return reply.status(500).send({ 
        error: 'Internal server error',
        code: 'INTERNAL_ERROR'
    });
}

export class FeedsController {
    static async list(request: FastifyRequest, reply: FastifyReply) {
        try {
            const userId = 1; // Single user app
            const feeds = await FeedsService.list(userId);
            return { feeds };
        } catch (err) {
            return handleControllerError(err, reply, 'list');
        }
    }

    static async getOne(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
        try {
            const userId = 1;
            const feedId = parseInt(request.params.id, 10);
            const feed = await FeedsService.getOne(userId, feedId);
            return { feed };
        } catch (err) {
            return handleControllerError(err, reply, 'getOne');
        }
    }

    static async add(request: FastifyRequest<{ Body: AddFeedInput }>, reply: FastifyReply) {
        try {
            const userId = 1;
            const result = await FeedsService.add(userId, request.body);
            
            if (result.restored) {
                return reply.status(200).send({ feed: result.feed, restored: true });
            }
            
            return result;
        } catch (err) {
            return handleControllerError(err, reply, 'add');
        }
    }

    static async update(request: FastifyRequest<{ Params: { id: string }, Body: UpdateFeedInput }>, reply: FastifyReply) {
        try {
            const userId = 1;
            const feedId = parseInt(request.params.id, 10);
            const result = await FeedsService.update(userId, feedId, request.body);
            return result;
        } catch (err) {
            return handleControllerError(err, reply, 'update');
        }
    }

    static async delete(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
        try {
            const userId = 1;
            const feedId = parseInt(request.params.id, 10);
            const result = await FeedsService.delete(userId, feedId);
            return result;
        } catch (err) {
            return handleControllerError(err, reply, 'delete');
        }
    }

    static async bulk(request: FastifyRequest<{ Body: BulkFeedInput }>, reply: FastifyReply) {
        try {
            const userId = 1;
            const result = await FeedsService.bulk(userId, request.body);
            return result;
        } catch (err) {
            return handleControllerError(err, reply, 'bulk');
        }
    }

    static async refresh(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
        try {
            const userId = 1;
            const feedId = parseInt(request.params.id, 10);
            const result = await FeedsService.refresh(userId, feedId);
            return result;
        } catch (err) {
            return handleControllerError(err, reply, 'refresh');
        }
    }

    static async pause(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
        try {
            const userId = 1;
            const feedId = parseInt(request.params.id, 10);
            const result = await FeedsService.pause(userId, feedId);
            return result;
        } catch (err) {
            return handleControllerError(err, reply, 'pause');
        }
    }

    static async resume(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
        try {
            const userId = 1;
            const feedId = parseInt(request.params.id, 10);
            const result = await FeedsService.resume(userId, feedId);
            return result;
        } catch (err) {
            return handleControllerError(err, reply, 'resume');
        }
    }

    static async getInfo(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
        try {
            const userId = 1;
            const feedId = parseInt(request.params.id, 10);
            const result = await FeedsService.getInfo(userId, feedId);
            return result;
        } catch (err) {
            return handleControllerError(err, reply, 'getInfo');
        }
    }

    static async getYouTubeChannelUrl(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
        try {
            const userId = 1;
            const feedId = parseInt(request.params.id, 10);
            const result = await FeedsService.getYouTubeChannelUrl(userId, feedId);
            return result;
        } catch (err) {
            return handleControllerError(err, reply, 'getYouTubeChannelUrl');
        }
    }

    static async refreshIcon(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
        try {
            const userId = 1;
            const feedId = parseInt(request.params.id, 10);
            const result = await FeedsService.refreshIcon(userId, feedId);
            return result;
        } catch (err) {
            return handleControllerError(err, reply, 'refreshIcon');
        }
    }

    static async refetchYouTubeIcons(request: FastifyRequest<{ Querystring: { all?: string } }>, reply: FastifyReply) {
        try {
            const userId = 1;
            const targetAll = request.query.all === 'true';
            const result = await FeedsService.refetchYouTubeIcons(userId, targetAll);
            return result;
        } catch (err) {
            return handleControllerError(err, reply, 'refetchYouTubeIcons');
        }
    }

    static async clearIconCache(request: FastifyRequest, reply: FastifyReply) {
        try {
            const userId = 1;
            const result = await FeedsService.clearIconCache(userId);
            return result;
        } catch (err) {
            return handleControllerError(err, reply, 'clearIconCache');
        }
    }
}