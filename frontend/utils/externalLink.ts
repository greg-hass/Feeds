import { Platform, Linking } from 'react-native';
import * as WebBrowser from 'expo-web-browser';

let isInitialized = false;

// Domains known to have Universal Links that open native apps
// Using Linking.openURL for these prevents the blank Safari page issue
const UNIVERSAL_LINK_DOMAINS = [
    'reddit.com',
    'www.reddit.com',
    'youtube.com',
    'www.youtube.com',
    'youtu.be',
    'twitter.com',
    'x.com',
    'instagram.com',
    'tiktok.com',
    'linkedin.com',
    'medium.com',
    'apple.com',
    'apps.apple.com',
];

/**
 * Check if a URL might trigger a Universal Link to a native app
 */
export function isUniversalLink(url: string): boolean {
    try {
        const urlObj = new URL(url);
        const hostname = urlObj.hostname.toLowerCase();
        return UNIVERSAL_LINK_DOMAINS.some(domain => 
            hostname === domain || hostname.endsWith('.' + domain)
        );
    } catch {
        return false;
    }
}

/**
 * Initialize WebBrowser (no-op for compatiblity)
 * Kept for backward compatibility with existing code
 */
export function initWebBrowser(): void {
    if (Platform.OS === 'web' || isInitialized) return;
    // Warm up is no longer needed since we don't use WebBrowser for Universal Links
    isInitialized = true;
}

/**
 * Clean up WebBrowser (no-op for compatibility)
 * Kept for backward compatibility with existing code
 */
export function cleanupWebBrowser(): void {
    // No cleanup needed with current implementation
}

/**
 * Open an external URL using the appropriate method for the platform
 * 
 * For URLs that might trigger iOS Universal Links (Reddit, YouTube, etc.),
 * we use Linking.openURL to avoid the blank Safari page bug.
 * 
 * For other URLs, we use expo-web-browser for a better in-app experience.
 */
export async function openExternalLink(url: string): Promise<void> {
    if (Platform.OS === 'web') {
        // Web: use window.open
        window.open(url, '_blank', 'noopener,noreferrer');
        return;
    }

    // For Universal Links, use Linking.openURL to avoid blank Safari page
    if (isUniversalLink(url)) {
        try {
            const canOpen = await Linking.canOpenURL(url);
            if (canOpen) {
                await Linking.openURL(url);
                return;
            }
        } catch (error) {
            console.error('Linking.openURL error:', error);
            // Fall through to WebBrowser as fallback
        }
    }

    // Use expo-web-browser for non-Universal Links
    try {
        await WebBrowser.openBrowserAsync(url, {
            dismissButtonStyle: 'close',
            presentationStyle: WebBrowser.WebBrowserPresentationStyle.FORM_SHEET,
            readerMode: false,
            enableBarCollapsing: true,
        });
    } catch (error) {
        console.error('WebBrowser error:', error);
    }
}
