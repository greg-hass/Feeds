import { Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';

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

    // Native: use expo-web-browser (SFSafariViewController on iOS, Chrome Custom Tabs on Android)
    // This prevents blank Safari pages when apps redirect (YouTube, Reddit, etc.)
    try {
        await WebBrowser.openBrowserAsync(url, {
            dismissButtonStyle: 'close',
        });
    } catch (error) {
        console.error('WebBrowser error:', error);
    }
}
