import { useEffect, useState, useRef } from 'react';
import { View, StyleSheet, useWindowDimensions, Platform, AppState, ActivityIndicator } from 'react-native';
import { Slot } from 'expo-router';
import { useArticleStore, useFeedStore, useSettingsStore } from '@/stores';
import { useColors } from '@/theme';
import Sidebar from '@/components/Sidebar';
import { enableSync, fetchChanges } from '@/lib/sync';
import MobileNav from '@/components/MobileNav';
import Timeline from '@/components/Timeline';
import BookmarksList from '@/components/BookmarksList';
import { RefreshProgressDialog } from '@/components/RefreshProgressDialog';
import NewArticlesPill from '@/components/NewArticlesPill';
import { usePathname } from 'expo-router';
import { FloatingPlayer } from '@/components/FloatingPlayer';
import { PodcastPlayer } from '@/components/PodcastPlayer';
import { FloatingAudioPlayer } from '@/components/FloatingAudioPlayer';
import { useAudioStore } from '@/stores/audioStore';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { api } from '@/services/api';
import { LoginScreen } from '@/components/LoginScreen';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFeedChanges } from '@/hooks/useFeedChanges';
import { usePwaThemeColor } from '@/hooks/usePwaThemeColor';

export default function AppLayout() {
    const [mounted, setMounted] = useState(false);
    const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
    useEffect(() => setMounted(true), []);
    const { width } = useWindowDimensions();
    const isDesktop = width >= 1024;
    const { fetchFeeds, fetchFolders, refreshProgress, cancelRefresh } = useFeedStore();
    const { fetchArticles } = useArticleStore();
    const { showPlayer } = useAudioStore();
    const { fetchSettings, settings } = useSettingsStore();
    const lastIsRefreshingRef = useRef(false);

    // Listen for real-time feed/folder changes from other devices
    useFeedChanges();

    // Sync PWA theme color with accent color setting
    usePwaThemeColor(settings?.accent_color);

    // Check authentication status on mount
    useEffect(() => {
        const checkAuth = async () => {
            try {
                const status = await api.getAuthStatus();
                if (!status.authEnabled) {
                    // Auth not enabled, allow access
                    setIsAuthenticated(true);
                    return;
                }

                // Check if we have a valid token
                const token = await AsyncStorage.getItem('@feeds_auth_token');
                if (token) {
                    // Try to make an authenticated request to verify token
                    try {
                        await api.getFeeds();
                        setIsAuthenticated(true);
                    } catch (e) {
                        // Token invalid
                        await api.logout();
                        setIsAuthenticated(false);
                    }
                } else {
                    setIsAuthenticated(false);
                }
            } catch (e) {
                console.error('Auth check failed:', e);
                setIsAuthenticated(false);
            }
        };

        checkAuth();
    }, []);

    useEffect(() => {
        if (!isAuthenticated) return;

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
            window.addEventListener('load', async () => {
                try {
                    const registration = await navigator.serviceWorker.register('/sw.js');
                    console.log('SW registered:', registration);
                    
                    // Register for background sync if supported
                    if ('sync' in registration) {
                        try {
                            await registration.sync.register('feeds-background-sync');
                            console.log('Background sync registered');
                        } catch (syncError) {
                            console.log('Background sync registration failed:', syncError);
                        }
                    }
                    
                    // Register for periodic background sync if supported
                    if ('periodicSync' in registration) {
                        try {
                            const status = await navigator.permissions.query({
                                name: 'periodic-background-sync' as PermissionName,
                            });
                            
                            if (status.state === 'granted') {
                                await (registration as any).periodicSync.register('feeds-background-sync', {
                                    minInterval: 5 * 60 * 1000, // 5 minutes
                                });
                                console.log('Periodic background sync registered');
                            }
                        } catch (periodicError) {
                            console.log('Periodic sync registration failed:', periodicError);
                        }
                    }
                    
                    // Listen for messages from service worker
                    navigator.serviceWorker.addEventListener('message', (event) => {
                        if (event.data?.type === 'BACKGROUND_SYNC_COMPLETE') {
                            console.log('Background sync completed:', event.data);
                        }
                    });
                } catch (err) {
                    console.log('SW registration failed: ', err);
                }
            });
        }

        return () => {
            cleanupSync();
        };
    }, []);

    useEffect(() => {
        const controller = new AbortController();
        let refreshTimeout: ReturnType<typeof setTimeout> | null = null;
        let hasSyncedOnce = false;

        const syncNow = async () => {
            const syncResult = await fetchChanges('feeds,folders,articles,read_state', { skipCursorUpdate: true });
            if (syncResult) {
                useFeedStore.getState().applySyncChanges(syncResult.changes, true);
                useArticleStore.getState().applySyncChanges(syncResult.changes);
            }
        };

        const debouncedSync = () => {
            if (!hasSyncedOnce) {
                hasSyncedOnce = true;
                syncNow();
                return;
            }

            if (refreshTimeout) clearTimeout(refreshTimeout);
            refreshTimeout = setTimeout(() => {
                syncNow();
            }, 800);
        };

        api.listenForRefreshEvents(
            (event) => {
                if (event.type === 'start') {
                    useFeedStore.setState({
                        isBackgroundRefreshing: true,
                        refreshProgress: { total: event.total_feeds, completed: 0, currentTitle: '' },
                    });
                    return;
                }

                if (event.type === 'feed_refreshing') {
                    useFeedStore.setState((state) => ({
                        refreshProgress: state.refreshProgress
                            ? { ...state.refreshProgress, currentTitle: event.title }
                            : { total: 0, completed: 0, currentTitle: event.title },
                    }));
                    return;
                }

                if (event.type === 'feed_complete' || event.type === 'feed_error') {
                    if (event.type === 'feed_complete' && event.new_articles > 0) {
                        debouncedSync();
                    }

                    useFeedStore.setState((state) => ({
                        refreshProgress: state.refreshProgress
                            ? {
                                ...state.refreshProgress,
                                completed: state.refreshProgress.completed + 1,
                                currentTitle: event.title || state.refreshProgress.currentTitle,
                            }
                            : null,
                    }));

                    if (event.type === 'feed_complete') {
                        const feedStore = useFeedStore.getState();
                        const existing = feedStore.feeds.find((feed) => feed.id === event.id);
                        const unreadCount = (existing?.unread_count ?? 0) + event.new_articles;
                        feedStore.updateLocalFeed(event.id, {
                            title: event.feed ? event.feed.title : existing?.title,
                            icon_url: event.feed ? event.feed.icon_url : existing?.icon_url,
                            type: event.feed ? event.feed.type : existing?.type,
                            unread_count: unreadCount,
                            last_fetched_at: new Date().toISOString(),
                            next_fetch_at: event.next_fetch_at ?? existing?.next_fetch_at ?? null,
                        });

                        if (event.feed) {
                            const articleStore = useArticleStore.getState();
                            articleStore.updateFeedMetadata(event.feed.id, {
                                feed_title: event.feed.title,
                                feed_icon_url: event.feed.icon_url,
                                feed_type: event.feed.type,
                            });
                        }
                    }
                    return;
                }

                if (event.type === 'complete') {
                    useFeedStore.setState({ isBackgroundRefreshing: false, refreshProgress: null });
                    // Fetch new articles after background refresh completes
                    fetchFeeds();
                    fetchFolders();
                    fetchArticles(true);
                    fetchSettings().catch(() => {});
                    return;
                }
            },
            (error) => {
                console.warn('[RefreshEvents] SSE stream error:', error);
            },
            controller.signal
        );

        return () => {
            controller.abort();
            if (refreshTimeout) clearTimeout(refreshTimeout);
            useFeedStore.setState({ isBackgroundRefreshing: false, refreshProgress: null });
        };
    }, []);

    useEffect(() => {
        let lastRefreshAt = Date.now();
        let wasHidden = false;
        let backgroundedAt: number | null = null;
        const STALE_MS = 30 * 1000;
        const BACKGROUND_REFRESH_THRESHOLD_MS = 2 * 60 * 1000; // 2 minutes - if backgrounded longer than this, do a full refresh

        // Initial data load - fetch settings first for timer
        fetchSettings().catch(() => { });
        
        const refreshNow = async (force = false) => {
            const now = Date.now();
            const timeSinceLast = now - lastRefreshAt;
            
            if (!force && timeSinceLast < STALE_MS) return;
            lastRefreshAt = now;
            
            // Just fetch latest data from backend - do NOT trigger a crawl
            // This ensures instant updates if the backend has been working in the background
            
            // Reset any stuck refresh state
            useFeedStore.setState({ 
                isBackgroundRefreshing: false, 
                refreshProgress: null 
            });
            
            await Promise.all([
                fetchFeeds(),
                fetchFolders(),
                fetchArticles(true)
            ]);
            fetchSettings().catch(() => { });
        };

        const appStateSub = AppState.addEventListener('change', (state) => {
            if (state === 'active') {
                // Check if we were backgrounded for a significant time
                const backgroundedDuration = backgroundedAt ? Date.now() - backgroundedAt : 0;
                const forceRefresh = backgroundedDuration > BACKGROUND_REFRESH_THRESHOLD_MS;
                backgroundedAt = null;
                refreshNow(forceRefresh);
            } else if (state === 'background' || state === 'inactive') {
                backgroundedAt = Date.now();
            }
        });

        const onVisibility = () => {
            if (document.visibilityState === 'visible') {
                // Check if we were hidden for a significant time
                const hiddenDuration = backgroundedAt ? Date.now() - backgroundedAt : 0;
                const forceRefresh = hiddenDuration > BACKGROUND_REFRESH_THRESHOLD_MS;
                backgroundedAt = null;
                wasHidden = true;
                refreshNow(forceRefresh);
            } else if (document.visibilityState === 'hidden') {
                wasHidden = true;
                backgroundedAt = Date.now();
            }
        };

        const onFocus = () => {
            // Only refresh if the page was actually hidden (tab switch), not on internal navigation
            if (wasHidden) {
                wasHidden = false;
                // Check if significant time passed while hidden
                const hiddenDuration = backgroundedAt ? Date.now() - backgroundedAt : 0;
                const forceRefresh = hiddenDuration > BACKGROUND_REFRESH_THRESHOLD_MS;
                backgroundedAt = null;
                refreshNow(forceRefresh);
            }
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
    const isBookmarks = pathname.includes('/bookmarks');
    const isReaderRoute = isHome || isArticle || isDigest || isBookmarks;

    const activeArticleId = isArticle ? parseInt(pathname.split('/').pop() || '') : null;

    const s = styles(isDesktop, isReaderRoute, colors);

    // Show loading state while checking auth
    if (!mounted || isAuthenticated === null) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background.primary }}>
                <ActivityIndicator size="large" color={colors.primary.DEFAULT} />
            </View>
        );
    }

    // Show login screen if not authenticated
    if (!isAuthenticated) {
        return (
            <LoginScreen onLogin={() => setIsAuthenticated(true)} />
        );
    }

    return (
        <ErrorBoundary>
            <View style={s.container}>
                {isDesktop && <Sidebar />}
                {isDesktop && isReaderRoute && !isDigest && !isBookmarks && (
                    <View style={s.timelinePane}>
                        <ErrorBoundary>
                            <Timeline activeArticleId={activeArticleId} />
                        </ErrorBoundary>
                    </View>
                )}
                {isDesktop && isBookmarks && (
                    <View style={s.timelinePane}>
                        <ErrorBoundary>
                            <BookmarksList activeArticleId={activeArticleId} />
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

                <NewArticlesPill isDesktop={isDesktop} />
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
