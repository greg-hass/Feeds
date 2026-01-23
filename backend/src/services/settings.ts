import { queryOne, run } from '../db/index.js';

interface UserSettings {
    settings_json?: string;
}

const defaultSettings = {
    refresh_interval_minutes: 15,
    retention_days: 90,
    fetch_full_content: true,
    readability_enabled: true,
    theme: 'auto' as const,
    font_size: 'medium' as const,
    show_images: true,
};

export type Settings = typeof defaultSettings;

export function getUserSettingsRaw(userId: number): Record<string, any> {
    try {
        const user = queryOne<UserSettings>('SELECT settings_json FROM users WHERE id = ?', [userId]);
        if (!user?.settings_json) return {};
        return JSON.parse(user.settings_json);
    } catch {
        return {};
    }
}

export function getUserSettings(userId: number): Settings {
    try {
        const user = queryOne<UserSettings>('SELECT settings_json FROM users WHERE id = ?', [userId]);
        if (!user?.settings_json) return { ...defaultSettings };
        return { ...defaultSettings, ...JSON.parse(user.settings_json) };
    } catch {
        return { ...defaultSettings };
    }
}

export function updateUserSettingsRaw(userId: number, updates: Record<string, unknown>): Record<string, any> {
    const current = getUserSettingsRaw(userId);
    const next = { ...current, ...updates };
    run('UPDATE users SET settings_json = ? WHERE id = ?', [JSON.stringify(next), userId]);
    return next;
}
