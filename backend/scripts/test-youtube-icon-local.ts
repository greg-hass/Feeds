import 'dotenv/config';

// Test YouTube icon fetching with the simplified approach
async function fetchYouTubeIcon(channelId: string): Promise<string | null> {
    console.log(`\n🔍 Testing YouTube icon fetch for channel: ${channelId}\n`);

    // Scrape the channel page (proven working approach)
    try {
        const response = await fetch(`https://www.youtube.com/channel/${channelId}`, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept-Language': 'en-US,en;q=0.9',
            }
        });
        
        if (!response.ok) {
            console.log(`❌ Failed to fetch channel page: ${response.status}`);
            return null;
        }
        
        const html = await response.text();
        console.log(`📄 Fetched HTML (${html.length} bytes)`);

        // Try 4 regex patterns in order (proven working)
        const avatarPatterns = [
            { name: 'JSON data', pattern: /"avatar":\{"thumbnails":\[\{"url":"([^"]+)"/ },
            { name: 'Extended metadata', pattern: /"channelMetadataRenderer".*?"avatar".*?"url":"([^"]+)"/ },
            { name: 'HTML img tag', pattern: /yt-img-shadow.*?src="(https:\/\/yt3\.googleusercontent\.com\/[^"]+)"/ },
            { name: 'OpenGraph fallback', pattern: /<meta property="og:image" content="([^"]+)"/ }
        ];

        for (const { name, pattern } of avatarPatterns) {
            const match = html.match(pattern);
            if (match && match[1]) {
                let avatarUrl = match[1];
                
                // Decode escaped characters
                avatarUrl = avatarUrl.replace(/\\u0026/g, '&').replace(/\\/g, '');
                
                // Force high-res avatar (s176 is standard)
                if (avatarUrl.includes('=s')) {
                    avatarUrl = avatarUrl.replace(/=s\d+.*/, '=s176-c-k-c0x00ffffff-no-rj-mo');
                }
                
                console.log(`✅ Found via: ${name}`);
                console.log(`📸 Icon URL: ${avatarUrl}\n`);
                return avatarUrl;
            }
        }
        
        console.log('❌ No patterns matched');
    } catch (e) {
        console.error(`❌ Error fetching: ${e}`);
    }

    // Fallback - return null so the frontend can show default icon
    return null;
}

// Test with a known YouTube channel
const testChannelId = 'UCBJycsmduvYEL83R_U4JriQ'; // Marques Brownlee (MKBHD)
console.log('🧪 YouTube Icon Fetch Test (Simplified Scraping)\n');
console.log('=' .repeat(60));

fetchYouTubeIcon(testChannelId)
    .then(icon => {
        console.log('=' .repeat(60));
        console.log(`\n✅ Final result: ${icon ? 'SUCCESS' : 'FAILED'}`);
        if (icon) console.log(`📸 ${icon}\n`);
    })
    .catch(err => {
        console.error('❌ Test failed:', err);
    });
