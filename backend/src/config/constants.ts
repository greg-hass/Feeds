/**
 * Configuration constants for the Feeds backend application.
 * Centralizes magic numbers and configuration values.
 */

// ============================================================================
// HTTP & API
// ============================================================================

export const HTTP = {
    /** Default timeout for HTTP requests in milliseconds */
    REQUEST_TIMEOUT: 30000,

    /** Status codes */
    STATUS: {
        OK: 200,
        CREATED: 201,
        NO_CONTENT: 204,
        BAD_REQUEST: 400,
        UNAUTHORIZED: 401,
        FORBIDDEN: 403,
        NOT_FOUND: 404,
        CONFLICT: 409,
        UNPROCESSABLE_ENTITY: 422,
        TOO_MANY_REQUESTS: 429,
        INTERNAL_SERVER_ERROR: 500,
        SERVICE_UNAVAILABLE: 503,
        GATEWAY_TIMEOUT: 504,
    } as const,
} as const;

// ============================================================================
// RATE LIMITING
// ============================================================================

export const RATE_LIMIT = {
    /** Rate limit window duration in milliseconds (1 minute) */
    WINDOW_MS: 60 * 1000,

    /** Search requests per minute per IP */
    SEARCH_MAX_REQUESTS: 10,

    /** Feed operations per minute per IP */
    FEEDS_MAX_REQUESTS: 30,

    /** Article operations per minute per IP */
    ARTICLES_MAX_REQUESTS: 60,
} as const;

// ============================================================================
// FEEDS & ARTICLES
// ============================================================================

export const FEEDS = {
    /** Maximum number of articles to return per page */
    PAGE_SIZE: 50,

    /** Maximum number of articles to return in search */
    SEARCH_LIMIT: 50,

    /** Maximum search limit allowed */
    MAX_SEARCH_LIMIT: 100,

    /** Error count before marking feed as failed */
    ERROR_THRESHOLD: 5,

    /** Number of articles to sync per batch */
    SYNC_BATCH_SIZE: 500,

    /** Maximum article summary length for FTS snippet */
    FTS_SNIPPET_LENGTH: 40,

    /** FTS snippet context length */
    FTS_SNIPPET_CONTEXT: 2,
} as const;

// ============================================================================
// SCHEDULING & SYNC
// ============================================================================

export const SCHEDULING = {
    /** Default feed refresh interval in milliseconds (1 hour) */
    DEFAULT_REFRESH_INTERVAL: 60 * 60 * 1000,

    /** Minimum refresh interval in milliseconds (5 minutes) */
    MIN_REFRESH_INTERVAL: 5 * 60 * 1000,

    /** Scheduler tick interval in milliseconds (1 minute) */
    TICK_INTERVAL: 60 * 1000,

    /** Sync cursor encoding */
    CURSOR_ENCODING: 'base64' as const,
} as const;

// ============================================================================
// CONTENT PROCESSING
// ============================================================================

export const CONTENT = {
    /** Maximum article summary length for display */
    MAX_SUMMARY_LENGTH: 500,

    /** Maximum article summary length for preview */
    PREVIEW_SUMMARY_LENGTH: 200,

    /** Truncation suffix */
    TRUNCATION_SUFFIX: '...',

    /** Readability fetch timeout in milliseconds */
    READABILITY_TIMEOUT: 15000,
} as const;

// ============================================================================
// DATABASE
// ============================================================================

export const DATABASE = {
    /** Database filename */
    FILENAME: 'feeds.db',

    /** Database journal mode */
    JOURNAL_MODE: 'WAL',

    /** Database busy timeout in milliseconds */
    BUSY_TIMEOUT: 5000,
} as const;

// ============================================================================
// STRINGS
// ============================================================================

export const STRINGS = {
    /** Default feed title when none is available */
    DEFAULT_FEED_TITLE: 'Untitled Feed',

    /** Default article title when none is available */
    DEFAULT_ARTICLE_TITLE: 'Untitled',

    /** Generated GUID prefix */
    GENERATED_GUID_PREFIX: 'generated-',

    /** YouTube video ID pattern */
    YOUTUBE_VIDEO_ID_PATTERN: '(?:yt:video:|video:)([a-zA-Z0-9_-]{11})',
} as const;

// ============================================================================
// MISC
// ============================================================================

export const MISC = {
    /** Hash radix for GUID generation */
    HASH_RADIX: 16,
} as const;
