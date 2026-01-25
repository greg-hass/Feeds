import { Platform, Share } from 'react-native';
import { useToastStore } from '@/stores/toastStore';

type SharePayload = {
    title?: string;
    message?: string;
    url?: string;
};

type WebNavigator = Navigator & {
    share?: (data: { title?: string; text?: string; url?: string }) => Promise<void>;
    clipboard?: {
        writeText?: (text: string) => Promise<void>;
    };
};

export async function shareContent({ title, message, url }: SharePayload): Promise<boolean> {
    const shareText = [message, url].filter(Boolean).join('\n') || message || title || '';

    if (Platform.OS === 'web') {
        const webNavigator: WebNavigator | null = typeof navigator !== 'undefined' ? navigator : null;

        if (webNavigator?.share) {
            try {
                await webNavigator.share({
                    title,
                    text: message || title,
                    url,
                });
                return true;
            } catch (error) {
                const name = typeof error === 'object' && error && 'name' in error ? String((error as { name?: string }).name) : '';
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

        if (typeof window !== 'undefined' && shareText) {
            window.prompt('Copy to clipboard:', shareText);
            return true;
        }

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
