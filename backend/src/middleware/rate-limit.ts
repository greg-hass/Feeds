import { FastifyRequest, FastifyReply } from 'fastify';
import { RATE_LIMIT } from '../config/constants.js';

interface RateLimitEntry {
    count: number;
    resetTime: number;
}

// In-memory rate limit store (for single-instance deployments)
const rateLimitStore = new Map<string, RateLimitEntry>();

/**
 * Simple in-memory rate limiter.
 * For production with multiple instances, use Redis-backed rate limiting.
 */
export function createRateLimiter(options: {
    windowMs: number;
    maxRequests: number;
    keyGenerator?: (request: FastifyRequest) => string;
}) {
    const { windowMs, maxRequests, keyGenerator } = options;

    return async function rateLimiter(request: FastifyRequest, reply: FastifyReply): Promise<boolean> {
        const key = keyGenerator ? keyGenerator(request) : `${request.ip}:${request.routerPath}`;

        const now = Date.now();
        const entry = rateLimitStore.get(key);

        if (!entry || now > entry.resetTime) {
            // First request or window expired
            rateLimitStore.set(key, {
                count: 1,
                resetTime: now + windowMs,
            });
            return true; // Allow request
        }

        if (entry.count >= maxRequests) {
            const resetIn = Math.ceil((entry.resetTime - now) / 1000);
            reply.header('X-RateLimit-Limit', String(maxRequests));
            reply.header('X-RateLimit-Remaining', '0');
            reply.header('X-RateLimit-Reset', String(entry.resetTime));
            reply.header('Retry-After', String(resetIn));
            return false; // Deny request
        }

        // Increment counter
        entry.count++;
        reply.header('X-RateLimit-Limit', String(maxRequests));
        reply.header('X-RateLimit-Remaining', String(maxRequests - entry.count));
        reply.header('X-RateLimit-Reset', String(entry.resetTime));
        return true; // Allow request
    };
}

/**
 * Pre-configured rate limiters for different endpoint types
 */
export const rateLimiters = {
    // For expensive operations like search
    search: createRateLimiter({
        windowMs: RATE_LIMIT.WINDOW_MS,
        maxRequests: RATE_LIMIT.SEARCH_MAX_REQUESTS,
        keyGenerator: (req) => `${req.ip}:search`,
    }),

    // For feed operations
    feeds: createRateLimiter({
        windowMs: RATE_LIMIT.WINDOW_MS,
        maxRequests: RATE_LIMIT.FEEDS_MAX_REQUESTS,
        keyGenerator: (req) => `${req.ip}:feeds`,
    }),

    // For article operations
    articles: createRateLimiter({
        windowMs: RATE_LIMIT.WINDOW_MS,
        maxRequests: RATE_LIMIT.ARTICLES_MAX_REQUESTS,
        keyGenerator: (req) => `${req.ip}:articles`,
    }),
};
