import type { DiscoveredFeed } from '../../types/discovery.js';

export function normalizeDiscoveryKeyword(keyword: string): string {
    return keyword
        .toLowerCase()
        .replace(/[@'".,!?()[\]{}:;|/\\-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

export function compactDiscoveryKeyword(keyword: string): string {
    return normalizeDiscoveryKeyword(keyword).replace(/\s+/g, '');
}

export function buildDiscoverySearchQueries(keyword: string, maxQueries: number = 5): string[] {
    const normalized = normalizeDiscoveryKeyword(keyword);
    if (!normalized) return [];

    const tokens = normalized.split(' ').filter(Boolean);
    const queries = new Set<string>();
    const add = (value: string | null | undefined) => {
        const trimmed = value?.trim();
        if (trimmed) queries.add(trimmed);
    };

    add(keyword);
    add(normalized);
    add(compactDiscoveryKeyword(keyword));

    if (tokens.length > 0) {
        add(tokens[0]);
    }

    if (tokens.length > 1) {
        add(tokens.join(' '));
        add(tokens.join(''));

        const handleLike = `${tokens[0]}${tokens.slice(1).map(token => token[0]).join('')}`;
        add(handleLike);
        add(tokens.map(token => token[0]).join(''));
    }

    return Array.from(queries).slice(0, maxQueries);
}

export function scoreDiscoveryRelevance(candidate: DiscoveredFeed, keyword: string): number {
    const normalizedQuery = compactDiscoveryKeyword(keyword);
    const queryTokens = normalizeDiscoveryKeyword(keyword).split(' ').filter(Boolean);
    const candidateText = compactDiscoveryKeyword([
        candidate.title,
        candidate.site_url || '',
        candidate.feed_url,
    ].join(' '));

    let score = candidate.confidence;

    if (normalizedQuery && candidateText.includes(normalizedQuery)) {
        score += 0.35;
    }

    if (queryTokens.length > 0 && queryTokens.every(token => candidateText.includes(token))) {
        score += 0.2;
    }

    if (queryTokens.length > 0 && candidate.title.toLowerCase().includes(queryTokens[0])) {
        score += 0.1;
    }

    if (queryTokens.length > 1) {
        const compactPrefix = queryTokens.slice(0, 2).join('');
        const handleLike = `${queryTokens[0]}${queryTokens.slice(1).map(token => token[0]).join('')}`;

        if (candidateText.includes(compactPrefix)) {
            score += 0.1;
        }

        if (candidate.site_url?.toLowerCase().includes(`@${handleLike}`)) {
            score += 0.4;
        }
    }

    return score;
}
