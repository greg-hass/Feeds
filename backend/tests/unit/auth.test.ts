import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import jwt from 'jsonwebtoken';
import type { FastifyRequest, FastifyReply } from 'fastify';

const TEST_JWT_SECRET = 'test-secret-key-that-is-at-least-32-characters-long-for-testing';

describe('Auth - generateToken', () => {
    beforeEach(async () => {
        process.env.JWT_SECRET = TEST_JWT_SECRET;
        // Clear module cache to reload with new env
        vi.resetModules();
    });

    afterEach(() => {
        delete process.env.JWT_SECRET;
        vi.resetModules();
    });

    it('should generate a valid JWT token', async () => {
        const { generateToken } = await import('../../src/middleware/auth.js');
        const token = generateToken(1, 'admin');
        
        expect(token).toBeDefined();
        expect(typeof token).toBe('string');
        expect(token.split('.')).toHaveLength(3); // JWT has 3 parts
    });

    it('should generate token with correct payload', async () => {
        const { generateToken } = await import('../../src/middleware/auth.js');
        const token = generateToken(42, 'testuser');
        const decoded = jwt.verify(token, TEST_JWT_SECRET) as any;
        
        expect(decoded.userId).toBe(42);
        expect(decoded.username).toBe('testuser');
    });

    it('should throw error when JWT_SECRET is not set', async () => {
        delete process.env.JWT_SECRET;
        vi.resetModules();
        const { generateToken } = await import('../../src/middleware/auth.js');
        
        expect(() => generateToken(1, 'admin')).toThrow('JWT_SECRET not configured');
    });

    it('should generate tokens with 1 year expiration', async () => {
        const { generateToken } = await import('../../src/middleware/auth.js');
        const token = generateToken(1, 'admin');
        const decoded = jwt.verify(token, TEST_JWT_SECRET) as any;
        
        const now = Math.floor(Date.now() / 1000);
        const oneYear = 365 * 24 * 60 * 60;
        const expectedExp = now + oneYear;
        
        // Allow 5 second tolerance for test execution time
        expect(decoded.exp).toBeGreaterThan(expectedExp - 5);
        expect(decoded.exp).toBeLessThan(expectedExp + 5);
    });
});

describe('Auth - authMiddleware', () => {
    let mockRequest: Partial<FastifyRequest>;
    let mockReply: Partial<FastifyReply>;
    let sentStatus: number | undefined;
    let sentPayload: any;

    beforeEach(async () => {
        process.env.JWT_SECRET = TEST_JWT_SECRET;
        vi.resetModules();
        
        sentStatus = undefined;
        sentPayload = undefined;
        
        mockReply = {
            status: vi.fn().mockReturnThis(),
            send: vi.fn((payload: any) => {
                sentPayload = payload;
                return mockReply;
            }),
        };
        
        // Capture status calls
        mockReply.status = vi.fn((code: number) => {
            sentStatus = code;
            return mockReply;
        });
    });

    afterEach(() => {
        delete process.env.JWT_SECRET;
        delete process.env.NODE_ENV;
        vi.resetModules();
    });

    it('should skip auth for public paths', async () => {
        const { authMiddleware } = await import('../../src/middleware/auth.js');
        mockRequest = {
            url: '/health',
            headers: {},
        };

        await authMiddleware(mockRequest as FastifyRequest, mockReply as FastifyReply);
        
        expect(sentStatus).toBeUndefined();
        expect(sentPayload).toBeUndefined();
    });

    it('should skip auth for login endpoint', async () => {
        const { authMiddleware } = await import('../../src/middleware/auth.js');
        mockRequest = {
            url: '/api/v1/auth/login',
            headers: {},
        };

        await authMiddleware(mockRequest as FastifyRequest, mockReply as FastifyReply);
        
        expect(sentStatus).toBeUndefined();
    });

    it('should skip auth for setup endpoint', async () => {
        const { authMiddleware } = await import('../../src/middleware/auth.js');
        mockRequest = {
            url: '/api/v1/auth/setup',
            headers: {},
        };

        await authMiddleware(mockRequest as FastifyRequest, mockReply as FastifyReply);
        
        expect(sentStatus).toBeUndefined();
    });

    it('should return 401 when no authorization header', async () => {
        const { authMiddleware } = await import('../../src/middleware/auth.js');
        mockRequest = {
            url: '/api/v1/feeds',
            headers: {},
        };

        await authMiddleware(mockRequest as FastifyRequest, mockReply as FastifyReply);
        
        expect(sentStatus).toBe(401);
        expect(sentPayload).toEqual({ error: 'Unauthorized: No token provided' });
    });

    it('should return 401 when authorization header does not start with Bearer', async () => {
        const { authMiddleware } = await import('../../src/middleware/auth.js');
        mockRequest = {
            url: '/api/v1/feeds',
            headers: {
                authorization: 'Basic dXNlcjpwYXNz',
            },
        };

        await authMiddleware(mockRequest as FastifyRequest, mockReply as FastifyReply);
        
        expect(sentStatus).toBe(401);
        expect(sentPayload).toEqual({ error: 'Unauthorized: No token provided' });
    });

    it('should return 401 for invalid token', async () => {
        const { authMiddleware } = await import('../../src/middleware/auth.js');
        mockRequest = {
            url: '/api/v1/feeds',
            headers: {
                authorization: 'Bearer invalid-token',
            },
        };

        await authMiddleware(mockRequest as FastifyRequest, mockReply as FastifyReply);
        
        expect(sentStatus).toBe(401);
        expect(sentPayload).toEqual({ error: 'Unauthorized: Invalid token' });
    });

    it('should attach user to request for valid token', async () => {
        const { generateToken, authMiddleware } = await import('../../src/middleware/auth.js');
        const token = generateToken(42, 'testuser');
        mockRequest = {
            url: '/api/v1/feeds',
            headers: {
                authorization: `Bearer ${token}`,
            },
        };

        await authMiddleware(mockRequest as FastifyRequest, mockReply as FastifyReply);
        
        expect(sentStatus).toBeUndefined();
        expect((mockRequest as any).user).toMatchObject({
            userId: 42,
            username: 'testuser',
        });
    });

    it('should return 401 for expired JWT token', async () => {
        const { authMiddleware } = await import('../../src/middleware/auth.js');
        // Create an expired token
        const expiredToken = jwt.sign(
            { userId: 1, username: 'admin' },
            TEST_JWT_SECRET,
            { expiresIn: '-1h' }
        );

        mockRequest = {
            url: '/api/v1/feeds',
            headers: {
                authorization: `Bearer ${expiredToken}`,
            },
        };

        await authMiddleware(mockRequest as FastifyRequest, mockReply as FastifyReply);
        
        expect(sentStatus).toBe(401);
        expect(sentPayload).toEqual({
            error: 'Unauthorized: Token expired',
            code: 'TOKEN_EXPIRED',
        });
    });

    it('should return 500 in production when JWT_SECRET is not set', async () => {
        delete process.env.JWT_SECRET;
        process.env.NODE_ENV = 'production';
        vi.resetModules();
        const { authMiddleware } = await import('../../src/middleware/auth.js');

        mockRequest = {
            url: '/api/v1/feeds',
            headers: {
                authorization: 'Bearer some-token',
            },
        };

        await authMiddleware(mockRequest as FastifyRequest, mockReply as FastifyReply);
        
        expect(sentStatus).toBe(500);
        expect(sentPayload).toEqual({ error: 'Server configuration error' });
    });

    it('should allow requests in development without JWT_SECRET', async () => {
        delete process.env.JWT_SECRET;
        process.env.NODE_ENV = 'development';
        vi.resetModules();
        const { authMiddleware } = await import('../../src/middleware/auth.js');

        mockRequest = {
            url: '/api/v1/feeds',
            headers: {
                authorization: 'Bearer some-token',
            },
        };

        await authMiddleware(mockRequest as FastifyRequest, mockReply as FastifyReply);
        
        // Should not set status (allows request through)
        expect(sentStatus).toBeUndefined();
    });
});
