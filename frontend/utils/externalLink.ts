import { Platform, Linking } from 'react-native';
import * as WebBrowser from 'expo-web-browser';

/**
 * Initialize WebBrowser (no-op for compatiblity)
 */
export function initWebBrowser(): void {}

/**
 * Clean up WebBrowser (no-op for compatibility)
 */
export function cleanupWebBrowser(): void {}

/**
 * Domains that have native iOS/Android apps.
 * For these on web, we navigate in the same window to avoid blank tabs.
 */
const NATIVE_APP_DOMAINS = [
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
 * Check if iOS Safari (for PWA detection)
 */
function isIOSSafari(): boolean {
    if (typeof navigator === 'undefined') return false;
    const ua = navigator.userAgent;
    return /iPad|iPhone|iPod/.test(ua) && !('MSStream' in window);
}

/**
 * Check if URL is for a native app domain
 */
function isNativeAppUrl(url: string): boolean {
    try {
        const hostname = new URL(url).hostname.toLowerCase();
        return NATIVE_APP_DOMAINS.some(d => hostname === d || hostname.endsWith('.' + d));
    } catch {
        return false;
    }
}

/**
 * Open an external URL.
 * 
 * For PWA on iOS: Uses window.location.href for native app URLs
 * to avoid leaving blank Safari tabs when Universal Links trigger.
 */
export async function openExternalLink(url: string): Promise<void> {
    if (Platform.OS === 'web') {
        // PWA on iOS Safari with native app URL: navigate in same window
        // This prevents blank Safari tabs when Universal Links open native apps
        if (isIOSSafari() && isNativeAppUrl(url)) {
            window.location.href = url;
            return;
        }
        // All other web: open new tab
        window.open(url, '_blank', 'noopener,noreferrer');
        return;
    }

    // Native iOS: try custom URL schemes
    if (Platform.OS === 'ios') {
        const opened = await tryOpenWithCustomScheme(url);
        if (opened) return;
    }

    // Fallback: in-app browser
    try {
        await WebBrowser.openBrowserAsync(url, {
            dismissButtonStyle: 'close',
            presentationStyle: WebBrowser.WebBrowserPresentationStyle.FORM_SHEET,
            readerMode: false,
            enableBarCollapsing: true,
        });
    } catch (error) {
        try {
            await Linking.openURL(url);
        } catch (e) {
            console.error('Failed to open URL:', e);
        }
    }
}

// Helper for native iOS custom schemes
async function tryOpenWithCustomScheme(url: string): Promise<boolean> {
    // YouTube
    const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/);
    if (ytMatch) {
        const appUrl = `youtube://${ytMatch[1]}`;
        try {
            if (await Linking.canOpenURL(appUrl)) {
                await Linking.openURL(appUrl);
                return true;
            }
        } catch {}
    }

    // Reddit
    try {
        const urlObj = new URL(url);
        if (urlObj.hostname.includes('reddit.com')) {
            const appUrl = `reddit:/${urlObj.pathname}`;
            if (await Linking.canOpenURL(appUrl)) {
                await Linking.openURL(appUrl);
                return true;
            }
        }
    } catch {}

    return false;
}


