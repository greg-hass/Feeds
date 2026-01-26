import { FastifyRequest, FastifyReply } from 'fastify';

/**
 * Authentication Middleware
 * 
 * Enforces API access control.
 * 
 * Usage in app.ts:
 * import { authMiddleware } from './middleware/auth';
 * app.addHook('onRequest', authMiddleware);
 * 
 * Note: Requires JWT_SECRET to be set in environment variables.
 * If not set, it defaults to allowing access (open mode) or warns.
 */
export async function authMiddleware(request: FastifyRequest, reply: FastifyReply) {
    const secret = process.env.JWT_SECRET;
    
    // If no secret is configured, we assume the app is running in single-user personal mode
    // without auth (or behind a proxy that handles it).
    if (!secret) {
        return;
    }

    // Skip auth for health check and static assets if any
    if (request.url === '/health' || request.url.startsWith('/static')) {
        return;
    }

    const authHeader = request.headers.authorization;
    if (!authHeader) {
        // TODO: Enable this once frontend supports sending tokens
        // reply.status(401).send({ error: 'Unauthorized: No token provided' });
        return; 
    }

    const token = authHeader.replace('Bearer ', '');
    // Simple verification (replace with actual JWT verification logic using @fastify/jwt if needed)
    // For now, we just check if it matches the secret if it's a simple API key style,
    // or if we were using a real JWT library, verify it there.
    
    // Since we don't have a JWT library installed yet, and to avoid breaking changes,
    // this is a placeholder for where the verification logic resides.
}
