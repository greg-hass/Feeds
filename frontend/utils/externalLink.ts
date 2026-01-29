import { Platform, Linking } from 'react-native';
import * as WebBrowser from 'expo-web-browser';

let isInitialized = false;

// Domains that should use Linking.openURL (native app deep links)
// NOTE: YouTube is NOT in this list because Linking.openURL causes
// the chooser dialog and blank Safari page issues. YouTube links
// should use WebBrowser instead for a reliable experience.
const DEEP_LINK_DOMAINS = [
    'reddit.com',
    'www.reddit.com',
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
 * Check if a URL should use native deep linking
 */
export function isDeepLink(url: string): boolean {
    try {
        const urlObj = new URL(url);
        const hostname = urlObj.hostname.toLowerCase();
        return DEEP_LINK_DOMAINS.some(domain => 
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
 * For YouTube URLs: Uses WebBrowser to avoid the chooser dialog and blank page issues
 * For other Universal Links (Reddit, etc.): Uses Linking.openURL to open native apps
 * For regular URLs: Uses WebBrowser for in-app experience
 */
export async function openExternalLink(url: string): Promise<void> {
    if (Platform.OS === 'web') {
        // Web: use window.open
        window.open(url, '_blank', 'noopener,noreferrer');
        return;
    }

    // For deep links (non-YouTube), try Linking.openURL first
    if (isDeepLink(url)) {
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

    // Use WebBrowser for YouTube and all other URLs
    // This opens in an in-app browser which avoids the Universal Link issues
    try {
        await WebBrowser.openBrowserAsync(url, {
            dismissButtonStyle: 'close',
            presentationStyle: WebBrowser.WebBrowserPresentationStyle.FORM_SHEET,
            readerMode: false,
            enableBarCollapsing: true,
        });
    } catch (error) {
        console.error('WebBrowser error:', error);
        // Last resort: try Linking.openURL
        try {
            await Linking.openURL(url);
        } catch (e) {
            console.error('Failed to open URL:', e);
        }
    }
}
