import { Platform, InteractionManager } from 'react-native';

export const scheduleIdle = (callback: () => void) => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
        const requestIdle = (window as any).requestIdleCallback;
        if (typeof requestIdle === 'function') {
            requestIdle(callback, { timeout: 1500 });
            return;
        }
    }
    InteractionManager.runAfterInteractions(callback);
};

export const canPrefetch = async (): Promise<boolean> => {
    if (Platform.OS !== 'web' || typeof navigator === 'undefined') return true;
    
    // Check connection type
    const connection = (navigator as any).connection;
    if (connection?.saveData) return false;
    const effectiveType = connection?.effectiveType;
    if (effectiveType && ['slow-2g', '2g'].includes(effectiveType)) return false;

    // Check battery status
    if (typeof (navigator as any).getBattery === 'function') {
        try {
            const battery = await (navigator as any).getBattery();
            if (battery && !battery.charging) return false;
        } catch {
            // Ignore battery API errors and allow prefetch
        }
    }

    return true;
};
