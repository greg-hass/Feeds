import { FastifyInstance, FastifyRequest } from 'fastify';
import bcrypt from 'bcrypt';
import { generateToken } from '../middleware/auth.js';
import { queryOne, run } from '../db/index.js';
import { z } from 'zod';

const SALT_ROUNDS = 12;

// Rate limiting store (in-memory, resets on server restart)
const loginAttempts = new Map<string, { count: number; resetTime: number }>();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

const MAX_PASSWORD_LENGTH = 128;

const loginSchema = z.object({
    password: z.string().min(1, 'Password is required').max(MAX_PASSWORD_LENGTH, `Password must not exceed ${MAX_PASSWORD_LENGTH} characters`),
});

const setupSchema = z.object({
    password: z.string().min(8, 'Password must be at least 8 characters').max(MAX_PASSWORD_LENGTH, `Password must not exceed ${MAX_PASSWORD_LENGTH} characters`),
});

/**
 * Get client IP for rate limiting
 */
function getClientIP(request: FastifyRequest): string {
    // Try X-Forwarded-For first (for reverse proxy setups)
    const forwarded = request.headers['x-forwarded-for'];
    if (forwarded) {
        return String(forwarded).split(',')[0].trim();
    }
    // Fall back to direct connection IP
    return request.ip || 'unknown';
}

/**
 * Check if rate limit is exceeded
 */
function checkRateLimit(ip: string): { allowed: boolean; remaining: number; resetIn: number } {
    const now = Date.now();
    const attempt = loginAttempts.get(ip);

    if (!attempt || now > attempt.resetTime) {
        // Reset or create new window
        loginAttempts.set(ip, { count: 1, resetTime: now + WINDOW_MS });
        return { allowed: true, remaining: MAX_ATTEMPTS - 1, resetIn: WINDOW_MS };
    }

    if (attempt.count >= MAX_ATTEMPTS) {
        const resetIn = attempt.resetTime - now;
        return { allowed: false, remaining: 0, resetIn };
    }

    attempt.count++;
    return { allowed: true, remaining: MAX_ATTEMPTS - attempt.count, resetIn: attempt.resetTime - now };
}

/**
 * Auth routes for login and setup
 */
export async function authRoutes(app: FastifyInstance) {
    /**
     * POST /api/v1/auth/login
     * Authenticate with password and receive JWT token
     */
    app.post('/login', async (request: FastifyRequest, reply) => {
        const clientIP = getClientIP(request);
        const rateLimit = checkRateLimit(clientIP);

        if (!rateLimit.allowed) {
            const minutes = Math.ceil(rateLimit.resetIn / 60000);
            return reply.status(429).send({
                error: `Too many login attempts. Please try again in ${minutes} minute${minutes > 1 ? 's' : ''}.`,
                retryAfter: Math.ceil(rateLimit.resetIn / 1000),
            });
        }

        const { password } = loginSchema.parse(request.body);

        // Get the default user (id=1)
        const user = queryOne<{ id: number; username: string; password_hash: string }>(
            'SELECT id, username, password_hash FROM users WHERE id = 1'
        );

        if (!user) {
            return reply.status(401).send({ error: 'User not found' });
        }

        // Check if password is set up
        if (user.password_hash === 'disabled' || !user.password_hash) {
            return reply.status(401).send({
                error: 'Authentication not configured. Please run setup first.',
                needsSetup: true
            });
        }

        // Verify password
        const isValid = await bcrypt.compare(password, user.password_hash);
        if (!isValid) {
            return reply.status(401).send({
                error: 'Invalid password',
                remainingAttempts: rateLimit.remaining,
            });
        }

        // Clear rate limit on successful login
        loginAttempts.delete(clientIP);

        // Generate JWT token
        const token = generateToken(user.id, user.username);

        return {
            token,
            user: {
                id: user.id,
                username: user.username,
            },
        };
    });

    /**
     * POST /api/v1/auth/setup
     * Initial password setup (only works if no password is set)
     */
    app.post('/setup', async (request: FastifyRequest, reply) => {
        // Check if APP_PASSWORD is configured in env
        const envPassword = process.env.APP_PASSWORD;
        if (!envPassword) {
            return reply.status(400).send({ 
                error: 'APP_PASSWORD not configured in environment' 
            });
        }
        
        const { password } = setupSchema.parse(request.body);
        
        // Get current user
        const user = queryOne<{ id: number; password_hash: string }>(
            'SELECT id, password_hash FROM users WHERE id = 1'
        );
        
        if (!user) {
            // Create default user if doesn't exist
            const hash = await bcrypt.hash(password, SALT_ROUNDS);
            run(
                'INSERT INTO users (id, username, password_hash, is_admin) VALUES (1, ?, ?, 1)',
                ['admin', hash]
            );
        } else if (user.password_hash !== 'disabled' && user.password_hash) {
            // Password already set - verify against env password for security
            const isValid = await bcrypt.compare(envPassword, user.password_hash);
            if (!isValid) {
                return reply.status(403).send({ 
                    error: 'Password already configured. Use login instead.' 
                });
            }
            
            // Update password
            const hash = await bcrypt.hash(password, SALT_ROUNDS);
            run('UPDATE users SET password_hash = ? WHERE id = 1', [hash]);
        } else {
            // First time setup
            const hash = await bcrypt.hash(password, SALT_ROUNDS);
            run('UPDATE users SET password_hash = ? WHERE id = 1', [hash]);
        }
        
        // Generate token
        const token = generateToken(1, 'admin');
        
        return {
            message: 'Password configured successfully',
            token,
            user: {
                id: 1,
                username: 'admin',
            },
        };
    });
    
    /**
     * GET /api/v1/auth/status
     * Check if authentication is required and configured
     */
    app.get('/status', async () => {
        const jwtSecret = process.env.JWT_SECRET;
        const envPassword = process.env.APP_PASSWORD;
        
        const user = queryOne<{ password_hash: string }>(
            'SELECT password_hash FROM users WHERE id = 1'
        );
        
        const needsSetup = !user || user.password_hash === 'disabled' || !user.password_hash;
        
        return {
            authEnabled: !!jwtSecret,
            needsSetup,
            hasEnvPassword: !!envPassword,
        };
    });
}
