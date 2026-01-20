
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;

export async function fetchYouTubeIcon(channelId: string): Promise<string | null> {
    console.log(`[Debug] Fetching icon for ${channelId}`);
    
    // 1. Try API first if key is available
    if (YOUTUBE_API_KEY) {
        console.log('[Debug] Trying API...');
        try {
            const response = await fetch(
                `https://www.googleapis.com/youtube/v3/channels?part=snippet&id=${channelId}&key=${YOUTUBE_API_KEY}`
            );
            if (response.ok) {
                const data = await response.json();
                const icon = data.items?.[0]?.snippet?.thumbnails?.high?.url || data.items?.[0]?.snippet?.thumbnails?.default?.url || null;
                if (icon) { 
                    console.log('[Debug] Found via API');
                    return icon;
                }
            }
        } catch (e) {
            console.log('[Debug] API failed', e);
        }
    } else {
        console.log('[Debug] No API Key available');
    }

    // 2. Scrape the channel page
    console.log('[Debug] Scraping channel page...');
    try {
        const response = await fetch(`https://www.youtube.com/channel/${channelId}`, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept-Language': 'en-US,en;q=0.9',
            }
        });
        
        if (!response.ok) {
            console.log(`[Debug] Fetch failed: ${response.status}`);
            return null;
        }
        
        const html = await response.text();
        console.log(`[Debug] HTML length: ${html.length}`);

        // 3. Try parsing ytInitialData (most reliable)
        const jsonMatch = html.match(/var ytInitialData = (\{.*?\});/);
        if (jsonMatch) {
            console.log('[Debug] Found ytInitialData');
            try {
                const data = JSON.parse(jsonMatch[1]);

                // Path 1: C4 Tabbed Header (Standard Channel Layout)
                const c4Avatar = data.header?.c4TabbedHeaderRenderer?.avatar?.thumbnails;
                if (c4Avatar && c4Avatar.length > 0) {
                    console.log('[Debug] Found via C4 Header');
                    return c4Avatar[c4Avatar.length - 1].url;
                }

                // Path 2: Carousel Header
                const carouselAvatar = data.header?.carouselHeaderRenderer?.avatar?.thumbnails;
                if (carouselAvatar && carouselAvatar.length > 0) {
                    console.log('[Debug] Found via Carousel Header');
                    return carouselAvatar[carouselAvatar.length - 1].url;
                }
                

                // Path 3: Page Header Renderer (New Layout)
                const pageHeaderAvatar = data.header?.pageHeaderRenderer?.content?.pageHeaderViewModel?.image?.decoratedAvatarViewModel?.avatar?.avatarViewModel?.image?.sources;
                if (pageHeaderAvatar && pageHeaderAvatar.length > 0) {
                     console.log('[Debug] Found via Page Header Renderer');
                     return pageHeaderAvatar[pageHeaderAvatar.length - 1].url;
                }

                // Inspect structure if failed
                if (data.header?.pageHeaderRenderer) {
                    console.log('[Debug] pageHeaderRenderer found. Dumping structure...');
                    // console.log(JSON.stringify(data.header.pageHeaderRenderer, null, 2)); 
                }


            } catch (e) {
                console.log('[Debug] JSON Parse error', e);
            }
        } else {
            console.log('[Debug] ytInitialData NOT found');
        }

        // 4. Try regex patterns (Fallback)
        console.log('[Debug] Trying regex patterns...');
        const patterns = [
            /"avatar":\{"thumbnails":\[\{"url":"([^"]+)"/,
            /channelMetadataRenderer":\{"avatar":\{"thumbnails":\[\{"url":"([^"]+)"/,
            /["']avatar["']:\s*\{["']thumbnails["']:\s*\[\s*\{["']url["']:\s*["']([^"']+)["']/,
            /<meta property="og:image" content="([^"]+)">/,
            /<link rel="image_src" href="([^"]+)">/,
            /author-thumbnail":\{"thumbnails":\[\{"url":"([^"]+)"/
        ];

        for (const pattern of patterns) {
            const match = html.match(pattern);
            if (match && match[1]) {
                let icon = match[1];
                console.log(`[Debug] Found via regex: ${pattern}`);
                // Decode double backslashes if present
                icon = icon.replace(/\\u0026/g, '&').replace(/\\/g, '');
                
                // Normalize size for high res
                if (icon.includes('=s')) {
                    icon = icon.replace(/=s\d+[^"]*/, '=s176-c-k-c0x00ffffff-no-rj-mo');
                } else if (icon.includes('-s')) {
                    icon = icon.replace(/-s\d+[^"]*/, '-s176-c-k-c0x00ffffff-no-rj-mo');
                }
                return icon;
            }
        }
    } catch (e) {
        console.log('[Debug] Scrape error', e);
    }

    // 5. Last resort fallback
    return `https://www.google.com/s2/favicons?domain=youtube.com&sz=128`;
}

const CHANNEL_ID = 'UC_x5XG1OV2P6uZZ5FSM9Ttw'; // Google Developers

async function test() {
    console.log(`Fetching icon for channel: ${CHANNEL_ID}`);
    try {
        const icon = await fetchYouTubeIcon(CHANNEL_ID);
        console.log('Result:', icon);
    } catch (error) {
        console.error('Error:', error);
    }
}

test();
