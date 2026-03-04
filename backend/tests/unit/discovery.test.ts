import { describe, expect, it } from 'vitest';
import { mergeDiscoveryResults } from '../../src/services/discovery.js';
import type { DiscoveredFeed } from '../../src/types/discovery.js';

const buildDiscovery = (
    type: DiscoveredFeed['type'],
    id: string,
    confidence: number
): DiscoveredFeed => ({
    type,
    title: `${type}-${id}`,
    feed_url: `https://example.com/${type}/${id}`,
    confidence,
    method: 'search',
});

describe('mergeDiscoveryResults', () => {
    it('returns a mixed set when searching all feed types', () => {
        const results: DiscoveredFeed[] = [
            buildDiscovery('podcast', '1', 0.99),
            buildDiscovery('podcast', '2', 0.98),
            buildDiscovery('podcast', '3', 0.97),
            buildDiscovery('rss', '1', 0.7),
            buildDiscovery('youtube', '1', 0.8),
            buildDiscovery('reddit', '1', 0.75),
        ];

        const merged = mergeDiscoveryResults(results, 4);

        expect(merged.map((feed) => feed.type)).toEqual(['rss', 'youtube', 'reddit', 'podcast']);
    });

    it('keeps confidence ordering when a single type is requested', () => {
        const results: DiscoveredFeed[] = [
            buildDiscovery('youtube', 'low', 0.7),
            buildDiscovery('youtube', 'high', 0.95),
            buildDiscovery('youtube', 'mid', 0.85),
        ];

        const merged = mergeDiscoveryResults(results, 2, 'youtube');

        expect(merged.map((feed) => feed.feed_url)).toEqual([
            'https://example.com/youtube/high',
            'https://example.com/youtube/mid',
        ]);
    });
});
