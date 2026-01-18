import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useSettingsStore } from '@/stores';
import { initializeSync } from '@/stores';
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

function AppInitializer() {
    useEffect(() => {
        // Initialize settings and sync on app start
        useSettingsStore.getState().fetchSettings().catch(() => {});
        initializeSync();
    }, []);

    return (
        <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(app)" />
        </Stack>
    );
}

export default function RootLayout() {
    return (
        <QueryClientProvider client={queryClient}>
            <ThemeProvider>
                <StatusBar style="auto" />
                <AppInitializer />
                <ToastContainer />
            </ThemeProvider>
        </QueryClientProvider>
    );
}
