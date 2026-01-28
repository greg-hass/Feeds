import { Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';

let isInitialized = false;

/**
 * Initialize WebBrowser (no-op for compatiblity)
 * Kept for backward compatibility with existing code
 */
export async function initWebBrowser(): Promise<void> {
    if (Platform.OS === 'web' || isInitialized) return;
    // Warm up is no longer needed with FORM_SHEET presentation
    isInitialized = true;
}

/**
 * Clean up WebBrowser (no-op for compatibility)
 * Kept for backward compatibility with existing code
 */
export async function cleanupWebBrowser(): Promise<void> {
    // No cleanup needed with current implementation
}

/**
 * Open an external URL using the appropriate method for the platform
 * Uses expo-web-browser for native platforms
 * 
 * Note: iOS Universal Links (Reddit, YouTube apps) will still redirect to native apps.
 * The blank Safari page issue is an iOS bug we work around by using modal presentation.
 */
export async function openExternalLink(url: string): Promise<void> {
    if (Platform.OS === 'web') {
        // Web: use window.open
        window.open(url, '_blank', 'noopener,noreferrer');
        return;
    }

    // Use expo-web-browser with FORM_SHEET presentation
    // This creates a modal that iOS properly dismisses even with Universal Links
    try {
        await WebBrowser.openBrowserAsync(url, {
            dismissButtonStyle: 'close',
            presentationStyle: WebBrowser.WebBrowserPresentationStyle.FORM_SHEET,
            readerMode: false,
            // Enable bar collapsing so the browser takes full screen
            enableBarCollapsing: true,
        });
    } catch (error) {
        console.error('WebBrowser error:', error);
    }
}
