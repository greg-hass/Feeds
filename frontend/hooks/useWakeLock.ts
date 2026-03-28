import { useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';

const KEEP_AWAKE_TAG = 'FeedsAppWakeLock';

export function useWakeLock(enabled: boolean) {
    const isHeldRef = useRef(false);

    useEffect(() => {
        let cancelled = false;

        const releaseWakeLock = async () => {
            if (!isHeldRef.current) {
                return;
            }

            try {
                isHeldRef.current = false;
                await deactivateKeepAwake(KEEP_AWAKE_TAG);
            } catch {
                // Ignore release failures when the platform has already released the lock.
            }
        };

        const requestWakeLock = async () => {
            if (!enabled || cancelled || isHeldRef.current) {
                return;
            }

            try {
                await activateKeepAwakeAsync(KEEP_AWAKE_TAG);
                isHeldRef.current = true;
            } catch {
                isHeldRef.current = false;
            }
        };

        const handleAppStateChange = (nextAppState: string) => {
            if (nextAppState === 'active') {
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

        const appStateSubscription = Platform.OS === 'web'
            ? null
            : AppState.addEventListener('change', handleAppStateChange);

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                void requestWakeLock();
            } else {
                void releaseWakeLock();
            }
        };

        if (Platform.OS === 'web' && typeof document !== 'undefined') {
            document.addEventListener('visibilitychange', handleVisibilityChange);
        }

        return () => {
            cancelled = true;
            if (Platform.OS === 'web' && typeof document !== 'undefined') {
                document.removeEventListener('visibilitychange', handleVisibilityChange);
            } else {
                appStateSubscription?.remove();
            }
            void releaseWakeLock();
        };
    }, [enabled]);
}
