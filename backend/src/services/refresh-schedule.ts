import { getUserSettingsRaw, updateUserSettingsRaw } from './settings.js';

export interface GlobalRefreshSchedule {
    lastRefreshAt: string | null;
    nextRefreshAt: string | null;
}

export function getGlobalRefreshSchedule(userId: number): GlobalRefreshSchedule {
    const raw = getUserSettingsRaw(userId);
    return {
        lastRefreshAt: raw.global_last_refresh_at || null,
        nextRefreshAt: raw.global_next_refresh_at || null,
    };
}

export function scheduleNextGlobalRefresh(userId: number, intervalMinutes: number, referenceTime = new Date()): GlobalRefreshSchedule {
    const nextRefreshAt = new Date(referenceTime.getTime() + intervalMinutes * 60 * 1000).toISOString();
    updateUserSettingsRaw(userId, {
        global_last_refresh_at: referenceTime.toISOString(),
        global_next_refresh_at: nextRefreshAt,
    });
    return {
        lastRefreshAt: referenceTime.toISOString(),
        nextRefreshAt,
    };
}

