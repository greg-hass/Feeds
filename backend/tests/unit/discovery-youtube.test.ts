import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

const discoverFeedsFromUrlMock = vi.hoisted(() => vi.fn());

vi.mock('../../src/services/discovery/url-discovery.js', () => ({
    discoverFeedsFromUrl: discoverFeedsFromUrlMock,
}));

import { buildYouTubeSearchQueries, discoverByKeyword } from '../../src/services/discovery.js';

describe('YouTube keyword discovery', () => {
    beforeEach(() => {
        discoverFeedsFromUrlMock.mockReset();
        delete process.env.YOUTUBE_API_KEY;
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('builds handle-like query variants for multi-word names', () => {
        expect(buildYouTubeSearchQueries('garland nixon')).toEqual(
            expect.arrayContaining(['garland nixon', 'garlandnixon', 'garland', 'garlandn'])
        );
    });

    it('resolves a handle result when the broader search term misses it', async () => {
        const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
            const url = String(input);
            const parsed = new URL(url);
            const q = parsed.searchParams.get('q') || '';

            if (url.includes('duckduckgo')) {
                return {
                    ok: false,
                    status: 404,
                    json: async () => [],
                    text: async () => '',
                } as Response;
            }

            if (q === 'garlandn') {
                return {
                    ok: true,
                    status: 200,
                    json: async () => ([{
                        author: 'Garland Nixon',
                        author_url: '/@garlandn',
                        author_thumbnail: 'https://example.com/avatar.jpg',
                    }]),
                    text: async () => '',
                } as Response;
            }

            return {
                ok: true,
                status: 200,
                json: async () => ([]),
                text: async () => '',
            } as Response;
        });

        vi.stubGlobal('fetch', fetchMock);

        discoverFeedsFromUrlMock.mockResolvedValue([
            {
                type: 'youtube',
                title: 'Garland Nixon',
                feed_url: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCGARLAND',
                site_url: 'https://www.youtube.com/@garlandn',
                icon_url: 'https://example.com/avatar.jpg',
                confidence: 0.98,
                method: 'youtube',
                isActive: true,
            },
        ]);

        const results = await discoverByKeyword('garland nixon', 1, 'youtube');

        expect(results).toHaveLength(1);
        expect(results[0].title).toBe('Garland Nixon');
        expect(results[0].feed_url).toContain('UCGARLAND');
        expect(discoverFeedsFromUrlMock).toHaveBeenCalledWith('https://www.youtube.com/@garlandn');
    });
});
