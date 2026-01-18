import { useEffect, useState } from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import { Slot } from 'expo-router';
import { useFeedStore } from '@/stores';
import { useColors } from '@/theme';
import Sidebar from '@/components/Sidebar';
import MobileNav from '@/components/MobileNav';
import Timeline from '@/components/Timeline';
import { RefreshProgressDialog } from '@/components/RefreshProgressDialog';
import { usePathname } from 'expo-router';
import { useArticleStore } from '@/stores';

export default function AppLayout() {
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);
    const { width } = useWindowDimensions();
    // Use collapsible sidebar on tablets (iPad), only permanent on larger desktop screens
    // Use collapsible sidebar on tablets (iPad), only permanent on larger desktop screens
    const isDesktop = width >= 1024;
    const { fetchFeeds, fetchFolders, refreshProgress } = useFeedStore();

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

    const pathname = usePathname();
    const colors = useColors();
    const isReaderRoute = pathname === '/' || pathname.startsWith('/article/') || pathname.startsWith('/digest');
    const activeArticleId = pathname.startsWith('/article/') ? parseInt(pathname.split('/').pop() || '') : null;

    const s = styles(isDesktop, isReaderRoute, colors);

    if (!mounted) return null;

    return (
        <View style={s.container}>
            {isDesktop && <Sidebar />}
            {isDesktop && isReaderRoute && (
                <View style={s.timelinePane}>
                    <Timeline activeArticleId={activeArticleId} />
                </View>
            )}
            <View style={s.content}>
                <Slot />
            </View>
            {!isDesktop && <MobileNav />}

            <RefreshProgressDialog
                visible={!!refreshProgress}
                total={refreshProgress?.total || 0}
                completed={refreshProgress?.completed || 0}
                currentTitle={refreshProgress?.currentTitle || ''}
            />
        </View >
    );
}

const styles = (isDesktop: boolean, isReaderRoute: boolean, colors: any) => StyleSheet.create({
    container: {
        flex: 1,
        flexDirection: isDesktop ? 'row' : 'column',
        backgroundColor: colors.background.primary,
    },
    timelinePane: {
        flex: 1, // Equal width with content
        borderRightWidth: 1,
        borderRightColor: colors.border.DEFAULT,
        backgroundColor: colors.background.primary,
    },
    content: {
        flex: 1,
        backgroundColor: isDesktop && isReaderRoute ? colors.background.secondary : colors.background.primary,
    },
});
