import { useEffect, useState } from 'react';
import { View, StyleSheet, useWindowDimensions, Platform } from 'react-native';
import { Slot } from 'expo-router';
import { useFeedStore } from '@/stores';
import { useColors } from '@/theme';
import Sidebar from '@/components/Sidebar';
import MobileNav from '@/components/MobileNav';
import Timeline from '@/components/Timeline';
import { RefreshProgressDialog } from '@/components/RefreshProgressDialog';
import { usePathname } from 'expo-router';
import { FloatingPlayer } from '@/components/FloatingPlayer';
import { PodcastPlayer } from '@/components/PodcastPlayer';
import { FloatingAudioPlayer } from '@/components/FloatingAudioPlayer';
import { useAudioStore } from '@/stores/audioStore';
import { ErrorBoundary } from '@/components/ErrorBoundary';

export default function AppLayout() {
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);
    const { width } = useWindowDimensions();
    const isDesktop = width >= 1024;
    const { fetchFeeds, fetchFolders, refreshProgress, cancelRefresh } = useFeedStore();
    const { showPlayer } = useAudioStore();

    useEffect(() => {
        fetchFeeds();
        fetchFolders();

        if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('/sw.js').catch(err => {
                    console.log('SW registration failed: ', err);
                });
            });
        }
    }, []);

    const pathname = usePathname() || '';
    const colors = useColors();

    // Robust checks for routes, handling environment differences in pathname format
    const isHome = pathname === '/' || pathname.endsWith('/index');
    const isArticle = pathname.includes('/article/');
    const isDigest = pathname.includes('/digest');
    const isReaderRoute = isHome || isArticle || isDigest;

    const activeArticleId = isArticle ? parseInt(pathname.split('/').pop() || '') : null;

    const s = styles(isDesktop, isReaderRoute, colors);

    if (!mounted) return null;

    return (
        <ErrorBoundary>
            <View style={s.container}>
                {isDesktop && <Sidebar />}
                {isDesktop && isReaderRoute && (
                    <View style={s.timelinePane}>
                        <ErrorBoundary>
                            <Timeline activeArticleId={activeArticleId} />
                        </ErrorBoundary>
                    </View>
                )}
                <View style={s.content}>
                    <ErrorBoundary>
                        <Slot />
                    </ErrorBoundary>
                </View>
                {!isDesktop && <MobileNav />}

                <FloatingPlayer />
                <FloatingAudioPlayer onRestore={showPlayer} />
                <PodcastPlayer />

                <RefreshProgressDialog
                    visible={!!refreshProgress}
                    total={refreshProgress?.total || 0}
                    completed={refreshProgress?.completed || 0}
                    currentTitle={refreshProgress?.currentTitle || ''}
                    onCancel={cancelRefresh}
                />
            </View >
        </ErrorBoundary>
    );
}

const styles = (isDesktop: boolean, isReaderRoute: boolean, colors: any) => StyleSheet.create({
    container: {
        flex: 1,
        flexDirection: isDesktop ? 'row' : 'column',
        backgroundColor: colors.background.elevated,
        ...(Platform.OS === 'web' && {
            height: '100dvh' as any,
            minHeight: '100dvh' as any,
            paddingTop: 'env(safe-area-inset-top)' as any,
            paddingBottom: 'env(safe-area-inset-bottom)' as any,
        }),
    },
    timelinePane: {
        flex: 1, // Changed from width: 50% to flex: 1
        borderRightWidth: 1,
        borderRightColor: colors.border.DEFAULT,
        backgroundColor: colors.background.primary,
        // Shadow crease effect
        ...(Platform.OS === 'web' && isDesktop && {
            boxShadow: '4px 0 10px rgba(0,0,0,0.03)',
            zIndex: 5,
        }),
    },
    content: {
        flex: 1,
        backgroundColor: colors.background.secondary,
        // The reader portion
        ...(Platform.OS === 'web' && isDesktop && isReaderRoute && {
            minWidth: 400,
        }),
    },
});
