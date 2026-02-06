import { FastifyInstance, FastifyRequest } from 'fastify';
import bcrypt from 'bcrypt';
import { generateToken } from '../middleware/auth.js';
import { queryOne, run } from '../db/index.js';
import { z } from 'zod';

const SALT_ROUNDS = 12;

// Rate limiting configuration
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
 * Check if rate limit is exceeded (persisted to SQLite)
 */
function checkRateLimit(ip: string): { allowed: boolean; remaining: number; resetIn: number } {
    const now = Date.now();
    const resetAt = new Date(now + WINDOW_MS).toISOString();

    // Get current attempt record
    const attempt = queryOne<{ attempt_count: number; reset_at: string }>(
        'SELECT attempt_count, reset_at FROM rate_limits WHERE ip_address = ?',
        [ip]
    );

    // If no record exists, create one and allow
    if (!attempt) {
        run(
            'INSERT INTO rate_limits (ip_address, attempt_count, reset_at, updated_at) VALUES (?, 1, ?, datetime("now"))',
            [ip, resetAt]
        );
        return { allowed: true, remaining: MAX_ATTEMPTS - 1, resetIn: WINDOW_MS };
    }

    // Validate record structure - skip rate limiting if invalid
    if (typeof attempt.attempt_count !== 'number' || !attempt.reset_at) {
        return { allowed: true, remaining: MAX_ATTEMPTS - 1, resetIn: WINDOW_MS };
    }

    // Check if window expired
    const resetTime = new Date(attempt.reset_at).getTime();
    if (resetTime < now) {
        run(
            'UPDATE rate_limits SET attempt_count = 1, reset_at = ?, updated_at = datetime("now") WHERE ip_address = ?',
            [resetAt, ip]
        );
        return { allowed: true, remaining: MAX_ATTEMPTS - 1, resetIn: WINDOW_MS };
    }

    if (attempt.attempt_count >= MAX_ATTEMPTS) {
        const resetIn = resetTime - now;
        return { allowed: false, remaining: 0, resetIn };
    }

    // Increment attempt count
    run(
        'UPDATE rate_limits SET attempt_count = attempt_count + 1, updated_at = datetime("now") WHERE ip_address = ?',
        [ip]
    );

    const remaining = MAX_ATTEMPTS - attempt.attempt_count - 1;
    const resetIn = resetTime - now;
    return { allowed: true, remaining, resetIn };
}

/**
 * Clear rate limit for an IP (on successful login)
 */
function clearRateLimit(ip: string): void {
    run('DELETE FROM rate_limits WHERE ip_address = ?', [ip]);
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
            // Auto-provision if APP_PASSWORD is configured and matches request
            const envPassword = process.env.APP_PASSWORD;
            
            if (envPassword && password === envPassword) {
                // First successful login with the env password -> set it as the hash
                const hash = await bcrypt.hash(password, SALT_ROUNDS);
                run('UPDATE users SET password_hash = ? WHERE id = 1', [hash]);
                
                // Continue to login logic...
                // We don't need to verify again since we just matched it
                clearRateLimit(clientIP);
                const token = generateToken(user.id, user.username);
                return {
                    token,
                    user: { id: user.id, username: user.username },
                };
            }

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
        clearRateLimit(clientIP);

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
    app.get('/status', async (request) => {
        const jwtSecret = process.env.JWT_SECRET;
        const envPassword = process.env.APP_PASSWORD;
        
        request.log.debug({ jwtSecretPresent: !!jwtSecret }, 'Auth status check');
        request.log.debug({ appPasswordPresent: !!envPassword }, 'Auth status check');
        
        const user = queryOne<{ password_hash: string }>(
            'SELECT password_hash FROM users WHERE id = 1'
        );
        
        request.log.debug({ userFound: !!user }, 'Auth status check');
        request.log.debug({ passwordHashSet: !!user?.password_hash }, 'Auth status check');
        
        const needsSetup = !user || user.password_hash === 'disabled' || !user.password_hash;
        
        request.log.debug({ needsSetup }, 'Auth status check');
        
        return {
            authEnabled: !!jwtSecret,
            needsSetup,
            hasEnvPassword: !!envPassword,
        };
    });
}
