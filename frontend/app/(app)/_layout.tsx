import { useEffect } from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import { Slot } from 'expo-router';
import { useFeedStore, useAuthStore } from '@/stores';
import { useColors } from '@/theme';
import Sidebar from '@/components/Sidebar';
import MobileNav from '@/components/MobileNav';

export default function AppLayout() {
    const { width } = useWindowDimensions();
    const isDesktop = width >= 768;
    const { fetchFeeds, fetchFolders } = useFeedStore();

    useEffect(() => {
        fetchFeeds();
        fetchFolders();

        // Register Service Worker for web
        if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('/sw.js').catch(err => {
                    console.log('SW registration failed: ', err);
                });
            });
        }
    }, []);

    const colors = useColors(); // Ensure useColors is imported from '@/theme'

    const s = styles(isDesktop, colors);

    return (
        <View style={s.container}>
            {isDesktop && <Sidebar />}
            <View style={s.content}>
                <Slot />
            </View>
            {!isDesktop && <MobileNav />}
        </View>
    );
}

const styles = (isDesktop: boolean, colors: any) => StyleSheet.create({
    container: {
        flex: 1,
        flexDirection: isDesktop ? 'row' : 'column',
        backgroundColor: colors.background.primary,
    },
    content: {
        flex: 1,
    },
});
