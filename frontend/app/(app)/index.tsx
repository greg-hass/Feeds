import { useEffect, useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Linking, Image, useWindowDimensions, Platform, Animated } from 'react-native';
import { useRouter } from 'expo-router';
import { useArticleStore, useFeedStore } from '@/stores';
import { Article } from '@/services/api';
import { CircleCheck, Filter, Menu, X, RefreshCw } from 'lucide-react-native';
import { useColors, borderRadius, spacing } from '@/theme';

import { VideoModal } from '@/components/VideoModal';
import Sidebar from '@/components/Sidebar';
import { RefreshProgressDialog } from '@/components/RefreshProgressDialog';
import Timeline from '@/components/Timeline';
import { DigestView } from '@/components/DigestView';

export default function ArticleListScreen() {
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);
    const router = useRouter();
    const colors = useColors();
    const { width } = useWindowDimensions();
    // Use collapsible sidebar on tablets (iPad), only permanent on larger desktop screens
    const isMobile = width < 1024;
    const { fetchArticles, setFilter, markAllRead, error, clearError, filter } = useArticleStore();
    const { feeds, fetchFeeds, fetchFolders, refreshAllFeeds, refreshProgress } = useFeedStore();
    const [showMenu, setShowMenu] = useState(false);
    const [activeVideoId, setActiveVideoId] = useState<string | null>(null);
    const [timeLeft, setTimeLeft] = useState<string | null>(null);

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

    const s = styles(colors, isMobile);

    useEffect(() => {
        fetchFeeds();
        fetchFolders();
        fetchArticles(true);
    }, []);

    const handleRefresh = useCallback(() => {
        refreshAllFeeds();
    }, [refreshAllFeeds]);

    // Countdown Timer Logic
    useEffect(() => {
        const timer = setInterval(() => {
            const now = new Date();
            let earliest: Date | null = null;

            feeds.forEach(f => {
                if (f.next_fetch_at) {
                    const next = new Date(f.next_fetch_at);
                    if (!isNaN(next.getTime())) {
                        if (!earliest || next < earliest) {
                            earliest = next;
                        }
                    }
                }
            });

            if (earliest) {
                const diff = (earliest as Date).getTime() - now.getTime();
                if (diff <= 0) {
                    setTimeLeft('Soon');
                } else {
                    const minutes = Math.floor(diff / 60000);
                    const seconds = Math.floor((diff % 60000) / 1000);
                    setTimeLeft(`${minutes}m ${seconds}s`);
                }
            } else {
                setTimeLeft(null);
            }
        }, 1000);

        return () => clearInterval(timer);
    }, [feeds]);

    const handleMarkAllRead = () => {
        const getScope = (): { scope: 'feed' | 'folder' | 'type' | 'all'; scopeId?: number; type?: string } => {
            if (filter.feed_id) return { scope: 'feed', scopeId: filter.feed_id };
            if (filter.folder_id) return { scope: 'folder', scopeId: filter.folder_id };
            if (filter.type) return { scope: 'type', type: filter.type };
            return { scope: 'all' };
        };

        const { scope, scopeId, type } = getScope();
        const scopeName = scope === 'all' ? 'all articles' : `these ${scope} articles`;

        Alert.alert(
            'Mark All as Read',
            `Mark ${scopeName} as read?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Mark Read',
                    onPress: async () => {
                        try {
                            await markAllRead(scope, scopeId, type);
                        } catch (err) {
                            Alert.alert('Error', 'Failed to mark articles as read');
                        }
                    }
                }
            ]
        );
        // Close menu if open
        if (showMenu) toggleMenu();
    };

    const getHeaderTitle = () => {
        if (filter.type) {
            const typeNames: Record<string, string> = {
                rss: 'RSS',
                youtube: 'YouTube',
                podcast: 'Podcasts',
                reddit: 'Reddit',
            };
            return typeNames[filter.type] || 'Articles';
        }
        return 'Articles';
    };

    if (!mounted) return null;

    return (
        <View style={s.container}>
            {/* Split layout for desktop: List | Reader-Placeholder */}
            <View style={s.mainLayout}>
                <View style={[s.listPane, isMobile && s.fullPane]}>
                    {/* Header */}
                    <View style={[s.header, isMobile && s.headerMobile]}>
                        <View style={s.headerLeft}>
                            {isMobile && (
                                <TouchableOpacity onPress={toggleMenu} style={s.menuButton}>
                                    <Menu size={24} color={colors.text.primary} />
                                </TouchableOpacity>
                            )}
                            <Text style={s.headerTitle}>{getHeaderTitle()}</Text>
                        </View>

                        <View style={s.headerActions}>
                            {timeLeft && (
                                <View style={s.refreshContainer}>
                                    <Text style={s.countdownText}>{timeLeft}</Text>
                                    <TouchableOpacity onPress={handleRefresh} style={s.iconButton}>
                                        <RefreshCw size={18} color={colors.primary.DEFAULT} />
                                    </TouchableOpacity>
                                </View>
                            )}

                            <TouchableOpacity
                                style={[s.filterButton, filter.unread_only && s.filterButtonActive]}
                                onPress={() => setFilter({ unread_only: !filter.unread_only })}
                            >
                                <Filter size={16} color={filter.unread_only ? colors.text.inverse : colors.text.secondary} />
                                {!isMobile && (
                                    <Text style={[s.filterText, filter.unread_only && s.filterTextActive]}>
                                        Unread Only
                                    </Text>
                                )}
                            </TouchableOpacity>

                            <TouchableOpacity onPress={handleMarkAllRead} style={s.iconButton}>
                                <CircleCheck size={20} color={colors.text.secondary} />
                            </TouchableOpacity>
                        </View>
                    </View>

                    {isMobile && <Timeline />}
                </View>

                {/* Desktop Reader Column Placeholder */}
                {!isMobile && (
                    <View style={s.readerPane}>
                        <DigestView />
                    </View>
                )}
            </View>

            {activeVideoId && !isMobile && (
                <VideoModal
                    videoId={activeVideoId}
                    visible={!!activeVideoId}
                    onClose={() => setActiveVideoId(null)}
                />
            )}

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

            <RefreshProgressDialog
                visible={!!refreshProgress}
                total={refreshProgress?.total || 0}
                completed={refreshProgress?.completed || 0}
                currentTitle={refreshProgress?.currentTitle || ''}
            />
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
    listPane: {
        width: isMobile ? '100%' : 400,
        borderRightWidth: isMobile ? 0 : 1,
        borderRightColor: colors.border.DEFAULT,
        backgroundColor: colors.background.primary,
    },
    fullPane: {
        width: '100%',
    },
    readerPane: {
        flex: 1,
        height: '100%',
        backgroundColor: colors.background.secondary,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: spacing.xl,
        paddingBottom: spacing.lg,
        borderBottomWidth: 1,
        borderBottomColor: colors.border.DEFAULT,
    },
    headerMobile: {
        padding: spacing.md,
        paddingTop: spacing.xl,
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    menuButton: {
        marginRight: spacing.md,
        padding: 4,
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: '700',
        color: colors.text.primary,
    },
    headerActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
    },
    refreshContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
    },
    countdownText: {
        fontSize: 12,
        fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
        color: colors.text.tertiary,
        marginRight: spacing.xs,
    },
    iconButton: {
        padding: spacing.sm,
        borderRadius: borderRadius.md,
    },
    filterButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: borderRadius.md,
        backgroundColor: colors.background.secondary,
    },
    filterButtonActive: {
        backgroundColor: colors.primary.DEFAULT,
    },
    filterText: {
        fontSize: 14,
        color: colors.text.secondary,
    },
    filterTextActive: {
        color: colors.text.inverse,
        fontWeight: '500',
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
