import 'dotenv/config';

// Test YouTube icon fetching with the updated logic
async function fetchYouTubeIcon(channelId: string): Promise<string | null> {
    const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
    
    console.log(`\n🔍 Testing YouTube icon fetch for channel: ${channelId}`);
    console.log(`📋 API Key present: ${YOUTUBE_API_KEY ? 'YES (' + YOUTUBE_API_KEY.substring(0, 8) + '...)' : 'NO'}\n`);

    // 1. Try API first if key is available
    if (YOUTUBE_API_KEY) {
        try {
            console.log('🌐 Attempting API fetch...');
            const response = await fetch(
                `https://www.googleapis.com/youtube/v3/channels?part=snippet&id=${channelId}&key=${YOUTUBE_API_KEY}`
            );
            if (response.ok) {
                const data = await response.json();
                const icon = data.items?.[0]?.snippet?.thumbnails?.high?.url || data.items?.[0]?.snippet?.thumbnails?.default?.url || null;
                if (icon) {
                    console.log('✅ API fetch successful!');
                    console.log(`📸 Icon URL: ${icon}\n`);
                    return icon;
                }
            } else {
                console.log(`❌ API fetch failed: ${response.status} ${response.statusText}`);
            }
        } catch (e) {
            console.log(`❌ API fetch error: ${e}`);
        }
    } else {
        console.log('⚠️  No API key found, skipping API method');
    }

    // 2. Scrape the channel page
    try {
        console.log('🕷️  Attempting web scraping...');
        const response = await fetch(`https://www.youtube.com/channel/${channelId}`, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept-Language': 'en-US,en;q=0.9',
            }
        });
        if (!response.ok) {
            console.log(`❌ Scraping failed: ${response.status}`);
            return null;
        }
        const html = await response.text();

        // 3. Try parsing ytInitialData (most reliable)
        const jsonMatch = html.match(/var ytInitialData = (\{.*?\});/);
        if (jsonMatch) {
            try {
                const data = JSON.parse(jsonMatch[1]);

                // Path 1: C4 Tabbed Header (Standard Channel Layout)
                const c4Avatar = data.header?.c4TabbedHeaderRenderer?.avatar?.thumbnails;
                if (c4Avatar && c4Avatar.length > 0) {
                    const icon = c4Avatar[c4Avatar.length - 1].url;
                    console.log('✅ Found via c4TabbedHeaderRenderer');
                    console.log(`📸 Icon URL: ${icon}\n`);
                    return icon;
                }

                // Path 2: Carousel Header
                const carouselAvatar = data.header?.carouselHeaderRenderer?.avatar?.thumbnails;
                if (carouselAvatar && carouselAvatar.length > 0) {
                    const icon = carouselAvatar[carouselAvatar.length - 1].url;
                    console.log('✅ Found via carouselHeaderRenderer');
                    console.log(`📸 Icon URL: ${icon}\n`);
                    return icon;
                }

                // Path 3: Page Header Renderer (New Layout 2024/2025)
                const pageHeaderAvatar = data.header?.pageHeaderRenderer?.content?.pageHeaderViewModel?.image?.decoratedAvatarViewModel?.avatar?.avatarViewModel?.image?.sources;
                if (pageHeaderAvatar && pageHeaderAvatar.length > 0) {
                    const icon = pageHeaderAvatar[pageHeaderAvatar.length - 1].url;
                    console.log('✅ Found via pageHeaderRenderer');
                    console.log(`📸 Icon URL: ${icon}\n`);
                    return icon;
                }

                console.log('⚠️  ytInitialData found but no avatar in known paths');
            } catch (e) {
                console.log(`❌ JSON parse failed: ${e}`);
            }
        } else {
            console.log('⚠️  No ytInitialData found in HTML');
        }

        // 4. Try regex patterns (Fallback)
        console.log('🔍 Trying regex patterns...');
        const patterns = [
            { name: 'avatar thumbnails', regex: /"avatar":\{"thumbnails":\[\{"url":"([^"]+)"/ },
            { name: 'channelMetadataRenderer', regex: /"channelMetadataRenderer".*?"avatar".*?"url":"([^"]+)"/ },
            { name: 'yt-img-shadow', regex: /yt-img-shadow.*?src="(https:\/\/yt3\.googleusercontent\.com\/[^"]+)"/ },
            { name: 'og:image', regex: /<meta property="og:image" content="([^"]+)"/ }
        ];

        for (const { name, regex } of patterns) {
            const match = html.match(regex);
            if (match && match[1]) {
                let icon = match[1];
                // Decode double backslashes if present
                icon = icon.replace(/\\u0026/g, '&').replace(/\\/g, '');
                
                // Normalize size for high res
                if (icon.includes('=s')) {
                    icon = icon.replace(/=s\d+[^"]*/, '=s176-c-k-c0x00ffffff-no-rj-mo');
                } else if (icon.includes('-s')) {
                    icon = icon.replace(/-s\d+[^"]*/, '-s176-c-k-c0x00ffffff-no-rj-mo');
                }
                console.log(`✅ Found via regex pattern: ${name}`);
                console.log(`📸 Icon URL: ${icon}\n`);
                return icon;
            }
        }
        console.log('❌ No regex patterns matched');
    } catch (e) {
        console.log(`❌ Scraping error: ${e}`);
    }

    // 5. Last resort fallback
    const fallback = `https://www.google.com/s2/favicons?domain=youtube.com&sz=128`;
    console.log('⚠️  Using fallback generic YouTube icon');
    console.log(`📸 Fallback URL: ${fallback}\n`);
    return fallback;
}

// Test with a known YouTube channel
const testChannelId = 'UCBJycsmduvYEL83R_U4JriQ'; // Marques Brownlee (MKBHD)
console.log('🧪 YouTube Icon Fetch Test\n');
console.log('=' .repeat(60));

fetchYouTubeIcon(testChannelId)
    .then(icon => {
        console.log('=' .repeat(60));
        console.log(`\n✅ Final result: ${icon}\n`);
    })
    .catch(err => {
        console.error('❌ Test failed:', err);
    });
