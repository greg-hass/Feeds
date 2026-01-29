import { ApiError } from './api';
import { useToastStore } from '@/stores';

/**
 * Centralized error handling for the Feeds application.
 * Provides consistent error reporting across all components.
 */

export enum ErrorCategory {
    NETWORK = 'network',
    SERVER = 'server',
    VALIDATION = 'validation',
    NOT_FOUND = 'not_found',
    UNKNOWN = 'unknown',
}

export interface AppError {
    category: ErrorCategory;
    message: string;
    userMessage: string;
    originalError?: unknown;
    status?: number;
}

/**
 * Parse an error into a standardized AppError format
 */
export function parseError(error: unknown): AppError {
    // Handle ApiError from our api.ts
    if (error instanceof ApiError) {
        return {
            category: categorizeStatus(error.status),
            message: error.message,
            userMessage: getUserMessageForStatus(error.status, error.message),
            status: error.status,
            originalError: error,
        };
    }

    // Handle standard Error
    if (error instanceof Error) {
        return {
            category: ErrorCategory.UNKNOWN,
            message: error.message,
            userMessage: error.message || 'An unexpected error occurred',
            originalError: error,
        };
    }

    // Handle string errors
    if (typeof error === 'string') {
        return {
            category: ErrorCategory.UNKNOWN,
            message: error,
            userMessage: error,
            originalError: new Error(error),
        };
    }

    // Unknown error type
    return {
        category: ErrorCategory.UNKNOWN,
        message: 'An unknown error occurred',
        userMessage: 'Something went wrong. Please try again.',
        originalError: error,
    };
}

/**
 * Categorize HTTP status code into ErrorCategory
 */
function categorizeStatus(status?: number): ErrorCategory {
    if (!status) return ErrorCategory.NETWORK;

    if (status === 404) return ErrorCategory.NOT_FOUND;
    if (status === 422 || status === 400) return ErrorCategory.VALIDATION;
    if (status >= 500) return ErrorCategory.SERVER;
    if (status >= 400) return ErrorCategory.VALIDATION;

    return ErrorCategory.UNKNOWN;
}

/**
 * Get user-friendly message based on status code
 */
function getUserMessageForStatus(status: number | undefined, fallback: string): string {
    if (!status) return 'Network error. Please check your connection.';

    switch (status) {
        case 400:
            return 'Invalid request. Please check your input.';
        case 404:
            return 'The requested resource was not found.';
        case 409:
            return 'This resource already exists.';
        case 422:
            return 'Invalid data. Please check your input.';
        case 429:
            return 'Too many requests. Please wait a moment.';
        case 500:
            return 'Server error. Please try again later.';
        case 502:
        case 503:
            return 'Service temporarily unavailable. Please try again later.';
        case 504:
            return 'Request timed out. Please try again.';
        default:
            return fallback || 'Something went wrong. Please try again.';
    }
}

/**
 * Handle an error with appropriate user feedback
 * - Shows toast for user-facing errors
 * - Logs to console for debugging
 * - Returns parsed error for further handling
 */
export function handleError(error: unknown, options?: {
    showToast?: boolean;
    toastType?: 'error' | 'info';
    fallbackMessage?: string;
    context?: string;
}): AppError {
    const {
        showToast = true,
        toastType = 'error',
        fallbackMessage,
        context,
    } = options || {};

    const parsedError = parseError(error);

    // Log to console for debugging
    if (context) {
        console.error(`[Error: ${context}]`, parsedError);
    } else {
        console.error('[Error]', parsedError);
    }

    // Show toast notification (but not for auth errors)
    if (showToast && parsedError.status !== 401) {
        const message = fallbackMessage || parsedError.userMessage;
        useToastStore.getState().show(message, toastType);
    }

    return parsedError;
}

/**
 * Wrap an async function with error handling
 */
export function withErrorHandling<T extends (...args: unknown[]) => Promise<unknown>>(
    fn: T,
    options?: Parameters<typeof handleError>[1]
): T {
    return (async (...args: Parameters<T>) => {
        try {
            return await fn(...args);
        } catch (error) {
            handleError(error, options);
            throw error; // Re-throw for caller to handle if needed
        }
    }) as T;
}

/**
 * Check if an error is recoverable (should we retry?)
 */
export function isRecoverable(error: AppError): boolean {
    return (
        error.category === ErrorCategory.NETWORK ||
        error.status === 429 || // Rate limit
        error.status === 503 || // Service unavailable
        error.status === 504 // Gateway timeout
    );
}
