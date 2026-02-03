import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import Fastify from 'fastify';
import bcrypt from 'bcrypt';

// Mock the database module
vi.mock('../../src/db/index.js', () => ({
    queryOne: vi.fn(),
    queryAll: vi.fn(),
    run: vi.fn(),
}));

// Mock the auth middleware
vi.mock('../../src/middleware/auth.js', () => ({
    generateToken: vi.fn(() => 'mock-jwt-token'),
    authMiddleware: vi.fn(),
}));

import { queryOne, run } from '../../src/db/index.js';
import { generateToken } from '../../src/middleware/auth.js';

const TEST_JWT_SECRET = 'test-secret-key-that-is-at-least-32-characters-long-for-testing';

describe('Auth Routes', () => {
    let app: FastifyInstance;

    beforeEach(async () => {
        process.env.JWT_SECRET = TEST_JWT_SECRET;
        process.env.APP_PASSWORD = 'env-setup-password';
        
        vi.resetModules();
        vi.clearAllMocks();
        
        // Import and register routes
        const { authRoutes } = await import('../../src/routes/auth.js');
        app = Fastify();
        await app.register(authRoutes, { prefix: '/api/v1/auth' });
    });

    afterEach(() => {
        delete process.env.JWT_SECRET;
        delete process.env.APP_PASSWORD;
        app.close();
    });

    describe('POST /api/v1/auth/login', () => {
        it('should return 401 when user not found', async () => {
            (queryOne as any).mockReturnValue(null);

            const response = await app.inject({
                method: 'POST',
                url: '/api/v1/auth/login',
                payload: { password: 'testpassword' },
            });

            expect(response.statusCode).toBe(401);
            expect(JSON.parse(response.payload)).toEqual({ error: 'User not found' });
        });

        it('should login successfully with valid password', async () => {
            const hashedPassword = await bcrypt.hash('correctpassword', 12);
            (queryOne as any).mockReturnValue({
                id: 1,
                username: 'admin',
                password_hash: hashedPassword,
            });

            const response = await app.inject({
                method: 'POST',
                url: '/api/v1/auth/login',
                payload: { password: 'correctpassword' },
            });

            expect(response.statusCode).toBe(200);
            const body = JSON.parse(response.payload);
            expect(body.token).toBe('mock-jwt-token');
            expect(body.user).toEqual({ id: 1, username: 'admin' });
            expect(generateToken).toHaveBeenCalledWith(1, 'admin');
        });

        it('should return 401 for invalid password', async () => {
            const hashedPassword = await bcrypt.hash('correctpassword', 12);
            (queryOne as any).mockReturnValue({
                id: 1,
                username: 'admin',
                password_hash: hashedPassword,
            });

            const response = await app.inject({
                method: 'POST',
                url: '/api/v1/auth/login',
                payload: { password: 'wrongpassword' },
            });

            expect(response.statusCode).toBe(401);
            const body = JSON.parse(response.payload);
            expect(body.error).toBe('Invalid password');
            expect(body.remainingAttempts).toBeDefined();
        });

        it('should auto-provision with env password when no password set', async () => {
            (queryOne as any).mockReturnValue({
                id: 1,
                username: 'admin',
                password_hash: 'disabled',
            });
            (run as any).mockReturnValue({ changes: 1 });

            const response = await app.inject({
                method: 'POST',
                url: '/api/v1/auth/login',
                payload: { password: 'env-setup-password' },
            });

            expect(response.statusCode).toBe(200);
            expect(run).toHaveBeenCalled();
        });

        it('should validate password length', async () => {
            const longPassword = 'a'.repeat(200);

            const response = await app.inject({
                method: 'POST',
                url: '/api/v1/auth/login',
                payload: { password: longPassword },
            });

            // Zod validation should catch this - checking it doesn't crash
            expect(response.statusCode).toBeGreaterThanOrEqual(400);
        });

        it('should reject empty password', async () => {
            const response = await app.inject({
                method: 'POST',
                url: '/api/v1/auth/login',
                payload: { password: '' },
            });

            // Zod validation should catch this - checking it doesn't crash
            expect(response.statusCode).toBeGreaterThanOrEqual(400);
        });
    });

    describe('POST /api/v1/auth/setup', () => {
        it('should return 400 when APP_PASSWORD not configured', async () => {
            delete process.env.APP_PASSWORD;

            const response = await app.inject({
                method: 'POST',
                url: '/api/v1/auth/setup',
                payload: { password: 'newpassword123' },
            });

            expect(response.statusCode).toBe(400);
            expect(JSON.parse(response.payload)).toEqual({
                error: 'APP_PASSWORD not configured in environment',
            });
        });

        it('should setup password for new user', async () => {
            (queryOne as any).mockReturnValue(null);
            (run as any).mockReturnValue({ changes: 1 });

            const response = await app.inject({
                method: 'POST',
                url: '/api/v1/auth/setup',
                payload: { password: 'newpassword123' },
            });

            expect(response.statusCode).toBe(200);
            const body = JSON.parse(response.payload);
            expect(body.message).toBe('Password configured successfully');
            expect(body.token).toBe('mock-jwt-token');
        });

        it('should handle already configured password', async () => {
            const hashedPassword = await bcrypt.hash('env-setup-password', 12);
            (queryOne as any).mockReturnValue({
                id: 1,
                password_hash: hashedPassword,
            });

            const response = await app.inject({
                method: 'POST',
                url: '/api/v1/auth/setup',
                payload: { password: 'newpassword123' },
            });

            // The route checks if password_hash !== 'disabled' && password_hash exists
            // If it does, it verifies against env password
            // Since we're using the env password, it should allow update
            expect(response.statusCode).toBe(200);
        });

        it('should validate password minimum length', async () => {
            const response = await app.inject({
                method: 'POST',
                url: '/api/v1/auth/setup',
                payload: { password: 'short' },
            });

            // Zod validation should catch this - checking it doesn't crash
            expect(response.statusCode).toBeGreaterThanOrEqual(400);
        });
    });

    describe('GET /api/v1/auth/status', () => {
        it('should return auth status when user needs setup', async () => {
            (queryOne as any).mockReturnValue({
                password_hash: 'disabled',
            });

            const response = await app.inject({
                method: 'GET',
                url: '/api/v1/auth/status',
            });

            expect(response.statusCode).toBe(200);
            const body = JSON.parse(response.payload);
            expect(body.authEnabled).toBe(true);
            expect(body.needsSetup).toBe(true);
            expect(body.hasEnvPassword).toBe(true);
        });

        it('should return auth status when user is configured', async () => {
            (queryOne as any).mockReturnValue({
                password_hash: 'some-hash-value',
            });

            const response = await app.inject({
                method: 'GET',
                url: '/api/v1/auth/status',
            });

            expect(response.statusCode).toBe(200);
            const body = JSON.parse(response.payload);
            expect(body.authEnabled).toBe(true);
            expect(body.needsSetup).toBe(false);
            expect(body.hasEnvPassword).toBe(true);
        });

        it('should return auth status when user not found', async () => {
            (queryOne as any).mockReturnValue(null);

            const response = await app.inject({
                method: 'GET',
                url: '/api/v1/auth/status',
            });

            expect(response.statusCode).toBe(200);
            const body = JSON.parse(response.payload);
            expect(body.needsSetup).toBe(true);
        });
    });

    describe('Rate Limiting', () => {
        beforeEach(async () => {
            // Clear rate limits table before each rate limit test
            (run as any).mockClear();
        });

        it('should rate limit after 5 failed attempts', async () => {
            const hashedPassword = await bcrypt.hash('correctpassword', 12);
            (queryOne as any).mockReturnValue({
                id: 1,
                username: 'admin',
                password_hash: hashedPassword,
            });

            // Track query calls to handle rate limit queries
            let rateLimitQueryCount = 0;
            (queryOne as any).mockImplementation((sql: string, params: any[]) => {
                if (sql.includes('rate_limits')) {
                    rateLimitQueryCount++;
                    if (rateLimitQueryCount === 1) {
                        // First query - no existing record
                        return null;
                    } else {
                        // Subsequent queries - return incrementing count
                        const count = Math.min(rateLimitQueryCount - 1, 5);
                        const now = Date.now();
                        return {
                            attempt_count: count,
                            reset_at: new Date(now + 15 * 60 * 1000).toISOString(),
                        };
                    }
                }
                return { id: 1, username: 'admin', password_hash: hashedPassword };
            });

            // Make 5 failed login attempts
            for (let i = 0; i < 5; i++) {
                const response = await app.inject({
                    method: 'POST',
                    url: '/api/v1/auth/login',
                    payload: { password: 'wrongpassword' },
                });
                // First 5 attempts should return 401, not rate limited
                expect(response.statusCode).toBe(401);
            }

            // 6th attempt should be rate limited
            const response = await app.inject({
                method: 'POST',
                url: '/api/v1/auth/login',
                payload: { password: 'wrongpassword' },
            });

            expect(response.statusCode).toBe(429);
            const body = JSON.parse(response.payload);
            expect(body.error).toContain('Too many login attempts');
            expect(body.retryAfter).toBeDefined();
        });

        it('should reset rate limit after successful login', async () => {
            const hashedPassword = await bcrypt.hash('correctpassword', 12);
            (queryOne as any).mockReturnValue({
                id: 1,
                username: 'admin',
                password_hash: hashedPassword,
            });

            let rateLimitQueryCount = 0;
            let rateLimitRecord: { attempt_count: number; reset_at: string } | null = null;

            (queryOne as any).mockImplementation((sql: string, params: any[]) => {
                if (sql.includes('rate_limits')) {
                    rateLimitQueryCount++;
                    return rateLimitRecord;
                }
                return { id: 1, username: 'admin', password_hash: hashedPassword };
            });

            // Make 3 failed attempts
            for (let i = 0; i < 3; i++) {
                rateLimitRecord = {
                    attempt_count: i + 1,
                    reset_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
                };
                const response = await app.inject({
                    method: 'POST',
                    url: '/api/v1/auth/login',
                    payload: { password: 'wrongpassword' },
                });
                expect(response.statusCode).toBe(401);
            }

            // Successful login - clears rate limit
            rateLimitRecord = null;

            await app.inject({
                method: 'POST',
                url: '/api/v1/auth/login',
                payload: { password: 'correctpassword' },
            });

            // Should be able to fail again without immediate rate limit
            const response = await app.inject({
                method: 'POST',
                url: '/api/v1/auth/login',
                payload: { password: 'wrongpassword' },
            });

            // Should not be rate limited yet (counter reset after success)
            expect(response.statusCode).toBe(401);
            expect(JSON.parse(response.payload).error).toBe('Invalid password');
        });
    });
});
