export interface RetryOptions {
    retries?: number;
    baseDelayMs?: number;
    maxDelayMs?: number;
    retryStatusCodes?: number[];
    retryErrorCodes?: string[];
}

const DEFAULT_RETRY_STATUS = [408, 429, 500, 502, 503, 504];
const DEFAULT_RETRY_ERRORS = ['ECONNRESET', 'ETIMEDOUT', 'EAI_AGAIN', 'ENOTFOUND'];

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
    const error = err as { name?: string; code?: string; message?: string };
    if (error.name === 'AbortError') return true;
    if (error.code && retryErrorCodes.includes(error.code)) return true;
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
            const response = await fetch(url, optionsFactory());
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
