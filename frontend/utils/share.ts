import { Platform, Share } from 'react-native';
import { useToastStore } from '@/stores/toastStore';

type SharePayload = {
    title?: string;
    message?: string;
    url?: string;
};

type WebNavigator = Navigator & {
    share?: (data: { title?: string; text?: string; url?: string }) => Promise<void>;
    canShare?: (data: { title?: string; text?: string; url?: string }) => boolean;
    clipboard?: {
        writeText?: (text: string) => Promise<void>;
    };
};

export async function shareContent({ title, message, url }: SharePayload): Promise<boolean> {
    const shareText = [message, url].filter(Boolean).join('\n') || message || title || '';

    if (Platform.OS === 'web') {
        const webNavigator: WebNavigator | null =
            typeof window !== 'undefined' && window.navigator
                ? window.navigator
                : typeof navigator !== 'undefined'
                    ? navigator
                    : null;

        const debugInfo = {
            hasWindow: typeof window !== 'undefined',
            hasNavigator: !!webNavigator,
            hasShare: !!webNavigator?.share,
            hasCanShare: typeof webNavigator?.canShare === 'function',
            isSecureContext: typeof window !== 'undefined' ? window.isSecureContext : undefined,
            title,
            message,
            url,
        };

        if (typeof console !== 'undefined') {
            console.log('[shareContent] web debug', debugInfo);
        }
        useToastStore.getState().show(
            `Share debug: share=${String(debugInfo.hasShare)} canShare=${String(debugInfo.hasCanShare)} secure=${String(debugInfo.isSecureContext)}`,
            'info'
        );

        if (webNavigator?.share) {
            try {
                if (url) {
                    const urlShare = { title, url };
                    const canShareUrl = typeof webNavigator.canShare !== 'function' || webNavigator.canShare(urlShare);
                    if (typeof console !== 'undefined') {
                        console.log('[shareContent] canShare url', canShareUrl, urlShare);
                    }
                    useToastStore.getState().show(`Share debug: canShare(url)=${String(canShareUrl)}`, 'info');

                    if (canShareUrl) {
                        await webNavigator.share(urlShare);
                        return true;
                    }
                }

                const textShare = {
                    title,
                    text: message || title,
                    url,
                };
                const canShareText = typeof webNavigator.canShare !== 'function' || webNavigator.canShare(textShare);
                if (typeof console !== 'undefined') {
                    console.log('[shareContent] canShare text', canShareText, textShare);
                }
                useToastStore.getState().show(`Share debug: canShare(text)=${String(canShareText)}`, 'info');

                if (canShareText) {
                    await webNavigator.share(textShare);
                    return true;
                }
            } catch (error) {
                const name = typeof error === 'object' && error && 'name' in error ? String((error as { name?: string }).name) : '';
                if (typeof console !== 'undefined') {
                    console.log('[shareContent] share error', name, error);
                }
                useToastStore.getState().show(`Share error: ${name || 'unknown'}`, 'error');
                if (name === 'AbortError') return false;
            }
        }

        if (webNavigator?.clipboard?.writeText && shareText) {
            try {
                await webNavigator.clipboard.writeText(shareText);
                useToastStore.getState().show('Link copied to clipboard.', 'info');
                return true;
            } catch {
                // fall through
            }
        }

        useToastStore.getState().show('Sharing not supported in this browser.', 'info');

        return false;
    }

    try {
        await Share.share({
            message: message || url || title || '',
            url: url || undefined,
            title,
        });
        return true;
    } catch {
        return false;
    }
}
