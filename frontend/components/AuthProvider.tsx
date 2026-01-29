import React, { createContext, useContext, useState, useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '@/services/api';
import { useColors } from '@/theme';

interface AuthContextType {
    isAuthenticated: boolean;
    isLoading: boolean;
    login: () => void;
    logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const colors = useColors();

    useEffect(() => {
        checkAuth();
    }, []);

    const checkAuth = async () => {
        try {
            const status = await api.getAuthStatus();
            if (!status.authEnabled) {
                setIsAuthenticated(true);
                setIsLoading(false);
                return;
            }

            const token = await AsyncStorage.getItem('@feeds_auth_token');
            if (token) {
                try {
                    await api.getFeeds();
                    setIsAuthenticated(true);
                } catch (e) {
                    await api.logout();
                    setIsAuthenticated(false);
                }
            } else {
                setIsAuthenticated(false);
            }
        } catch (e) {
            console.error('Auth check failed:', e);
            setIsAuthenticated(false);
        } finally {
            setIsLoading(false);
        }
    };

    const login = () => {
        setIsAuthenticated(true);
    };

    const logout = async () => {
        await api.logout();
        setIsAuthenticated(false);
    };

    if (isLoading) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background.primary }}>
                <ActivityIndicator size="large" color={colors.primary.DEFAULT} />
            </View>
        );
    }

    return (
        <AuthContext.Provider value={{ isAuthenticated, isLoading, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
