import { FastifyRequest, FastifyReply } from 'fastify';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;

/**
 * Authentication Middleware
 * 
 * Enforces API access control using JWT tokens.
 * 
 * Usage in app.ts:
 * import { authMiddleware } from './middleware/auth';
 * app.addHook('onRequest', authMiddleware);
 */
export async function authMiddleware(request: FastifyRequest, reply: FastifyReply) {
    // If no JWT_SECRET is set, skip auth (backward compatibility for development)
    if (!JWT_SECRET) {
        console.warn('Warning: JWT_SECRET not set, running without authentication');
        return;
    }

    // Skip auth for public endpoints
    const publicPaths = [
        '/health',
        '/api/v1/auth/login',
        '/api/v1/auth/setup',
    ];
    
    if (publicPaths.some(path => request.url.startsWith(path))) {
        return;
    }

    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return reply.status(401).send({ error: 'Unauthorized: No token provided' });
    }

    const token = authHeader.replace('Bearer ', '');
    
    try {
        const decoded = jwt.verify(token, JWT_SECRET) as { userId: number; username: string };
        // Attach user info to request for use in routes
        (request as any).user = decoded;
    } catch (error) {
        return reply.status(401).send({ error: 'Unauthorized: Invalid token' });
    }
}

/**
 * Generate a JWT token for a user
 */
export function generateToken(userId: number, username: string): string {
    if (!JWT_SECRET) {
        throw new Error('JWT_SECRET not configured');
    }
    
    return jwt.sign(
        { userId, username },
        JWT_SECRET,
        { expiresIn: '30d' } // Token valid for 30 days
    );
}
