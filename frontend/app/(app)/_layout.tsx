import { useEffect, useState } from 'react';
import { View, StyleSheet, useWindowDimensions, Platform, ActivityIndicator } from 'react-native';
import { Slot } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFeedStore } from '@/stores/feedStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useColors } from '@/theme';
import Sidebar from '@/components/Sidebar';
import MobileNav from '@/components/MobileNav';
import Timeline from '@/components/Timeline';
import BookmarksList from '@/components/BookmarksList';
import { RefreshProgressDialog } from '@/components/RefreshProgressDialog';
import { usePathname } from 'expo-router';
import { FloatingPlayer } from '@/components/FloatingPlayer';
import { PodcastPlayer } from '@/components/PodcastPlayer';
import { FloatingAudioPlayer } from '@/components/FloatingAudioPlayer';
import { useAudioStore } from '@/stores/audioStore';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { LoginScreen } from '@/components/LoginScreen';
import { useFeedChanges } from '@/hooks/useFeedChanges';
import { usePwaThemeColor } from '@/hooks/usePwaThemeColor';
import { useAuthBootstrap } from '@/hooks/useAuthBootstrap';
import { useRefreshLifecycle } from '@/hooks/useRefreshLifecycle';
import { useWakeLock } from '@/hooks/useWakeLock';
import { usePwaUpdate } from '@/hooks/usePwaUpdate';
import { PwaUpdateBanner } from '@/components/PwaUpdateBanner';

export default function AppLayout() {
    const [mounted, setMounted] = useState(false);
    const {
        isAuthenticated,
        needsSetup,
        sessionExpired,
        completeLogin,
    } = useAuthBootstrap(mounted);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Mounting pattern for hydration
    useEffect(() => {
        setMounted(true);
    }, []);
    const { width } = useWindowDimensions();
    const isDesktop = width >= 1024;
    const appSafeAreaEdges = Platform.OS === 'web'
        ? (isDesktop
            ? (['top', 'left', 'right'] as const)
            : (['left', 'right'] as const))
        : (isDesktop
            ? (['top', 'left', 'right', 'bottom'] as const)
            : (['top', 'left', 'right'] as const));
    const { refreshState, cancelRefresh } = useFeedStore();
    const { showPlayer } = useAudioStore();
    const { settings } = useSettingsStore();

    const lifecycleEnabled = mounted && !!isAuthenticated;
    const realtimeEnabled = mounted && !!isAuthenticated && Platform.OS !== 'web';

    // Listen for real-time feed/folder changes from other devices
    useFeedChanges(realtimeEnabled);

    // Sync PWA theme color with accent color setting
    usePwaThemeColor(settings?.accent_color);
    useRefreshLifecycle({ enabled: lifecycleEnabled, realtimeEnabled });

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
    const {
        updateAvailable,
        applyUpdate,
        dismissUpdate,
    } = usePwaUpdate(mounted && !!isAuthenticated);

    useWakeLock(mounted && !isDesktop && !!isAuthenticated && (settings?.keep_screen_awake ?? true));

    // Show loading state while checking auth
    if (!mounted || isAuthenticated === null) {
        return (
            <SafeAreaView
                edges={['top', 'left', 'right']}
                style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background.primary }}
            >
                <ActivityIndicator size="large" color={colors.primary.DEFAULT} />
            </SafeAreaView>
        );
    }

    // Show login screen if not authenticated
    if (!isAuthenticated) {
        return (
            <LoginScreen
                needsSetup={needsSetup}
                sessionExpired={sessionExpired}
                onLogin={completeLogin}
            />
        );
    }

    return (
        <ErrorBoundary>
            <SafeAreaView edges={appSafeAreaEdges} style={s.container}>
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
                    visible={!!refreshState.progress}
                    total={refreshState.progress?.total || 0}
                    completed={refreshState.progress?.completed || 0}
                    currentTitle={refreshState.progress?.currentTitle || ''}
                    statusMessage={refreshState.message}
                    onCancel={cancelRefresh}
                />
                <PwaUpdateBanner
                    visible={updateAvailable}
                    onReload={applyUpdate}
                    onDismiss={dismissUpdate}
                />
            </SafeAreaView>
        </ErrorBoundary>
    );
}

const styles = (isDesktop: boolean, isReaderRoute: boolean, colors: any) => StyleSheet.create({
    container: {
        flex: 1,
        flexDirection: isDesktop ? 'row' : 'column',
        backgroundColor: colors.background.elevated,
        ...(Platform.OS === 'web' && {
            height: '100svh' as any,
            minHeight: '100svh' as any,
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
