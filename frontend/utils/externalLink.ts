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
 * Domains that have native iOS apps and support Universal Links.
 * For these, we use Linking.openURL to let iOS hand off directly
 * to the native app without showing Safari first.
 */
const UNIVERSAL_LINK_DOMAINS = [
    'youtube.com',
    'www.youtube.com',
    'm.youtube.com',
    'youtu.be',
    'reddit.com',
    'www.reddit.com',
    'old.reddit.com',
    'twitter.com',
    'x.com',
    'instagram.com',
    'www.instagram.com',
];

/**
 * Check if a URL is for a known Universal Link domain
 * that should open directly in its native app
 */
function isUniversalLinkUrl(url: string): boolean {
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
 * Open an external URL using the appropriate method for the platform
 * 
 * For Universal Link domains (YouTube, Reddit, Twitter, etc.), uses
 * Linking.openURL to let iOS hand off directly to native apps.
 * For other URLs, uses expo-web-browser for an in-app experience.
 */
export async function openExternalLink(url: string): Promise<void> {
    if (Platform.OS === 'web') {
        // Web: use window.open
        window.open(url, '_blank', 'noopener,noreferrer');
        return;
    }

    // For known Universal Link domains, use Linking.openURL
    // This lets iOS hand off directly to native apps without showing Safari
    if (isUniversalLinkUrl(url)) {
        try {
            await Linking.openURL(url);
            return;
        } catch (error) {
            console.error('Linking.openURL failed, falling back to WebBrowser:', error);
            // Fall through to WebBrowser
        }
    }

    // For other URLs, use in-app browser
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
