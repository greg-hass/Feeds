import { Agent, setGlobalDispatcher } from 'undici';

export interface RetryOptions {
    retries?: number;
    baseDelayMs?: number;
    maxDelayMs?: number;
    retryStatusCodes?: number[];
    retryErrorCodes?: string[];
}

const DEFAULT_RETRY_STATUS = [408, 429, 500, 502, 503, 504];
const DEFAULT_RETRY_ERRORS = ['ECONNRESET', 'ETIMEDOUT', 'EAI_AGAIN', 'ENOTFOUND', 'UND_ERR_CONNECT_TIMEOUT'];

// Undici connection pooling with keep-alive
// Reuses connections to the same domains for 60s, significantly faster for bulk feed refresh
const dispatcher = new Agent({
    keepAliveTimeout: 60000,
    keepAliveMaxTimeout: 60000,
    connect: {
        timeout: 20000, // 20s connection timeout (matches HTTP.REQUEST_TIMEOUT)
    },
    pipelining: 1, // Disable for stability with YouTube
    connections: 50, // Max concurrent connections per host
});

// Set as global dispatcher for all fetch calls
setGlobalDispatcher(dispatcher);

function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function getBackoffDelay(attempt: number, baseDelayMs: number, maxDelayMs: number) {
    const expDelay = Math.min(maxDelayMs, baseDelayMs * Math.pow(2, attempt));
    const jitter = 0.8 + Math.random() * 0.4;
    return Math.round(expDelay * jitter);
}

function shouldRetryStatus(status: number, retryStatusCodes: number[]) {
    return retryStatusCodes.includes(status);
}

function shouldRetryError(err: unknown, retryErrorCodes: string[]) {
    if (!err || typeof err !== 'object') return false;
    const error = err as { name?: string; code?: string; message?: string; cause?: { code?: string } };
    
    // Check main error code
    if (error.code && retryErrorCodes.includes(error.code)) return true;
    
    // Check nested undici cause code
    if (error.cause?.code && retryErrorCodes.includes(error.cause.code)) return true;
    
    if (error.name === 'AbortError') return true;
    if (error.message && error.message.toLowerCase().includes('fetch failed')) return true;
    return false;
}

export async function fetchWithRetry(
    url: string,
    optionsFactory: () => RequestInit,
    retryOptions: RetryOptions = {}
): Promise<Response> {
    const retries = retryOptions.retries ?? 2;
    const baseDelayMs = retryOptions.baseDelayMs ?? 300;
    const maxDelayMs = retryOptions.maxDelayMs ?? 2000;
    const retryStatusCodes = retryOptions.retryStatusCodes ?? DEFAULT_RETRY_STATUS;
    const retryErrorCodes = retryOptions.retryErrorCodes ?? DEFAULT_RETRY_ERRORS;

    let lastError: unknown;

    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            const options = optionsFactory();

            // Native fetch in Node.js uses undici and respects the global dispatcher
            const response = await fetch(url, options);

            if (!shouldRetryStatus(response.status, retryStatusCodes) || attempt === retries) {
                return response;
            }
            lastError = new Error(`Retryable status: ${response.status}`);
        } catch (err) {
            lastError = err;
            if (!shouldRetryError(err, retryErrorCodes) || attempt === retries) {
                throw err;
            }
        }

        const delayMs = getBackoffDelay(attempt, baseDelayMs, maxDelayMs);
        await sleep(delayMs);
    }

    throw lastError instanceof Error ? lastError : new Error('Fetch retry failed');
}
