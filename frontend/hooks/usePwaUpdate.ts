import { useEffect, useState } from 'react';

export function usePwaUpdate(enabled: boolean) {
    const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);
    const [updateAvailable, setUpdateAvailable] = useState(false);

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
            const registration = await navigator.serviceWorker.getRegistration();
            if (!registration) return;

            if (registration.waiting) {
                attachWaitingWorker(registration.waiting);
            }

            registration.addEventListener('updatefound', () => {
                watchInstallingWorker(registration);
            });

            watchInstallingWorker(registration);

            const intervalId = window.setInterval(() => {
                void registration.update().catch(() => {});
            }, 5 * 60 * 1000);

            return () => window.clearInterval(intervalId);
        };

        let cleanupInterval: (() => void) | undefined;
        void initialize().then((cleanup) => {
            cleanupInterval = cleanup;
        });

        const handleControllerChange = () => {
            window.location.reload();
        };

        navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);

        return () => {
            mounted = false;
            cleanupInterval?.();
            navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
        };
    }, [enabled]);

    const applyUpdate = () => {
        if (!waitingWorker) return;
        waitingWorker.postMessage({ type: 'SKIP_WAITING' });
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
