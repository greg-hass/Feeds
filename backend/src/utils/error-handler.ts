/**
 * Standardized error handling utilities
 * 
 * Provides consistent error logging and handling patterns across the backend.
 * All background/non-critical errors should use these helpers to ensure
 * proper logging without disrupting user-facing operations.
 */

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
