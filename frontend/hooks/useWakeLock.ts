import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

type WakeLockSentinelLike = {
    release: () => Promise<void>;
    released?: boolean;
};

type NavigatorWithWakeLock = Navigator & {
    wakeLock?: {
        request: (type: 'screen') => Promise<WakeLockSentinelLike>;
    };
};

export function useWakeLock(enabled: boolean) {
    const wakeLockRef = useRef<WakeLockSentinelLike | null>(null);

    useEffect(() => {
        if (Platform.OS !== 'web' || typeof document === 'undefined' || typeof navigator === 'undefined') {
            return;
        }

        const navigatorWithWakeLock = navigator as NavigatorWithWakeLock;
        if (!navigatorWithWakeLock.wakeLock?.request) {
            return;
        }

        let cancelled = false;

        const releaseWakeLock = async () => {
            const sentinel = wakeLockRef.current;
            wakeLockRef.current = null;

            if (!sentinel || sentinel.released) {
                return;
            }

            try {
                await sentinel.release();
            } catch {
                // Ignore release failures from browsers that auto-release on visibility changes.
            }
        };

        const requestWakeLock = async () => {
            if (!enabled || document.visibilityState !== 'visible' || cancelled) {
                return;
            }

            if (wakeLockRef.current && !wakeLockRef.current.released) {
                return;
            }

            try {
                wakeLockRef.current = await navigatorWithWakeLock.wakeLock.request('screen');
            } catch {
                wakeLockRef.current = null;
            }
        };

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                void requestWakeLock();
            } else {
                void releaseWakeLock();
            }
        };

        if (enabled) {
            void requestWakeLock();
        } else {
            void releaseWakeLock();
        }

        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            cancelled = true;
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            void releaseWakeLock();
        };
    }, [enabled]);
}
