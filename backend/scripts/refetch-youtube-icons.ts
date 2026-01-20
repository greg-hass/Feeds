/**
 * One-time script to re-fetch YouTube channel icons for all YouTube feeds.
 * Run this with: npx tsx scripts/refetch-youtube-icons.ts
 */
import 'dotenv/config';
import Database from 'better-sqlite3';
import { join } from 'path';
import { existsSync } from 'fs';

const DB_PATH = process.env.DB_PATH || join(process.cwd(), 'data', 'feeds.db');

interface Feed {
    id: number;
    url: string;
    title: string;
    icon_url: string | null;
    type: string;
}

// Same scraping logic as in feed-parser.ts
async function fetchYouTubeIcon(channelId: string): Promise<string | null> {
    // Validate channel ID format
    if (!channelId || !channelId.startsWith('UC') || channelId.length !== 24) {
        console.log(`  ⚠️  Invalid channel ID format: "${channelId}"`);
        return null;
    }
    
    console.log(`  🔍 Fetching icon for channel: ${channelId}`);
    
    try {
        const response = await fetch(`https://www.youtube.com/channel/${channelId}`, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept-Language': 'en-US,en;q=0.9',
            }
        });
        
        if (!response.ok) {
            console.log(`  ❌ Failed to fetch channel page: ${response.status}`);
            return null;
        }
        
        const html = await response.text();

        const avatarPatterns = [
            /"avatar":\{"thumbnails":\[\{"url":"([^"]+)"/,
            /"channelMetadataRenderer".*?"avatar".*?"url":"([^"]+)"/,
            /yt-img-shadow.*?src="(https:\/\/yt3\.googleusercontent\.com\/[^"]+)"/,
            /<meta property="og:image" content="([^"]+)"/
        ];

        for (const pattern of avatarPatterns) {
            const match = html.match(pattern);
            if (match && match[1]) {
                let avatarUrl = match[1];
                avatarUrl = avatarUrl.replace(/\\u0026/g, '&').replace(/\\/g, '');
                if (avatarUrl.includes('=s')) {
                    avatarUrl = avatarUrl.replace(/=s\d+.*/, '=s176-c-k-c0x00ffffff-no-rj-mo');
                }
                console.log(`  ✅ Found icon!`);
                return avatarUrl;
            }
        }
        
        console.log(`  ⚠️  No patterns matched`);
    } catch (e) {
        console.error(`  ❌ Error: ${e}`);
    }

    return null;
}

function extractChannelId(feedUrl: string): string | null {
    try {
        const urlObj = new URL(feedUrl);
        return urlObj.searchParams.get('channel_id');
    } catch {
        return null;
    }
}

async function main() {
    console.log('🔧 YouTube Icon Re-fetch Script\n');
    
    if (!existsSync(DB_PATH)) {
        console.error(`❌ Database not found at: ${DB_PATH}`);
        process.exit(1);
    }
    
    const db = new Database(DB_PATH);
    
    // Get all YouTube feeds
    const feeds = db.prepare(`
        SELECT id, url, title, icon_url, type 
        FROM feeds 
        WHERE type = 'youtube' OR url LIKE '%youtube.com/feeds%'
    `).all() as Feed[];
    
    console.log(`📋 Found ${feeds.length} YouTube feeds\n`);
    
    let updated = 0;
    let failed = 0;
    
    for (const feed of feeds) {
        console.log(`\n[${feed.id}] ${feed.title}`);
        console.log(`    URL: ${feed.url}`);
        console.log(`    Current icon: ${feed.icon_url || 'none'}`);
        
        const channelId = extractChannelId(feed.url);
        if (!channelId) {
            console.log(`    ⚠️  Could not extract channel ID from URL`);
            failed++;
            continue;
        }
        
        const newIcon = await fetchYouTubeIcon(channelId);
        if (newIcon) {
            db.prepare(`UPDATE feeds SET icon_url = ?, icon_cached_path = NULL, icon_cached_content_type = NULL WHERE id = ?`).run(newIcon, feed.id);
            console.log(`    📸 Updated icon to: ${newIcon.substring(0, 60)}...`);
            updated++;
        } else {
            failed++;
        }
        
        // Rate limit to avoid being blocked
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    console.log(`\n${'='.repeat(60)}`);
    console.log(`✅ Updated: ${updated} feeds`);
    console.log(`❌ Failed: ${failed} feeds`);
    console.log(`${'='.repeat(60)}\n`);
    
    db.close();
}

main().catch(console.error);
