import { CONTENT } from '../config/constants.js';

export function extractHeroImage(content: string, meta: any = {}): string | null {
    if (meta.image?.url) return meta.image.url;
    if (meta['media:thumbnail']?.url) return meta['media:thumbnail'].url;
    if (meta['og:image']) return meta['og:image'];
    if (meta['twitter:image']) return meta['twitter:image'];

    if (content) {
        const imgRegex = /<img[^>]+src="([^">]+)"[^>]*>/gi;
        let match;
        while ((match = imgRegex.exec(content)) !== null) {
            const src = match[1];
            if (src.startsWith('data:')) continue;
            if (src.includes('icon') || src.includes('avatar') || src.includes('logo') || src.includes('spinner')) continue;
            return src;
        }
    }

    return null;
}

export function stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

export function truncate(text: string, length: number): string {
    if (text.length <= length) return text;
    return text.substring(0, length).replace(/\s+\S*$/, '') + CONTENT.TRUNCATION_SUFFIX;
}

export function decodeHtmlEntities(text: string | null): string {
    if (!text) return '';
    return text.replace(/&(#?[a-zA-Z0-9]+);/g, (match, entity) => {
        const entities: Record<string, string> = {
            'amp': '&',
            'lt': '<',
            'gt': '>',
            'quot': '"',
            'apos': "'",
            'nbsp': ' ',
        };
        if (entity.startsWith('#')) {
            const isHex = entity.charAt(1).toLowerCase() === 'x';
            try {
                const code = isHex ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10);
                return isNaN(code) ? match : String.fromCharCode(code);
            } catch {
                return match;
            }
        }
        const lowerEntity = entity.toLowerCase();
        return entities[lowerEntity] || match;
    });
}

export function extractFavicon(siteUrl: string | null): string | null {
    if (!siteUrl) return null;
    try {
        const url = new URL(siteUrl);
        return `${url.origin}/favicon.ico`;
    } catch {
        return null;
    }
}
