/**
 * Standardized error handling utilities
 * 
 * Provides consistent error logging and handling patterns across the backend.
 * All background/non-critical errors should use these helpers to ensure
 * proper logging without disrupting user-facing operations.
 */

import { FastifyReply } from 'fastify';

/**
 * Standard API error response structure
 */
export interface ApiErrorResponse {
    error: string;
    code?: string;
    details?: unknown;
    timestamp: string;
}

/**
 * Sends a standardized error response
 */
export function sendError(
    reply: FastifyReply,
    statusCode: number,
    message: string,
    code?: string,
    details?: unknown
): void {
    const response: ApiErrorResponse = {
        error: message,
        timestamp: new Date().toISOString(),
    };
    
    if (code) response.code = code;
    if (details) response.details = details;
    
    reply.status(statusCode).send(response);
}

/**
 * Common error response helpers
 */
export const errors = {
    badRequest: (reply: FastifyReply, message = 'Bad request', code?: string) => 
        sendError(reply, 400, message, code),
    
    unauthorized: (reply: FastifyReply, message = 'Unauthorized', code?: string) => 
        sendError(reply, 401, message, code),
    
    forbidden: (reply: FastifyReply, message = 'Forbidden', code?: string) => 
        sendError(reply, 403, message, code),
    
    notFound: (reply: FastifyReply, message = 'Not found', code?: string) => 
        sendError(reply, 404, message, code),
    
    conflict: (reply: FastifyReply, message = 'Conflict', code?: string) => 
        sendError(reply, 409, message, code),
    
    validation: (reply: FastifyReply, message = 'Validation error', details?: unknown) => 
        sendError(reply, 422, message, 'VALIDATION_ERROR', details),
    
    rateLimited: (reply: FastifyReply, message = 'Too many requests', retryAfter?: number) => {
        if (retryAfter) {
            reply.header('Retry-After', String(retryAfter));
        }
        sendError(reply, 429, message, 'RATE_LIMITED');
    },
    
    internal: (reply: FastifyReply, message = 'Internal server error') => 
        sendError(reply, 500, message, 'INTERNAL_ERROR'),
};

/**
 * Logs an error with consistent formatting for background operations
 * Use this for non-critical errors that shouldn't fail the main operation
 */
export function logBackgroundError(context: string, error: unknown, metadata?: Record<string, unknown>): void {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const logEntry: Record<string, unknown> = {
        context,
        error: errorMessage,
        timestamp: new Date().toISOString(),
        ...metadata,
    };
    
    console.warn(`[Background Error] ${context}: ${errorMessage}`, metadata ? JSON.stringify(metadata) : '');
}

/**
 * Logs an error and re-throws it for critical operations
 * Use this when the error should propagate to the caller
 */
export function logAndThrow(context: string, error: unknown): never {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[Critical Error] ${context}: ${errorMessage}`);
    
    if (error instanceof Error) {
        throw error;
    }
    throw new Error(`${context}: ${errorMessage}`);
}

/**
 * Safely executes an async operation with standardized error handling
 * Returns a default value on failure instead of throwing
 */
export async function safeExecute<T>(
    operation: () => Promise<T>,
    context: string,
    defaultValue: T,
    metadata?: Record<string, unknown>
): Promise<T> {
    try {
        return await operation();
    } catch (error) {
        logBackgroundError(context, error, metadata);
        return defaultValue;
    }
}

/**
 * Safely executes a sync operation with standardized error handling
 * Returns a default value on failure instead of throwing
 */
export function safeExecuteSync<T>(
    operation: () => T,
    context: string,
    defaultValue: T,
    metadata?: Record<string, unknown>
): T {
    try {
        return operation();
    } catch (error) {
        logBackgroundError(context, error, metadata);
        return defaultValue;
    }
}
