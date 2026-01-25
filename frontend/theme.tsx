import { createContext, useContext, ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { useSettingsStore } from './stores';

export const darkColors = {
    background: {
        primary: '#0d0d0d',    // Darker main background
        secondary: '#161616',   // Darker cards/surfaces
        tertiary: '#1f1f1f',    // Darker tertiary
        elevated: '#0a0a0a',    // Near-black for elevated containers
    },
    text: {
        primary: '#f5f5f5',
        secondary: '#a3a3a3',
        tertiary: '#737373',
        inverse: '#0d0d0d',
    },
    border: {
        DEFAULT: '#2a2a2a',     // Subtler borders
        light: '#3a3a3a',
    },
};

const lightColors = {
    background: {
        primary: '#ffffff',
        secondary: '#f4f4f5',
        tertiary: '#e4e4e7',
        elevated: '#fcfcfc',
    },
    text: {
        primary: '#18181b',
        secondary: '#52525b',
        tertiary: '#71717a',
        inverse: '#ffffff',
    },
    border: {
        DEFAULT: '#e4e4e7',
        light: '#f4f4f5',
    },
};

const sharedColors = {
    primary: {
        DEFAULT: '#10b981',
        light: '#34d399',
        dark: '#059669',
        soft: '#10b98125', // 15% opacity for backgrounds
    },
    accent: {
        primary: '#10b981',
    },
    secondary: {
        DEFAULT: '#0d9488', // Teal 600
        light: '#2dd4bf',   // Teal 400
        dark: '#0f766e',    // Teal 700
    },
    success: '#10b981',
    error: '#ef4444',
    warning: '#f59e0b',
    status: {
        success: '#10b981',
        warning: '#f59e0b',
        error: '#ef4444',
    },
    feedTypes: {
        rss: '#10b981',
        youtube: '#ef4444',
        podcast: '#0d9488',
        reddit: '#f97316',
    },
    reader: {
        sepia: {
            background: '#f4ecd8',
            text: '#5b4636',
            border: '#e1d4b1',
        },
        paper: {
            background: '#fdfcf8',
            text: '#2c3e50',
            border: '#ebedef',
        },
    }
};

const sansFamily = "'SF Pro Display', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
const serifFamily = "'New York', 'Charter', 'Source Serif Pro', 'Georgia', serif";
const systemFamily = "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', sans-serif";

export const typography = {
    sans: {
        family: sansFamily,
    },
    serif: {
        family: serifFamily,
    },
    system: {
        family: systemFamily,
    },
    h1: {
        fontFamily: sansFamily,
        fontSize: 24,
        fontWeight: '700' as const,
    },
    body: {
        fontFamily: sansFamily,
        fontSize: 14,
        fontWeight: '400' as const,
    },
};

// Default export for backward compatibility and static use
export const colors = {
    ...sharedColors,
    ...darkColors,
    dark: darkColors,
    light: lightColors,
};

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
    xl: 20,
    xxl: 28,
    full: 9999,
};

export { shadows } from './theme/shadows';
export { animations } from './theme/animations';

export const ACCENT_COLORS = {
    emerald: {
        DEFAULT: '#10b981',
        light: '#34d399',
        dark: '#059669',
        soft: '#10b98125',
    },
    blue: {
        DEFAULT: '#3b82f6',
        light: '#60a5fa',
        dark: '#2563eb',
        soft: '#3b82f625',
    },
    indigo: {
        DEFAULT: '#6366f1',
        light: '#818cf8',
        dark: '#4f46e5',
        soft: '#6366f125',
    },
    violet: {
        DEFAULT: '#8b5cf6',
        light: '#a78bfa',
        dark: '#7c3aed',
        soft: '#8b5cf625',
    },
    rose: {
        DEFAULT: '#f43f5e',
        light: '#fb7185',
        dark: '#e11d48',
        soft: '#f43f5e25',
    },
    amber: {
        DEFAULT: '#f59e0b',
        light: '#fbbf24',
        dark: '#d97706',
        soft: '#f59e0b25',
    },
    cyan: {
        DEFAULT: '#06b6d4',
        light: '#22d3ee',
        dark: '#0891b2',
        soft: '#06b6d425',
    },
    yellow: {
        DEFAULT: '#facc15',
        light: '#fef08a',
        dark: '#ca8a04',
        soft: '#facc1525',
    },
};

export type AccentColor = keyof typeof ACCENT_COLORS;
export type ThemeColors = typeof colors;

const ThemeContext = createContext<ThemeColors>(colors);

export function ThemeProvider({ children }: { children: ReactNode }) {
    const systemTheme = useColorScheme();
    const settings = useSettingsStore((state: any) => state.settings);

    const theme = settings?.theme || 'auto';
    const isDark = theme === 'dark' || (theme === 'auto' && systemTheme === 'dark');
    const accentKey = (settings?.accent_color as AccentColor) || 'emerald';
    const accent = ACCENT_COLORS[accentKey] || ACCENT_COLORS.emerald;

    const currentColors: ThemeColors = {
        ...sharedColors,
        primary: accent,
        accent: {
            primary: accent.DEFAULT,
        },
        success: accent.DEFAULT,
        status: {
            ...sharedColors.status,
            success: accent.DEFAULT,
        },
        feedTypes: {
            ...sharedColors.feedTypes,
            rss: accent.DEFAULT,
        },
        ...(isDark ? darkColors : lightColors),
        dark: darkColors,
        light: lightColors,
    } as ThemeColors;

    return (
        <ThemeContext.Provider value={currentColors}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useColors() {
    return useContext(ThemeContext);
}
