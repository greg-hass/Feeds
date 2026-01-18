/**
 * Configuration constants for the Feeds frontend application.
 * Centralizes magic numbers and configuration values.
 */

// ============================================================================
// UI & LAYOUT
// ============================================================================

export const UI = {
    /** Mobile breakpoint width in pixels */
    MOBILE_BREAKPOINT: 768,

    /** Toast notification duration in milliseconds */
    TOAST_DURATION: 3000,

    /** Keyboard navigation debounce delay in milliseconds */
    KEYBOARD_DEBOUNCE_MS: 300,

    /** Sidebar width in pixels (desktop) */
    SIDEBAR_WIDTH: 280,

    /** Header height in pixels */
    HEADER_HEIGHT: 60,
} as const;

// ============================================================================
// DATA FETCHING
// ============================================================================

export const FETCH = {
    /** Number of articles to fetch per page */
    ARTICLE_PAGE_SIZE: 50,

    /** Number of articles to cache locally */
    CACHED_ARTICLE_COUNT: 100,

    /** Maximum number of search results to display */
    MAX_SEARCH_RESULTS: 50,
} as const;

// ============================================================================
// SYNC
// ============================================================================

export const SYNC = {
    /** Background sync interval in milliseconds (5 minutes) */
    SYNC_INTERVAL: 5 * 60 * 1000,

    /** Sync cursor storage key */
    CURSOR_KEY: 'sync_cursor',
} as const;

// ============================================================================
// CONTENT
// ============================================================================

export const CONTENT = {
    /** Maximum article summary length for display */
    MAX_SUMMARY_LENGTH: 500,

    /** Maximum article summary length for preview */
    PREVIEW_SUMMARY_LENGTH: 200,

    /** Truncation suffix */
    TRUNCATION_SUFFIX: '...',
} as const;

// ============================================================================
// STORAGE KEYS
// ============================================================================

export const STORAGE_KEYS = {
    /** AsyncStorage key for feeds list */
    FEEDS: 'feeds-list',

    /** AsyncStorage key for article cache */
    ARTICLES: 'articles-cache',

    /** AsyncStorage key for settings */
    SETTINGS: 'feeds-settings',

    /** AsyncStorage key for sync cursor */
    SYNC_CURSOR: 'sync_cursor',
} as const;

// ============================================================================
// YOUTUBE
// ============================================================================

export const YOUTUBE = {
    /** YouTube video ID length */
    VIDEO_ID_LENGTH: 11,

    /** YouTube thumbnail quality levels */
    THUMBNAIL_QUALITY: {
        DEFAULT: 'default',
        HQ: 'hqdefault',
        MQ: 'mqdefault',
        SD: 'sddefault',
        MAXRES: 'maxresdefault',
    } as const,

    /** YouTube embed parameters */
    EMBED_PARAMS: {
        /** Autoplay video */
        AUTOPLAY: 1,
        /** Mute video */
        MUTE: 0,
        /** Controls enabled */
        CONTROLS: 1,
        /** Related videos shown at end */
        REL: 0,
    } as const,
} as const;

// ============================================================================
// ANIMATION
// ============================================================================

export const ANIMATION = {
    /** Default animation duration in milliseconds */
    DEFAULT_DURATION: 300,

    /** Fast animation duration in milliseconds */
    FAST_DURATION: 150,

    /** Slow animation duration in milliseconds */
    SLOW_DURATION: 500,
} as const;

// ============================================================================
// FORMATS
// ============================================================================

export const FORMAT = {
    /** Date format for display */
    DATE_FORMAT: 'MMM d, yyyy',

    /** Date-time format for display */
    DATE_TIME_FORMAT: 'MMM d, yyyy h:mm a',

    /** Relative date format */
    RELATIVE_DATE_FORMAT: 'relative',
} as const;
