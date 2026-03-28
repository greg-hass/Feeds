import { queryAll, queryOne, run } from '../db/index.js';
import { existsSync } from 'node:fs';
import { readdir, stat, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { getCacheDir } from './image-cache.js';
import { generateDailyDigest, canGenerateDailyDigest, DigestEdition } from './digest.js';
import { getDailyDigestAiProviderName } from './ai.js';
import { getUserSettings } from './settings.js';

const THUMBNAIL_RETENTION_DAYS = 7;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const CLEANUP_BATCH_SIZE = 1000;
const CLEANUP_EMERGENCY_SIZE_BYTES = 10 * 1024 * 1024 * 1024;

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

function getDatabaseSize(): number {
    try {
        const result = queryOne<{ size_bytes: number }>(
            'SELECT page_count * page_size as size_bytes FROM pragma_page_count(), pragma_page_size()'
        );
        return result?.size_bytes || 0;
    } catch (err) {
        console.error('[Cleanup] Failed to get database size:', err);
        return 0;
    }
}

function formatBytes(bytes: number): string {
    if (bytes <= 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const order = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    const value = bytes / Math.pow(1024, order);
    return `${value.toFixed(order === 0 ? 0 : 1)} ${units[order]}`;
}

async function cleanupThumbnailCache(retentionDays: number) {
    const thumbnailsDir = getCacheDir('thumbnails');
    if (!existsSync(thumbnailsDir)) {
        return { deletedCount: 0, reclaimedBytes: 0, scanned: 0 };
    }

    const cutoff = Date.now() - retentionDays * MS_PER_DAY;
    let deletedCount = 0;
    let reclaimedBytes = 0;
    let scanned = 0;
    let skippedActive = 0;

    try {
        const activeThumbnails = new Set(
            queryAll<{ thumbnail_cached_path: string }>(
                `SELECT DISTINCT thumbnail_cached_path FROM articles
                 WHERE thumbnail_cached_path IS NOT NULL`
            ).map(a => a.thumbnail_cached_path.split('/').pop())
        );

        const entries = await readdir(thumbnailsDir, { withFileTypes: true });
        for (const entry of entries) {
            if (!entry.isFile()) continue;
            scanned += 1;
            const filePath = join(thumbnailsDir, entry.name);
            try {
                const fileStat = await stat(filePath);
                if (activeThumbnails.has(entry.name)) {
                    skippedActive++;
                    continue;
                }
                if (fileStat.mtimeMs <= cutoff) {
                    await unlink(filePath);
                    deletedCount += 1;
                    reclaimedBytes += fileStat.size;
                }
            } catch (err) {
                console.warn(`[Cleanup] Failed to delete thumbnail ${entry.name}:`, err);
            }
        }

        if (skippedActive > 0) {
            console.log(`[Cleanup] Skipped ${skippedActive} active thumbnails`);
        }
    } catch (err) {
        console.warn('[Cleanup] Failed to scan thumbnail cache:', err);
    }

    return { deletedCount, reclaimedBytes, scanned };
}

export async function runMaintenanceCleanup(userId: number) {
    const settings = getUserSettings(userId);
    const dbSize = getDatabaseSize();
    const isEmergencyCleanup = dbSize > CLEANUP_EMERGENCY_SIZE_BYTES;

    if (isEmergencyCleanup) {
        console.error(`[Cleanup] EMERGENCY: Database size ${formatBytes(dbSize)} exceeds 10GB limit! Using aggressive retention (7 days for all feeds).`);
    }

    const parsedSettings = settings.feed_retention || {};
    const feedRetention = isEmergencyCleanup ? {
        rss: 7,
        youtube: 7,
        reddit: 7,
        podcast: 7,
    } : {
        rss: parsedSettings.rss_days ?? 30,
        youtube: parsedSettings.youtube_days ?? 14,
        reddit: parsedSettings.reddit_days ?? 7,
        podcast: parsedSettings.podcast_days ?? 90,
    };

    let totalDeleted = 0;
    let batchCount = 0;

    for (const [feedType, retentionDays] of Object.entries(feedRetention)) {
        let batchDeleted = 0;
        let typeDeleted = 0;

        console.log(`[Cleanup] Cleaning ${feedType} feeds (retention: ${retentionDays} days)`);

        do {
            const articlesToDelete = queryAll<{ id: number }>(
                `SELECT a.id FROM articles a
                 JOIN feeds f ON a.feed_id = f.id
                 WHERE f.user_id = ?
                 AND f.type = ?
                 AND a.published_at < datetime('now', '-' || ? || ' days')
                 AND (a.is_bookmarked = 0 OR a.is_bookmarked IS NULL)
                 LIMIT ?`,
                [userId, feedType, retentionDays, CLEANUP_BATCH_SIZE]
            );

            if (articlesToDelete.length === 0) break;

            const ids = articlesToDelete.map(a => a.id);
            const placeholders = ids.map(() => '?').join(',');

            const result = run(
                `DELETE FROM articles WHERE id IN (${placeholders})`,
                ids
            );

            batchDeleted = result.changes;
            typeDeleted += batchDeleted;
            totalDeleted += batchDeleted;
            batchCount++;

            if (batchDeleted === CLEANUP_BATCH_SIZE) {
                await sleep(100);
            }
        } while (batchDeleted === CLEANUP_BATCH_SIZE);

        if (typeDeleted > 0) {
            console.log(`[Cleanup] Deleted ${typeDeleted} old ${feedType} articles (older than ${retentionDays} days)`);
        }
    }

    if (totalDeleted > 0) {
        console.log(`[Cleanup] Total: Deleted ${totalDeleted} old articles in ${batchCount} batches`);
        if (totalDeleted > 10000) {
            console.log('[Cleanup] Running ANALYZE after large deletion...');
            run('ANALYZE articles');
        }

        const newDbSize = getDatabaseSize();
        const reclaimed = dbSize - newDbSize;
        console.log(`[Cleanup] Database size: ${formatBytes(dbSize)} → ${formatBytes(newDbSize)}${reclaimed > 0 ? ` (reclaimed ${formatBytes(reclaimed)})` : ''}`);
    } else {
        console.log(`[Cleanup] No articles to clean up`);
    }

    const thumbnailResult = await cleanupThumbnailCache(THUMBNAIL_RETENTION_DAYS);
    if (thumbnailResult.deletedCount > 0) {
        console.log(`[Cleanup] Deleted ${thumbnailResult.deletedCount} cached thumbnails (${formatBytes(thumbnailResult.reclaimedBytes)})`);
    } else if (thumbnailResult.scanned > 0) {
        console.log('[Cleanup] No cached thumbnails to delete');
    }
}

export async function runDigestMaintenance(userId: number, lastDigestSkipKey: string | null) {
    const settings = queryOne<{
        enabled: number;
        schedule_morning: string | null;
        schedule_evening: string | null;
    }>('SELECT enabled, schedule_morning, schedule_evening FROM digest_settings WHERE user_id = ?', [userId]);

    if (!settings || !settings.enabled) {
        return { lastDigestSkipKey };
    }

    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentMinutes = currentHour * 60 + currentMinute;
    const currentTimeStr = `${currentHour.toString().padStart(2, '0')}:${currentMinute.toString().padStart(2, '0')}`;

    const morningTime = settings.schedule_morning || '08:00';
    const eveningTime = settings.schedule_evening || '20:00';

    const parseScheduleMinutes = (scheduleTime: string): number | null => {
        const [schedHour, schedMin] = scheduleTime.split(':').map(Number);
        if (Number.isNaN(schedHour) || Number.isNaN(schedMin)) return null;
        return schedHour * 60 + schedMin;
    };

    const morningMinutes = parseScheduleMinutes(morningTime);
    const eveningMinutes = parseScheduleMinutes(eveningTime);

    const shouldRunMorning =
        morningMinutes !== null &&
        currentMinutes >= morningMinutes &&
        (eveningMinutes === null || currentMinutes < eveningMinutes);

    const shouldRunEvening =
        eveningMinutes !== null &&
        currentMinutes >= eveningMinutes;

    const tryGenerate = async (edition: DigestEdition) => {
        const today = new Date().toISOString().split('T')[0];
        const existingDigest = queryOne<{ id: number }>(
            `SELECT id FROM digests 
             WHERE user_id = ? AND edition = ? AND date(generated_at) = ?`,
            [userId, edition, today]
        );
        if (existingDigest) {
            return lastDigestSkipKey;
        }

        if (!canGenerateDailyDigest()) {
            const skipKey = `${today}:${edition}:missing-ai-key`;
            if (lastDigestSkipKey !== skipKey) {
                const provider = getDailyDigestAiProviderName().toUpperCase();
                console.warn(`[Digest] Skipping scheduled ${edition} digest: ${provider}_API_KEY is not configured`);
            }
            return skipKey;
        }

        console.log(`[Digest] Scheduled ${edition} digest generation at ${currentTimeStr}`);
        const result = await generateDailyDigest(userId, edition);

        if (result.success) {
            console.log(`[Digest] ${edition} digest generated successfully (ID: ${result.digestId})`);
        } else if (result.error !== 'No new articles to summarize') {
            console.error(`[Digest] Failed to generate ${edition} digest: ${result.error}`);
        }

        return null;
    };

    if (shouldRunMorning) {
        lastDigestSkipKey = await tryGenerate('morning');
    } else if (shouldRunEvening) {
        lastDigestSkipKey = await tryGenerate('evening');
    }

    return { lastDigestSkipKey };
}
