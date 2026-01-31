import { useEffect } from 'react';
import { ACCENT_COLORS } from '@/theme';

/**
 * Generate a colored SVG favicon data URL
 */
function generateFaviconDataUrl(color: string): string {
    // Simple feed icon SVG
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
        <rect width="100" height="100" rx="20" fill="${color}"/>
        <circle cx="30" cy="35" r="8" fill="white"/>
        <path d="M25 55 Q25 50 30 50 L70 50 Q75 50 75 55 L75 60 Q75 65 70 65 L30 65 Q25 65 25 60 Z" fill="white"/>
        <path d="M25 75 Q25 70 30 70 L60 70 Q65 70 65 75 L65 80 Q65 85 60 85 L30 85 Q25 85 25 80 Z" fill="white" opacity="0.7"/>
    </svg>`;
    
    return `data:image/svg+xml;base64,${btoa(svg)}`;
}

/**
 * Update all PWA theme elements with accent color
 */
function updatePwaTheme(accentColor: string) {
    const color = ACCENT_COLORS[accentColor as keyof typeof ACCENT_COLORS]?.DEFAULT || '#10b981';
    
    // 1. Update theme-color meta tag
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
        metaThemeColor.setAttribute('content', color);
    }
    
    // 2. Update msapplication-TileColor (Windows/Edge)
    let metaTileColor = document.querySelector('meta[name="msapplication-TileColor"]');
    if (!metaTileColor) {
        metaTileColor = document.createElement('meta');
        metaTileColor.setAttribute('name', 'msapplication-TileColor');
        document.head.appendChild(metaTileColor);
    }
    metaTileColor.setAttribute('content', color);
    
    // 3. Update favicon dynamically
    const faviconUrl = generateFaviconDataUrl(color);
    
    // Update or create favicon link
    let faviconLink = document.querySelector('link[rel="icon"]') as HTMLLinkElement | null;
    if (!faviconLink) {
        faviconLink = document.createElement('link');
        faviconLink.setAttribute('rel', 'icon');
        faviconLink.setAttribute('type', 'image/svg+xml');
        document.head.appendChild(faviconLink);
    }
    faviconLink.setAttribute('href', faviconUrl);
    
    // 4. Update shortcut icon (some browsers use this)
    let shortcutLink = document.querySelector('link[rel="shortcut icon"]') as HTMLLinkElement | null;
    if (!shortcutLink) {
        shortcutLink = document.createElement('link');
        shortcutLink.setAttribute('rel', 'shortcut icon');
        shortcutLink.setAttribute('type', 'image/svg+xml');
        document.head.appendChild(shortcutLink);
    }
    shortcutLink.setAttribute('href', faviconUrl);
    
    // 5. Send color to service worker for manifest
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
            type: 'SET_ACCENT_COLOR',
            color: color,
        });
    }
    
    console.log('[PWA Theme] Updated to:', accentColor, color);
}

/**
 * Hook to sync PWA theme color with app accent color
 */
export function usePwaThemeColor(accentColor: string | undefined) {
    useEffect(() => {
        if (!accentColor) return;
        
        updatePwaTheme(accentColor);
    }, [accentColor]);
}
