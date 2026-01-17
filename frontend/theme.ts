// Theme constants for Feeds app
// Dark grey base, emerald green primary, royal purple secondary

export const colors = {
    // Backgrounds
    background: {
        primary: '#1a1a1a',     // Main app background
        secondary: '#252525',    // Cards, inputs
        tertiary: '#2f2f2f',     // Hover states
        elevated: '#0f0f0f',     // Sidebar, modals
    },

    // Primary accent - Emerald Green
    primary: {
        DEFAULT: '#10b981',      // Main emerald
        light: '#34d399',        // Lighter variant
        dark: '#059669',         // Darker variant
    },

    // Secondary accent - Royal Purple
    secondary: {
        DEFAULT: '#8b5cf6',      // Main purple
        light: '#a78bfa',        // Lighter variant
        dark: '#7c3aed',         // Darker variant
    },

    // Text
    text: {
        primary: '#f5f5f5',      // Main text
        secondary: '#a3a3a3',    // Muted text
        tertiary: '#737373',     // Very muted
        inverse: '#1a1a1a',      // Text on accent backgrounds
    },

    // Borders
    border: {
        DEFAULT: '#3f3f3f',
        light: '#525252',
    },

    // Status colors
    success: '#10b981',
    error: '#ef4444',
    warning: '#f59e0b',

    // Feed type colors
    feedTypes: {
        rss: '#10b981',          // Emerald (primary)
        youtube: '#ef4444',      // Red
        podcast: '#8b5cf6',      // Purple (secondary)
        reddit: '#f97316',       // Orange
    },
};

// Common style values
export const spacing = {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    xxl: 32,
};

export const borderRadius = {
    sm: 6,
    md: 10,
    lg: 14,
    full: 9999,
};
