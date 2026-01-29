import { Platform, Linking } from 'react-native';
import * as WebBrowser from 'expo-web-browser';

/**
 * Initialize WebBrowser (no-op for compatiblity)
 * Kept for backward compatibility with existing code
 */
export function initWebBrowser(): void {
    // No initialization needed
}

/**
 * Clean up WebBrowser (no-op for compatibility)
 * Kept for backward compatibility with existing code
 */
export function cleanupWebBrowser(): void {
    // No cleanup needed
}

/**
 * Open an external URL using the appropriate method for the platform
 * 
 * Uses WebBrowser for all URLs to avoid the blank Safari page issue
 * when opening Universal Links (Reddit, YouTube, etc.). WebBrowser
 * handles the native app handoff gracefully without leaving a blank tab.
 */
export async function openExternalLink(url: string): Promise<void> {
    if (Platform.OS === 'web') {
        // Web: use window.open
        window.open(url, '_blank', 'noopener,noreferrer');
        return;
    }

    // Use WebBrowser for all URLs on native platforms
    // This avoids the blank Safari page issue with Universal Links
    try {
        await WebBrowser.openBrowserAsync(url, {
            dismissButtonStyle: 'close',
            presentationStyle: WebBrowser.WebBrowserPresentationStyle.FORM_SHEET,
            readerMode: false,
            enableBarCollapsing: true,
        });
    } catch (error) {
        console.error('WebBrowser error:', error);
        // Fallback: try Linking.openURL
        try {
            await Linking.openURL(url);
        } catch (e) {
            console.error('Failed to open URL:', e);
        }
    }
}
