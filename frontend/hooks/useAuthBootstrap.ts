import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '@/services/api';

export function useAuthBootstrap() {
    const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

    useEffect(() => {
        const checkAuth = async () => {
            try {
                const status = await api.getAuthStatus();
                if (!status.authEnabled) {
                    setIsAuthenticated(true);
                    return;
                }

                const token = await AsyncStorage.getItem('@feeds_auth_token');
                if (!token) {
                    setIsAuthenticated(false);
                    return;
                }

                try {
                    await api.getFeeds();
                    setIsAuthenticated(true);
                } catch {
                    await api.logout();
                    setIsAuthenticated(false);
                }
            } catch (error) {
                console.error('Auth check failed:', error);
                setIsAuthenticated(false);
            }
        };

        checkAuth();
    }, []);

    return {
        isAuthenticated,
        setIsAuthenticated,
    };
}
