import { Platform, Linking } from 'react-native';

let WebBrowser: typeof import('expo-web-browser') | null = null;
let isInitialized = false;

/**
 * Initialize WebBrowser for native platforms
 * Must be called before using openExternalLink
 */
export async function initWebBrowser(): Promise<void> {
    if (Platform.OS === 'web' || Platform.OS === 'ios' || isInitialized) return;

    try {
        WebBrowser = await import('expo-web-browser');
        // Required for iOS to work properly
        await WebBrowser.maybeCompleteAuthSession();
        // Warm up the browser for better performance
        await WebBrowser.warmUpAsync();
        isInitialized = true;
    } catch (error) {
        console.warn('Failed to initialize WebBrowser:', error);
    }
}

/**
 * Clean up WebBrowser resources
 */
export async function cleanupWebBrowser(): Promise<void> {
    if (Platform.OS === 'ios') return;
    if (WebBrowser && isInitialized) {
        try {
            await WebBrowser.coolDownAsync();
        } catch (error) {
            console.warn('Failed to cleanup WebBrowser:', error);
        }
    }
}

/**
 * Open an external URL using the appropriate method for the platform
 */
export async function openExternalLink(url: string): Promise<void> {
    if (Platform.OS === 'web') {
        // Web: use window.open
        window.open(url, '_blank', 'noopener,noreferrer');
        return;
    }

    if (Platform.OS === 'ios') {
        try {
            await Linking.openURL(url);
        } catch (error) {
            console.error('Linking error:', error);
        }
        return;
    }

    // Native: try to use expo-web-browser
    if (!isInitialized) {
        await initWebBrowser();
    }

    if (WebBrowser) {
        try {
            await WebBrowser.openBrowserAsync(url, {
                preferredBrowserMode: 'minimal',
            });
        } catch (error) {
            console.error('WebBrowser error:', error);
            // Fallback: just log the URL
            console.log('External link (fallback):', url);
        }
    } else {
        console.log('External link (no WebBrowser):', url);
    }
}
