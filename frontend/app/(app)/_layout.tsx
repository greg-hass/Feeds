import { useEffect, useState, useRef } from 'react';
import { View, StyleSheet, useWindowDimensions, Platform, AppState } from 'react-native';
import { Slot } from 'expo-router';
import { useArticleStore, useFeedStore, useSettingsStore } from '@/stores';
import { useColors } from '@/theme';
import Sidebar from '@/components/Sidebar';
import { enableSync } from '@/lib/sync';
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
    const { fetchArticles } = useArticleStore();
    const { showPlayer } = useAudioStore();
    const lastIsRefreshingRef = useRef(false);

    useEffect(() => {
        fetchFeeds();
        fetchFolders();
        fetchArticles(true);

        const cleanupSync = enableSync((changes, isRefreshing) => {
            useFeedStore.getState().applySyncChanges(changes, isRefreshing);
            useArticleStore.getState().applySyncChanges(changes);

            const articleStore = useArticleStore.getState();
            const feedStore = useFeedStore.getState();
            const settingsStore = useSettingsStore.getState();
            const createdCount = Array.isArray(changes.articles?.created) ? changes.articles?.created.length : 0;
            const hasFolderFilter = !!articleStore.filter.folder_id;
            const wasRefreshing = lastIsRefreshingRef.current;
            const nowRefreshing = !!isRefreshing;

            if (hasFolderFilter && createdCount > 0) {
                articleStore.fetchArticles(true, true);
            }

            if (wasRefreshing && !nowRefreshing) {
                feedStore.fetchFeeds();
                feedStore.fetchFolders();
                articleStore.fetchArticles(true, true);
                settingsStore.fetchSettings().catch(() => { });
            }

            lastIsRefreshingRef.current = nowRefreshing;
        });

        if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('/sw.js').catch(err => {
                    console.log('SW registration failed: ', err);
                });
            });
        }

        return () => {
            cleanupSync();
        };
    }, []);

    useEffect(() => {
        let lastRefreshAt = 0;
        const STALE_MS = 30 * 1000;

        const refreshNow = () => {
            const now = Date.now();
            if (now - lastRefreshAt < STALE_MS) return;
            lastRefreshAt = now;
            fetchFeeds();
            fetchFolders();
            fetchArticles(true);
        };

        const appStateSub = AppState.addEventListener('change', (state) => {
            if (state === 'active') {
                refreshNow();
            }
        });

        const onVisibility = () => {
            if (document.visibilityState === 'visible') {
                refreshNow();
            }
        };

        const onFocus = () => {
            refreshNow();
        };

        if (typeof document !== 'undefined') {
            document.addEventListener('visibilitychange', onVisibility);
        }
        if (typeof window !== 'undefined') {
            window.addEventListener('focus', onFocus);
        }

        return () => {
            appStateSub.remove();
            if (typeof document !== 'undefined') {
                document.removeEventListener('visibilitychange', onVisibility);
            }
            if (typeof window !== 'undefined') {
                window.removeEventListener('focus', onFocus);
            }
        };
    }, [fetchArticles, fetchFeeds, fetchFolders]);

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
            // Only add bottom padding on desktop (no mobile nav)
            // Mobile nav handles its own safe area padding
            ...(isDesktop && { paddingBottom: 'env(safe-area-inset-bottom)' as any }),
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
