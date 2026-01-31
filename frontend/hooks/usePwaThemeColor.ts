import { useEffect } from 'react';
import { ACCENT_COLORS } from '@/theme';

/**
 * Send accent color to service worker to update PWA theme
 */
function updateServiceWorkerTheme(accentColor: string) {
    const color = ACCENT_COLORS[accentColor as keyof typeof ACCENT_COLORS]?.DEFAULT || '#10b981';
    
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
            type: 'SET_ACCENT_COLOR',
            color: color,
        });
    }
    
    // Also update theme-color meta tag for immediate effect
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
        metaThemeColor.setAttribute('content', color);
    }
}

/**
 * Hook to sync PWA theme color with app accent color
 */
export function usePwaThemeColor(accentColor: string | undefined) {
    useEffect(() => {
        if (!accentColor) return;
        
        updateServiceWorkerTheme(accentColor);
    }, [accentColor]);
}
