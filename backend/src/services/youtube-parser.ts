import { HTTP } from '../config/constants.js';
import { fetchWithRetry } from './http.js';

const YOUTUBE_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;

export async function fetchYouTubeIcon(channelId: string | null | undefined): Promise<string | null> {
    if (!channelId || typeof channelId !== 'string') {
        console.log(`[YouTube Icon] Invalid channel ID: "${channelId}"`);
        return null;
    }
    
    // Support both traditional UC... channel IDs and newer handle-based IDs
    const isTraditionalChannelId = channelId.startsWith('UC') && channelId.length === 24;
    const isHandle = channelId.startsWith('@');
    
    if (!isTraditionalChannelId && !isHandle) {
        console.log(`[YouTube Icon] Unrecognized channel ID format: "${channelId}"`);
        return null;
    }
    
    console.log(`[YouTube Icon] Fetching icon for channel: ${channelId}`);
    
    // Determine the correct URL path based on ID type
    const channelUrl = isHandle 
        ? `https://www.youtube.com/${channelId}`
        : `https://www.youtube.com/channel/${channelId}`;
    
    try {
        console.log(`[YouTube Icon] Making request to YouTube: ${channelUrl}`);
        const response = await fetchWithRetry(channelUrl, () => ({
            headers: {
                'User-Agent': YOUTUBE_USER_AGENT,
                'Accept-Language': 'en-US,en;q=0.9',
            },
            signal: AbortSignal.timeout(HTTP.REQUEST_TIMEOUT),
        }), {
            retries: 2,
        });
        
        console.log(`[YouTube Icon] Response status: ${response.status}`);
        
        if (!response.ok) {
            console.log(`[YouTube Icon] Failed to fetch channel page: ${response.status}`);
            return null;
        }
        
        const html = await response.text();
        console.log(`[YouTube Icon] Got HTML (${html.length} chars), searching for avatar...`);

        const avatarPatterns = [
            // ytInitialData JSON patterns (most reliable for modern YouTube)
            { name: 'ytInitialData avatar', regex: /"avatar":\s*\{\s*"thumbnails":\s*\[\s*\{\s*"url":\s*"([^"]+)"/ },
            { name: 'ytInitialData v2', regex: /"avatar":\{"thumbnails":\[\{"url":"([^"]+)"/ },
            { name: 'channelHeader avatar', regex: /"channelHeaderAvatarViewModel"[^}]*"image"[^}]*"sources"[^}]*"url":\s*"([^"]+)"/ },
            // Metadata patterns
            { name: 'Metadata v2', regex: /"channelMetadataRenderer"\s*:\s*\{[^}]*"avatar":\s*\{"thumbnails":\s*\[\{"url":\s*"([^"]+)"/ },
            { name: 'Metadata', regex: /"channelMetadataRenderer".*?"avatar".*?"url":"([^"]+)"/ },
            // Direct image URL patterns
            { name: 'yt3 googleusercontent', regex: /https:\/\/yt3\.googleusercontent\.com\/[^"\s]+/ },
            { name: 'yt3 ggph', regex: /https:\/\/yt3\.ggpht\.com\/[^"\s]+/ },
            { name: 'yt-img-shadow', regex: /yt-img-shadow[^>]*src="(https:\/\/yt3\.[^"]+)"/ },
            // HTML patterns
            { name: 'og:image', regex: /<meta[^>]+property="og:image"[^>]+content="([^"]+)"/ },
            { name: 'twitter:image', regex: /<meta[^>]+name="twitter:image"[^>]+content="([^"]+)"/ },
            // Legacy patterns
            { name: 'channel-icon img', regex: /<img[^>]+class="yt-channel-icon"[^>]+src="([^"]+)"/ },
        ];

        for (const pattern of avatarPatterns) {
            const match = html.match(pattern.regex);
            if (match && match[1]) {
                let avatarUrl = match[1];
                
                avatarUrl = avatarUrl.replace(/\\u0026/g, '&').replace(/\\/g, '');
                
                if (avatarUrl.includes('=s')) {
                    avatarUrl = avatarUrl.replace(/=s\d+.*/, '=s176-c-k-c0x00ffffff-no-rj-mo');
                }
                
                console.log(`[YouTube Icon] ✓ Found icon using "${pattern.name}": ${avatarUrl.substring(0, 50)}...`);
                return avatarUrl;
            }
        }
        
        console.log(`[YouTube Icon] No patterns matched for ${channelId}`);
    } catch (e) {
        console.error(`[YouTube Icon] Error fetching: ${e}`);
    }

    // Fallback: Try YouTube Data API if available
    if (YOUTUBE_API_KEY && isTraditionalChannelId) {
        try {
            console.log(`[YouTube Icon] Trying YouTube Data API for ${channelId}`);
            const apiUrl = `https://www.googleapis.com/youtube/v3/channels?part=snippet&id=${channelId}&key=${YOUTUBE_API_KEY}`;
            const response = await fetch(apiUrl);
            if (response.ok) {
                const data = await response.json();
                const thumbnail = data.items?.[0]?.snippet?.thumbnails?.default?.url;
                if (thumbnail) {
                    console.log(`[YouTube Icon] ✓ Found icon via API: ${thumbnail.substring(0, 50)}...`);
                    return thumbnail;
                }
            }
        } catch (apiErr) {
            console.error(`[YouTube Icon] API fallback failed: ${apiErr}`);
        }
    }

    return null;
}

export function extractYouTubeChannelId(extendedMeta: any): string | null {
    const channelId = (extendedMeta as any)['yt:channelid'] || (extendedMeta as any)['yt:channelId'];
    if (!channelId) return null;
    
    if (typeof channelId === 'object' && channelId && typeof channelId['#'] === 'string') {
        return channelId['#'];
    }
    
    if (typeof channelId === 'string') {
        return channelId;
    }
    
    return null;
}

export const YOUTUBE_FETCH_USER_AGENT = YOUTUBE_USER_AGENT;
