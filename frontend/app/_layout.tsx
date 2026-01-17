import { useEffect, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, StyleSheet, Text } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore, useSettingsStore } from '@/stores';
import { ThemeProvider } from '@/theme';
import ToastContainer from '@/components/Toast';

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 1000 * 60 * 5, // 5 minutes
            retry: 2,
        },
    },
});

function AuthGate() {
    const router = useRouter();
    const segments = useSegments();
    const { isAuthenticated, isLoading, setupRequired, checkAuthStatus } = useAuthStore();
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        Promise.all([
            checkAuthStatus(),
            useSettingsStore.getState().fetchSettings().catch(() => {
                // Ignore if not logged in yet
            })
        ]).catch((err) => {
            console.error('Initial data fetch failed:', err);
            setError('Failed to connect to server');
        });
    }, []);

    useEffect(() => {
        if (isLoading) return;

        const inAuthGroup = segments[0] === '(auth)';

        // If setup is required OR if we failed to check status (likely first run), go to setup
        if (setupRequired && !inAuthGroup) {
            router.replace('/(auth)/setup');
        } else if (!isAuthenticated && !inAuthGroup) {
            // Not authenticated - go to either setup (if needed) or login
            if (setupRequired) {
                router.replace('/(auth)/setup');
            } else {
                router.replace('/(auth)/login');
            }
        } else if (isAuthenticated && inAuthGroup) {
            router.replace('/(app)');
        }
    }, [isAuthenticated, isLoading, setupRequired, segments]);

    if (isLoading) {
        return (
            <View style={styles.loading}>
                <ActivityIndicator size="large" color={colors.primary.DEFAULT} />
                {error && <Text style={styles.errorText}>{error}</Text>}
            </View>
        );
    }

    return (
        <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(app)" />
        </Stack>
    );
}

export default function RootLayout() {
    return (
        <QueryClientProvider client={queryClient}>
            <ThemeProvider>
                <StatusBar style="auto" />
                <AuthGate />
                <ToastContainer />
            </ThemeProvider>
        </QueryClientProvider>
    );
}

const styles = StyleSheet.create({
    loading: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: colors.background.primary,
    },
    errorText: {
        color: colors.error,
        marginTop: 16,
        fontSize: 14,
    },
});
