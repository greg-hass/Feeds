import { startTransition, useCallback, useEffect, useState } from 'react';
import { api } from '@/services/api';

export type AuthBootstrapState =
    | 'checking'
    | 'authenticated'
    | 'unauthenticated';

interface UseAuthBootstrapResult {
    authState: AuthBootstrapState;
    isAuthenticated: boolean | null;
    needsSetup: boolean;
    sessionExpired: boolean;
    completeLogin: () => void;
    logout: () => Promise<void>;
    refreshAuth: () => Promise<void>;
}

export function useAuthBootstrap(enabled = true): UseAuthBootstrapResult {
    const [authState, setAuthState] = useState<AuthBootstrapState>('checking');
    const [needsSetup, setNeedsSetup] = useState(false);
    const [sessionExpired, setSessionExpired] = useState(false);
    const transitionAuthState = useCallback((nextState: AuthBootstrapState) => {
        startTransition(() => {
            setAuthState(nextState);
        });
    }, []);

    const refreshAuth = useCallback(async () => {
        transitionAuthState('checking');

        try {
            await api.init();

            const status = await api.getAuthStatus();
            if (!status.authEnabled) {
                setNeedsSetup(false);
                setSessionExpired(false);
                transitionAuthState('authenticated');
                return;
            }

            setNeedsSetup(status.needsSetup);

            if (!api.hasAuthToken()) {
                setSessionExpired(false);
                transitionAuthState('unauthenticated');
                return;
            }

            // Do not block initial render on a network request. If the token exists,
            // let the app render and validate the session in the background.
            setSessionExpired(false);
            transitionAuthState('authenticated');

            void api.getFeeds().catch(async (error: any) => {
                if (error?.code === 'SESSION_EXPIRED') {
                    setSessionExpired(true);
                    await api.logout();
                    transitionAuthState('unauthenticated');
                }
            });
        } catch (error) {
            console.error('Auth bootstrap failed:', error);
            transitionAuthState('unauthenticated');
        }
    }, [transitionAuthState]);

    useEffect(() => {
        if (!enabled) {
            return;
        }
        const timeoutId = setTimeout(() => {
            void refreshAuth();
        }, 0);

        return () => clearTimeout(timeoutId);
    }, [enabled, refreshAuth]);

    const completeLogin = useCallback(() => {
        setSessionExpired(false);
        transitionAuthState('authenticated');
    }, [transitionAuthState]);

    const logout = useCallback(async () => {
        await api.logout();
        setSessionExpired(false);
        transitionAuthState('unauthenticated');
    }, [transitionAuthState]);

    return {
        authState,
        isAuthenticated: authState === 'checking' ? null : authState === 'authenticated',
        needsSetup,
        sessionExpired,
        completeLogin,
        logout,
        refreshAuth,
    };
}
