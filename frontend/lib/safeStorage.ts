import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_TIMEOUT_MS = 750;
const memoryStorage = new Map<string, string>();

async function withTimeout<T>(promise: Promise<T>, fallback: T): Promise<T> {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    try {
        return await Promise.race([
            promise,
            new Promise<T>((resolve) => {
                timeoutId = setTimeout(() => resolve(fallback), STORAGE_TIMEOUT_MS);
            }),
        ]);
    } finally {
        if (timeoutId) {
            clearTimeout(timeoutId);
        }
    }
}

export const safeAsyncStorage = {
    async getItem(key: string): Promise<string | null> {
        try {
            const value = await withTimeout(AsyncStorage.getItem(key), null);
            if (value !== null) {
                memoryStorage.set(key, value);
                return value;
            }
        } catch {
            // Fall back to memory storage when platform storage is unavailable.
        }

        return memoryStorage.get(key) ?? null;
    },

    async setItem(key: string, value: string): Promise<void> {
        memoryStorage.set(key, value);

        try {
            await withTimeout(AsyncStorage.setItem(key, value), undefined);
        } catch {
            // Keep the in-memory copy so the session can continue.
        }
    },

    async removeItem(key: string): Promise<void> {
        memoryStorage.delete(key);

        try {
            await withTimeout(AsyncStorage.removeItem(key), undefined);
        } catch {
            // Ignore cleanup failures for unavailable storage.
        }
    },
};
