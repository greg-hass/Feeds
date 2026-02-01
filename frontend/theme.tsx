import { createContext, useContext, ReactNode, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
    sky: {
        DEFAULT: '#0ea5e9', // Sky 500
        light: '#38bdf8',
        dark: '#0284c7',
        soft: '#0ea5e925',
    },
    indigo: {
        DEFAULT: '#6366f1',
        light: '#818cf8',
        dark: '#4f46e5',
        soft: '#6366f125',
    },
    purple: {
        DEFAULT: '#a855f7', // Purple 500
        light: '#c084fc',
        dark: '#9333ea',
        soft: '#a855f725',
    },
    rose: {
        DEFAULT: '#f43f5e',
        light: '#fb7185',
        dark: '#e11d48',
        soft: '#f43f5e25',
    },
    orange: {
        DEFAULT: '#f97316', // Orange 500
        light: '#fb923c',
        dark: '#ea580c',
        soft: '#f9731625',
    },
    teal: {
        DEFAULT: '#14b8a6', // Teal 500
        light: '#2dd4bf',
        dark: '#0f766e',
        soft: '#14b8a625',
    },
    slate: {
        DEFAULT: '#64748b', // Slate 500
        light: '#94a3b8',
        dark: '#475569',
        soft: '#64748b25',
    },
};

export type AccentColor = keyof typeof ACCENT_COLORS;
export type ThemeColors = typeof colors;

const ThemeContext = createContext<ThemeColors>(colors);

// Cache for the last known theme to prevent flash on app resume
let cachedTheme: string | null = null;
let cachedIsDark: boolean | null = null;

export function ThemeProvider({ children }: { children: ReactNode }) {
    const systemTheme = useColorScheme();
    const settings = useSettingsStore((state: any) => state.settings);
    
    // Use cached values initially to prevent flash
    const [initialTheme, setInitialTheme] = useState<string | null>(cachedTheme);
    const [initialIsDark, setInitialIsDark] = useState<boolean | null>(cachedIsDark);
    
    // Load persisted theme on mount
    useEffect(() => {
        if (cachedTheme === null) {
            AsyncStorage.getItem('feeds-settings').then((persisted) => {
                if (persisted) {
                    try {
                        const parsed = JSON.parse(persisted);
                        const theme = parsed?.state?.settings?.theme || 'auto';
                        const isDark = theme === 'dark' || (theme === 'auto' && systemTheme === 'dark');
                        cachedTheme = theme;
                        cachedIsDark = isDark;
                        setInitialTheme(theme);
                        setInitialIsDark(isDark);
                    } catch {
                        // Fallback to defaults
                        cachedTheme = 'auto';
                        cachedIsDark = systemTheme === 'dark';
                        setInitialTheme('auto');
                        setInitialIsDark(systemTheme === 'dark');
                    }
                } else {
                    cachedTheme = 'auto';
                    cachedIsDark = systemTheme === 'dark';
                    setInitialTheme('auto');
                    setInitialIsDark(systemTheme === 'dark');
                }
            });
        }
    }, [systemTheme]);

    // Determine current theme - use cached values initially to prevent flash
    const theme = settings?.theme || initialTheme || 'auto';
    const isDark = theme === 'dark' || (theme === 'auto' && systemTheme === 'dark');
    
    // Update cache when theme changes
    useEffect(() => {
        cachedTheme = theme;
        cachedIsDark = isDark;
    }, [theme, isDark]);
    
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
