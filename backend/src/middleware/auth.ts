import { FastifyRequest, FastifyReply } from 'fastify';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;

/**
 * In-memory store for sliding expiration tracking
 * Maps token signature to last activity timestamp
 * Limited to MAX_ENTRIES to prevent unbounded growth
 */
const tokenActivity = new Map<string, number>();
const INACTIVITY_TIMEOUT = 30 * 24 * 60 * 60 * 1000; // 30 days in ms
const MAX_ENTRIES = 10000; // Maximum number of tokens to track

/**
 * Get token signature (unique identifier for the token)
 */
function getTokenSignature(token: string): string {
    // Use last 16 chars of token as signature (unique enough for this use case)
    return token.slice(-16);
}

/**
 * Clean up old token activity entries (run periodically)
 * Also enforces MAX_ENTRIES limit by removing oldest entries
 */
function cleanupOldActivity(): void {
    const now = Date.now();
    const cutoff = now - INACTIVITY_TIMEOUT;

    // First, remove expired entries
    for (const [signature, lastActivity] of tokenActivity.entries()) {
        if (lastActivity < cutoff) {
            tokenActivity.delete(signature);
        }
    }

    // If still over limit, remove oldest entries
    if (tokenActivity.size > MAX_ENTRIES) {
        const entries = Array.from(tokenActivity.entries());
        // Sort by last activity (oldest first)
        entries.sort((a, b) => a[1] - b[1]);
        // Remove oldest entries to get back under limit
        const toRemove = entries.slice(0, tokenActivity.size - MAX_ENTRIES);
        for (const [signature] of toRemove) {
            tokenActivity.delete(signature);
        }
    }
}

// Run cleanup every hour
setInterval(cleanupOldActivity, 60 * 60 * 1000);

/**
 * Authentication Middleware
 * 
 * Enforces API access control using JWT tokens with sliding expiration.
 * Token expires after 30 days of inactivity.
 * 
 * Usage in app.ts:
 * import { authMiddleware } from './middleware/auth';
 * app.addHook('onRequest', authMiddleware);
 */
export async function authMiddleware(request: FastifyRequest, reply: FastifyReply) {
    // If no JWT_SECRET is set, fail closed in production
    if (!JWT_SECRET) {
        if (process.env.NODE_ENV === 'production') {
            console.error('FATAL: JWT_SECRET not set in production. Authentication disabled.');
            return reply.status(500).send({ error: 'Server configuration error' });
        }
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
    const tokenSignature = getTokenSignature(token);
    
    try {
        // First verify the JWT signature and basic validity
        const decoded = jwt.verify(token, JWT_SECRET) as { userId: number; username: string };
        
        // Check sliding expiration (inactivity-based)
        const now = Date.now();
        const lastActivity = tokenActivity.get(tokenSignature);
        
        if (lastActivity) {
            const inactiveFor = now - lastActivity;
            if (inactiveFor > INACTIVITY_TIMEOUT) {
                // Token expired due to inactivity
                tokenActivity.delete(tokenSignature);
                return reply.status(401).send({ 
                    error: 'Unauthorized: Session expired due to inactivity',
                    code: 'SESSION_EXPIRED'
                });
            }
        }
        
        // Update last activity time (sliding expiration)
        tokenActivity.set(tokenSignature, now);
        
        // Attach user info to request for use in routes
        (request as any).user = decoded;
    } catch (error) {
        if (error instanceof jwt.TokenExpiredError) {
            return reply.status(401).send({ 
                error: 'Unauthorized: Token expired',
                code: 'TOKEN_EXPIRED'
            });
        }
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
    
    // Generate token with long expiry (1 year) - actual expiration handled by sliding window
    return jwt.sign(
        { userId, username },
        JWT_SECRET,
        { expiresIn: '365d' } // JWT itself valid for 1 year
    );
}
