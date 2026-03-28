import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

const discoverFeedsFromUrlMock = vi.hoisted(() => vi.fn());
const checkFeedActivityMock = vi.hoisted(() => vi.fn());
const checkRedditActivityMock = vi.hoisted(() => vi.fn());
const iconServiceMock = vi.hoisted(() => ({
    getYouTubeIcon: vi.fn().mockResolvedValue(null),
    getRedditIcon: vi.fn().mockResolvedValue(null),
    clearCache: vi.fn(),
}));

vi.mock('../../src/services/discovery/url-discovery.js', () => ({
    discoverFeedsFromUrl: discoverFeedsFromUrlMock,
}));

vi.mock('../../src/services/discovery/activity-check.js', () => ({
    checkFeedActivity: checkFeedActivityMock,
    checkYouTubeChannelActivity: vi.fn(),
    checkRedditActivity: checkRedditActivityMock,
}));

vi.mock('../../src/services/icon-service.js', () => ({
    default: iconServiceMock,
}));

import { discoverByKeyword } from '../../src/services/discovery.js';
import { buildDiscoverySearchQueries } from '../../src/services/discovery/query-utils.js';

describe('smart discovery search', () => {
    beforeEach(() => {
        discoverFeedsFromUrlMock.mockReset();
        checkFeedActivityMock.mockReset();
        checkRedditActivityMock.mockReset();
        iconServiceMock.getRedditIcon.mockReset();
        iconServiceMock.getYouTubeIcon.mockReset();

        checkFeedActivityMock.mockResolvedValue({
            isActive: true,
            lastPostDate: new Date('2026-03-28T00:00:00Z'),
        });
        checkRedditActivityMock.mockResolvedValue({
            isActive: true,
            lastPostDate: new Date('2026-03-28T00:00:00Z'),
        });

        delete process.env.YOUTUBE_API_KEY;
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('builds compact query variants for smart discovery', () => {
        expect(buildDiscoverySearchQueries('garland nixon')).toEqual(
            expect.arrayContaining(['garland nixon', 'garlandnixon', 'garland', 'garlandn'])
        );
    });

    it('finds RSS feeds through compacted query variants', async () => {
        const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
            const url = String(input);

            if (url.includes('duckduckgo') && url.includes('garlandnixon%20RSS%20feed')) {
                return {
                    ok: true,
                    status: 200,
                    text: async () => '<a class="result__a" href="https://example.com/garland">Garland</a>',
                } as Response;
            }

            if (url.includes('duckduckgo') || url.includes('bing') || url.includes('allorigins')) {
                return {
                    ok: false,
                    status: 404,
                    text: async () => '',
                    json: async () => ({}),
                } as Response;
            }

            return {
                ok: false,
                status: 404,
                text: async () => '',
                json: async () => ({}),
            } as Response;
        });

        vi.stubGlobal('fetch', fetchMock);

        discoverFeedsFromUrlMock.mockResolvedValue([
            {
                type: 'rss',
                title: 'Garland Feed',
                feed_url: 'https://example.com/feed.xml',
                site_url: 'https://example.com/garland',
                icon_url: null,
                confidence: 0.95,
                method: 'link_tag',
                isActive: true,
            },
        ]);

        const results = await discoverByKeyword('garland nixon', 1, 'rss');

        expect(results).toHaveLength(1);
        expect(results[0].feed_url).toBe('https://example.com/feed.xml');
        expect(discoverFeedsFromUrlMock).toHaveBeenCalledWith('https://example.com/garland');
    });

    it('finds podcasts through compacted query variants', async () => {
        const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
            const url = String(input);

            if (url.includes('itunes.apple.com') && url.includes('garlandnixon')) {
                return {
                    ok: true,
                    status: 200,
                    json: async () => ({
                        results: [
                            {
                                feedUrl: 'https://example.com/podcast.rss',
                                collectionName: 'Garland Nixon Show',
                                collectionViewUrl: 'https://example.com/podcast',
                                artworkUrl600: 'https://example.com/podcast.jpg',
                            },
                        ],
                    }),
                } as Response;
            }

            return {
                ok: false,
                status: 404,
                json: async () => ({ results: [] }),
                text: async () => '',
            } as Response;
        });

        vi.stubGlobal('fetch', fetchMock);

        const results = await discoverByKeyword('garland nixon', 1, 'podcast');

        expect(results).toHaveLength(1);
        expect(results[0].feed_url).toBe('https://example.com/podcast.rss');
        expect(fetchMock).toHaveBeenCalled();
    });

    it('finds Reddit subreddits through compacted query variants', async () => {
        const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
            const url = String(input);

            if (url.includes('reddit.com/subreddits/search.json') && url.includes('garlandnixon')) {
                return {
                    ok: true,
                    status: 200,
                    json: async () => ({
                        data: {
                            children: [
                                {
                                    data: {
                                        display_name: 'GarlandNixon',
                                        display_name_prefixed: 'r/GarlandNixon',
                                        url: '/r/GarlandNixon',
                                        community_icon: null,
                                        icon_img: null,
                                    },
                                },
                            ],
                        },
                    }),
                } as Response;
            }

            return {
                ok: false,
                status: 404,
                json: async () => ({ data: { children: [] } }),
                text: async () => '',
            } as Response;
        });

        vi.stubGlobal('fetch', fetchMock);

        const results = await discoverByKeyword('garland nixon', 1, 'reddit');

        expect(results).toHaveLength(1);
        expect(results[0].feed_url).toBe('https://www.reddit.com/r/GarlandNixon.rss');
        expect(iconServiceMock.getRedditIcon).toHaveBeenCalledWith('GarlandNixon');
    });

    it('ranks the most relevant match first across feed types', async () => {
        const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
            const url = String(input);

            if (url.includes('yewtu.be/api/v1/search') && url.includes('garlandn')) {
                return {
                    ok: true,
                    status: 200,
                    json: async () => ([{
                        author: 'Garland Nixon',
                        author_url: '/@garlandn',
                        author_thumbnail: 'https://example.com/youtube.jpg',
                    }]),
                } as Response;
            }

            if (url.includes('duckduckgo') && url.includes('garlandnixon%20RSS%20feed')) {
                return {
                    ok: true,
                    status: 200,
                    text: async () => '<a class="result__a" href="https://example.com/rss-site">RSS Site</a>',
                } as Response;
            }

            if (url.includes('itunes.apple.com') && url.includes('garlandnixon')) {
                return {
                    ok: true,
                    status: 200,
                    json: async () => ({
                        results: [
                            {
                                feedUrl: 'https://example.com/podcast.rss',
                                collectionName: 'Garland Nixon Show',
                                collectionViewUrl: 'https://example.com/podcast',
                                artworkUrl600: 'https://example.com/podcast.jpg',
                            },
                        ],
                    }),
                } as Response;
            }

            if (url.includes('reddit.com/subreddits/search.json') && url.includes('garlandnixon')) {
                return {
                    ok: true,
                    status: 200,
                    json: async () => ({
                        data: {
                            children: [
                                {
                                    data: {
                                        display_name: 'GarlandNixon',
                                        display_name_prefixed: 'r/GarlandNixon',
                                        url: '/r/GarlandNixon',
                                        community_icon: null,
                                        icon_img: null,
                                    },
                                },
                            ],
                        },
                    }),
                } as Response;
            }

            if (url.includes('duckduckgo') || url.includes('bing') || url.includes('allorigins')) {
                return {
                    ok: false,
                    status: 404,
                    text: async () => '',
                    json: async () => ({}),
                } as Response;
            }

            return {
                ok: false,
                status: 404,
                text: async () => '',
                json: async () => ({}),
            } as Response;
        });

        vi.stubGlobal('fetch', fetchMock);

        discoverFeedsFromUrlMock.mockImplementation(async (url: string) => {
            if (url.includes('@garlandn')) {
                return [
                    {
                        type: 'youtube',
                        title: 'Garland Nixon',
                        feed_url: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCGARLAND',
                        site_url: 'https://www.youtube.com/@garlandn',
                        icon_url: 'https://example.com/youtube.jpg',
                        confidence: 0.98,
                        method: 'youtube',
                        isActive: true,
                    },
                ];
            }

            if (url.includes('rss-site')) {
                return [
                    {
                        type: 'rss',
                        title: 'Garland Nixon News',
                        feed_url: 'https://example.com/rss.xml',
                        site_url: 'https://example.com/rss-site',
                        icon_url: null,
                        confidence: 0.8,
                        method: 'link_tag',
                        isActive: true,
                    },
                ];
            }

            return [];
        });

        const results = await discoverByKeyword('garland nixon', 4);

        expect(results[0].type).toBe('youtube');
        expect(results[0].title).toBe('Garland Nixon');
        expect(results.some((feed) => feed.type === 'rss')).toBe(true);
        expect(results.some((feed) => feed.type === 'reddit')).toBe(true);
        expect(results.some((feed) => feed.type === 'podcast')).toBe(true);
    });
});
