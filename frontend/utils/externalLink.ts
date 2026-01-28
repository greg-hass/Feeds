import { Platform, Linking } from 'react-native';
import * as WebBrowser from 'expo-web-browser';

// URLs that have native apps and cause blank Safari issues
const URLS_WITH_NATIVE_APPS = [
    'reddit.com',
    'youtube.com',
    'youtu.be',
    'twitter.com',
    'x.com',
    'instagram.com',
];

/**
 * Check if URL has a native app that might cause blank Safari pages
 */
function hasNativeApp(url: string): boolean {
    return URLS_WITH_NATIVE_APPS.some(domain => url.includes(domain));
}

/**
 * Open an external URL using the appropriate method for the platform
 * Uses expo-web-browser for native platforms to avoid blank Safari pages
 */
export async function openExternalLink(url: string): Promise<void> {
    if (Platform.OS === 'web') {
        // Web: use window.open
        window.open(url, '_blank', 'noopener,noreferrer');
        return;
    }

    // For URLs with native apps (Reddit, YouTube), try to open directly
    // This avoids the blank Safari page that occurs when iOS Universal Links
    // redirect to the native app and leave Safari in a broken state
    if (hasNativeApp(url) && Platform.OS === 'ios') {
        try {
            // Try opening directly - this may open the native app
            const canOpen = await Linking.canOpenURL(url);
            if (canOpen) {
                await Linking.openURL(url);
                return;
            }
        } catch {
            // Fall through to WebBrowser
        }
    }

    // Use expo-web-browser (SFSafariViewController on iOS, Chrome Custom Tabs on Android)
    try {
        await WebBrowser.openBrowserAsync(url, {
            dismissButtonStyle: 'close',
            presentationStyle: WebBrowser.WebBrowserPresentationStyle.AUTOMATIC,
            readerMode: false,
        });
    } catch (error) {
        console.error('WebBrowser error:', error);
    }
}
