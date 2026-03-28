import { Platform, Share } from 'react-native';

interface TextExportOptions {
    filename: string;
    content: string;
    mimeType?: string;
    title?: string;
}

export async function exportTextFile({
    filename,
    content,
    mimeType = 'application/json',
    title = filename,
}: TextExportOptions): Promise<boolean> {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 0);
        return true;
    }

    try {
        await Share.share({
            title,
            message: content,
        });
        return true;
    } catch {
        return false;
    }
}
