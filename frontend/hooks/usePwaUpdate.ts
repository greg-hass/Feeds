import { useEffect, useRef, useState } from 'react';

export function usePwaUpdate(enabled: boolean) {
    const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);
    const [updateAvailable, setUpdateAvailable] = useState(false);
    const reloadTimeoutRef = useRef<number | null>(null);

    useEffect(() => {
        if (!enabled || typeof window === 'undefined' || !('serviceWorker' in navigator)) {
            return;
        }

        let mounted = true;

        const attachWaitingWorker = (worker: ServiceWorker | null) => {
            if (!mounted || !worker) return;
            setWaitingWorker(worker);
            setUpdateAvailable(true);
        };

        const syncWaitingWorker = (registration: ServiceWorkerRegistration | null) => {
            if (!registration) return;
            if (registration.waiting) {
                attachWaitingWorker(registration.waiting);
            }
        };

        const syncLatestRegistration = async () => {
            const registration = await navigator.serviceWorker.getRegistration();
            syncWaitingWorker(registration || null);
            return registration || null;
        };

        const waitForRegistration = async () => {
            const existingRegistration = await syncLatestRegistration();
            if (existingRegistration) {
                return existingRegistration;
            }

            try {
                const readyRegistration = await Promise.race([
                    navigator.serviceWorker.ready,
                    new Promise<null>((resolve) => window.setTimeout(() => resolve(null), 10000)),
                ]);
                syncWaitingWorker(readyRegistration);
                return readyRegistration;
            } catch {
                return null;
            }
        };

        const watchInstallingWorker = (registration: ServiceWorkerRegistration) => {
            const installingWorker = registration.installing;
            if (!installingWorker) return;

            installingWorker.addEventListener('statechange', () => {
                if (
                    installingWorker.state === 'installed' &&
                    navigator.serviceWorker.controller
                ) {
                    attachWaitingWorker(registration.waiting || installingWorker);
                }
            });
        };

        const initialize = async () => {
            const registration = await waitForRegistration();
            if (!registration) return;

            registration.addEventListener('updatefound', () => {
                watchInstallingWorker(registration);
            });

            watchInstallingWorker(registration);

            const intervalId = window.setInterval(() => {
                void registration
                    .update()
                    .then(() => {
                        return syncLatestRegistration();
                    })
                    .catch(() => {});
            }, 5 * 60 * 1000);

            const waitingCheckId = window.setInterval(() => {
                void syncLatestRegistration();
            }, 5000);

            return () => {
                window.clearInterval(intervalId);
                window.clearInterval(waitingCheckId);
            };
        };

        let cleanupInterval: (() => void) | undefined;
        void initialize().then((cleanup) => {
            cleanupInterval = cleanup;
        });

        const checkForWaitingUpdate = () => {
            void syncLatestRegistration();
        };

        window.addEventListener('focus', checkForWaitingUpdate);
        document.addEventListener('visibilitychange', checkForWaitingUpdate);

        return () => {
            mounted = false;
            cleanupInterval?.();
            if (reloadTimeoutRef.current !== null) {
                window.clearTimeout(reloadTimeoutRef.current);
                reloadTimeoutRef.current = null;
            }
            window.removeEventListener('focus', checkForWaitingUpdate);
            document.removeEventListener('visibilitychange', checkForWaitingUpdate);
        };
    }, [enabled]);

    const applyUpdate = () => {
        if (!waitingWorker) return;
        setUpdateAvailable(false);
        setWaitingWorker(null);
        waitingWorker.postMessage({ type: 'SKIP_WAITING' });
        reloadTimeoutRef.current = window.setTimeout(() => {
            window.location.replace(window.location.href);
        }, 300);
    };

    const dismissUpdate = () => {
        setUpdateAvailable(false);
    };

    return {
        updateAvailable,
        applyUpdate,
        dismissUpdate,
    };
}
