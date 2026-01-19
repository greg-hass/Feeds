import { createContext, useContext, ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { useSettingsStore } from './stores';

export const darkColors = {
    background: {
        primary: '#1a1a1a',
        secondary: '#252525',
        tertiary: '#2f2f2f',
        elevated: '#0f0f0f',
    },
    text: {
        primary: '#f5f5f5',
        secondary: '#a3a3a3',
        tertiary: '#737373',
        inverse: '#1a1a1a',
    },
    border: {
        DEFAULT: '#3f3f3f',
        light: '#525252',
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
    },
    secondary: {
        DEFAULT: '#0d9488', // Teal 600
        light: '#2dd4bf',   // Teal 400
        dark: '#0f766e',    // Teal 700
    },
    success: '#10b981',
    error: '#ef4444',
    warning: '#f59e0b',
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

export const typography = {
    sans: {
        family: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    },
    serif: {
        family: "Lora, Georgia, 'Times New Roman', serif",
    }
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

export type ThemeColors = typeof colors;

const ThemeContext = createContext<ThemeColors>(colors);

export function ThemeProvider({ children }: { children: ReactNode }) {
    const systemTheme = useColorScheme();
    const settings = useSettingsStore((state: any) => state.settings);

    const theme = settings?.theme || 'auto';
    const isDark = theme === 'dark' || (theme === 'auto' && systemTheme === 'dark');

    const currentColors: ThemeColors = {
        ...sharedColors,
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

