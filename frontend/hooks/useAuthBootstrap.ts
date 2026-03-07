import { useCallback, useEffect, useState } from 'react';
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

export function useAuthBootstrap(): UseAuthBootstrapResult {
    const [authState, setAuthState] = useState<AuthBootstrapState>('checking');
    const [needsSetup, setNeedsSetup] = useState(false);
    const [sessionExpired, setSessionExpired] = useState(false);

    const refreshAuth = useCallback(async () => {
        setAuthState('checking');

        try {
            await api.init();

            const status = await api.getAuthStatus();
            if (!status.authEnabled) {
                setNeedsSetup(false);
                setSessionExpired(false);
                setAuthState('authenticated');
                return;
            }

            setNeedsSetup(status.needsSetup);

            try {
                await api.getFeeds();
                setSessionExpired(false);
                setAuthState('authenticated');
            } catch (error: any) {
                if (error?.code === 'SESSION_EXPIRED') {
                    setSessionExpired(true);
                } else {
                    setSessionExpired(false);
                }

                await api.logout();
                setAuthState('unauthenticated');
            }
        } catch (error) {
            console.error('Auth bootstrap failed:', error);
            setAuthState('unauthenticated');
        }
    }, []);

    useEffect(() => {
        void refreshAuth();
    }, [refreshAuth]);

    const completeLogin = useCallback(() => {
        setSessionExpired(false);
        setAuthState('authenticated');
    }, []);

    const logout = useCallback(async () => {
        await api.logout();
        setSessionExpired(false);
        setAuthState('unauthenticated');
    }, []);

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
