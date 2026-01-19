import { useEffect, useState, useRef } from 'react';
import { View, TouchableOpacity, StyleSheet, useWindowDimensions, Animated, AppState, AppStateStatus } from 'react-native';
import { useRouter } from 'expo-router';
import { useArticleStore, useFeedStore } from '@/stores';
import { Menu, X } from 'lucide-react-native';
import { useColors, borderRadius, spacing } from '@/theme';

import Sidebar from '@/components/Sidebar';
import Timeline from '@/components/Timeline';
import { DigestView } from '@/components/DigestView';

export default function ArticleListScreen() {
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);
    const router = useRouter();
    const colors = useColors();
    const { width } = useWindowDimensions();
    const isMobile = width < 1024;
    const { fetchArticles } = useArticleStore();
    const { fetchFeeds, fetchFolders } = useFeedStore();
    const [showMenu, setShowMenu] = useState(false);

    // Animated value for sidebar slide-in from left
    const [sidebarAnim] = useState(new Animated.Value(-300));

    const toggleMenu = () => {
        setShowMenu(!showMenu);
        Animated.timing(sidebarAnim, {
            toValue: showMenu ? -300 : 0,
            duration: 250,
            useNativeDriver: true,
        }).start();
    };

    const lastRefreshRef = useRef<number>(0);
    const STALE_THRESHOLD = 5 * 60 * 1000; // 5 minutes

    useEffect(() => {
        const refreshData = (isSilent = false) => {
            const now = Date.now();
            if (now - lastRefreshRef.current < STALE_THRESHOLD && isSilent) {
                console.log('Skipping foreground refresh, data is still fresh');
                return;
            }
            fetchFeeds();
            fetchFolders();
            fetchArticles(true);
            lastRefreshRef.current = now;
        };

        // initial load
        refreshData();

        // Listen for app state changes to refresh when returning to foreground
        const subscription = AppState.addEventListener('change', (nextAppState) => {
            if (nextAppState === 'active') {
                console.log('App returned to foreground, checking for refresh...');
                refreshData(true);
            }
        });

        return () => {
            subscription.remove();
        };
    }, []);

    const s = styles(colors, isMobile);

    if (!mounted) return null;

    return (
        <View style={s.container}>
            {/* Desktop: Column 3 Content (Placeholder/Digest) */}
            {/* Mobile: Full Screen Timeline (which includes Header) */}

            <View style={s.mainLayout}>
                {isMobile ? (
                    <View style={s.fullPane}>
                        {/* Mobile Header with Menu Button needs to be inside Timeline? 
                            Wait, Timeline has a header now. 
                            But Mobile needs the Menu button to toggle sidebar.
                            Timeline header doesn't have the Menu button logic.
                            I should pass a prop to Timeline for "onMenuPress"?
                        */}
                        <Timeline />

                        {/* We need the MENU button on mobile. 
                            The new Timeline header has "Articles" title but no Menu button. 
                            I should add 'onMenuPress' prop to Timeline or render a floating button?
                            Timeline header corresponds to the "List Pane" header.
                            Previous index.tsx header had the Menu button.
                        */}
                        <TouchableOpacity onPress={toggleMenu} style={s.mobileMenuButton}>
                            <Menu size={24} color={colors.text.primary} />
                        </TouchableOpacity>
                    </View>
                ) : (
                    <View style={s.readerPane}>
                        <DigestView />
                    </View>
                )}
            </View>

            {isMobile && (
                <>
                    {/* Backdrop */}
                    {showMenu && (
                        <TouchableOpacity
                            style={s.sidebarBackdrop}
                            activeOpacity={1}
                            onPress={toggleMenu}
                        />
                    )}
                    {/* Sidebar */}
                    <Animated.View
                        style={[
                            s.sidebarContainer,
                            {
                                transform: [{ translateX: sidebarAnim }],
                                width: 280,
                            },
                        ]}
                    >
                        <View style={{ alignItems: 'flex-end', padding: spacing.md }}>
                            <TouchableOpacity onPress={toggleMenu} style={{ padding: spacing.sm }}>
                                <X size={24} color={colors.text.primary} />
                            </TouchableOpacity>
                        </View>
                        <Sidebar onNavigate={toggleMenu} />
                    </Animated.View>
                </>
            )}
        </View>
    );
}

const styles = (colors: any, isMobile: boolean) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background.primary,
    },
    mainLayout: {
        flex: 1,
        flexDirection: 'row',
    },
    fullPane: {
        flex: 1,
        width: '100%',
    },
    readerPane: {
        flex: 1,
        height: '100%',
        backgroundColor: colors.background.secondary,
        justifyContent: 'center',
        alignItems: 'center',
    },
    mobileMenuButton: {
        position: 'absolute',
        top: spacing.md,
        left: spacing.md,
        zIndex: 100,
        padding: 8,
        backgroundColor: colors.background.elevated,
        borderRadius: borderRadius.full,
        shadowColor: '#000',
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    // Slide-from-left sidebar (iOS PWA style)
    sidebarBackdrop: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        zIndex: 900,
    },
    sidebarContainer: {
        position: 'absolute',
        top: 0,
        left: 0,
        bottom: 0,
        backgroundColor: colors.background.elevated,
        borderRightWidth: 1,
        borderRightColor: colors.border.DEFAULT,
        zIndex: 1000,
        shadowColor: '#000',
        shadowOffset: { width: 2, height: 0 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
        elevation: 5,
    },
});
