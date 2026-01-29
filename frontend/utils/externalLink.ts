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
 * Extract YouTube video ID from a URL
 */
function extractYouTubeVideoId(url: string): string | null {
    const patterns = [
        /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
        /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
    ];
    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match) return match[1];
    }
    return null;
}

/**
 * Extract Reddit path from a URL (subreddit, post, etc.)
 */
function extractRedditPath(url: string): string | null {
    try {
        const urlObj = new URL(url);
        if (urlObj.hostname.includes('reddit.com')) {
            return urlObj.pathname; // e.g., /r/apple/comments/...
        }
    } catch {
        // Invalid URL
    }
    return null;
}

/**
 * Try to open a URL using the app's custom URL scheme.
 * Returns true if successful, false if the app isn't installed.
 */
async function tryOpenWithCustomScheme(url: string): Promise<boolean> {
    // YouTube: youtube://video_id or youtube://www.youtube.com/watch?v=id
    const youtubeVideoId = extractYouTubeVideoId(url);
    if (youtubeVideoId) {
        const youtubeAppUrl = `youtube://${youtubeVideoId}`;
        try {
            const canOpen = await Linking.canOpenURL(youtubeAppUrl);
            if (canOpen) {
                await Linking.openURL(youtubeAppUrl);
                return true;
            }
        } catch {
            // App not installed or scheme not supported
        }
    }

    // Reddit: reddit://path
    const redditPath = extractRedditPath(url);
    if (redditPath) {
        const redditAppUrl = `reddit:/${redditPath}`;
        try {
            const canOpen = await Linking.canOpenURL(redditAppUrl);
            if (canOpen) {
                await Linking.openURL(redditAppUrl);
                return true;
            }
        } catch {
            // App not installed or scheme not supported
        }
    }

    return false;
}

/**
 * Open an external URL using the appropriate method for the platform
 * 
 * For YouTube and Reddit, tries to use custom URL schemes to open
 * directly in native apps without Safari. Falls back to in-app browser.
 */
export async function openExternalLink(url: string): Promise<void> {
    if (Platform.OS === 'web') {
        window.open(url, '_blank', 'noopener,noreferrer');
        return;
    }

    // Try custom URL schemes first (opens app directly, no Safari)
    if (Platform.OS === 'ios') {
        const opened = await tryOpenWithCustomScheme(url);
        if (opened) {
            return;
        }
    }

    // Fall back to in-app browser for other URLs or if app not installed
    try {
        await WebBrowser.openBrowserAsync(url, {
            dismissButtonStyle: 'close',
            presentationStyle: WebBrowser.WebBrowserPresentationStyle.FORM_SHEET,
            readerMode: false,
            enableBarCollapsing: true,
        });
    } catch (error) {
        console.error('WebBrowser error:', error);
        try {
            await Linking.openURL(url);
        } catch (e) {
            console.error('Failed to open URL:', e);
        }
    }
}

