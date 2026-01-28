import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Image, ActivityIndicator, Platform } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { useFeedStore, useArticleStore } from '@/stores';
import {
    Rss, Youtube, MessageSquare, Headphones,
    Folder, Search, Settings,
    Plus, RefreshCw, Bookmark, BookOpen, Pause, BarChart3, Zap
} from 'lucide-react-native';
import { useColors, borderRadius, spacing, shadows } from '@/theme';
import { useIsDesktop } from '@/hooks/useBreakpoint';
import { formatCount } from '@/utils/formatters';

const FEED_TYPE_ICONS: Record<string, React.ComponentType<any>> = {
    rss: Rss,
    youtube: Youtube,
    reddit: MessageSquare,
    podcast: Headphones,
};

export default function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
    const router = useRouter();
    const pathname = usePathname();
    const colors = useColors();
    const {
        feeds, folders, smartFolders, totalUnread, fetchFeeds, fetchFolders,
        isLoading, isBackgroundRefreshing, refreshAllFeeds
    } = useFeedStore();
    const { filter, setFilter } = useArticleStore();

    const isDesktop = useIsDesktop();
    const s = styles(colors, isDesktop);

    const handleSmartFolderPress = (type: string) => {
        setFilter({ type, feed_id: undefined, folder_id: undefined });
        onNavigate?.();
        router.push('/');
    };

    const handleFolderPress = (folderId: number) => {
        setFilter({ folder_id: folderId, type: undefined, feed_id: undefined });
        onNavigate?.();
        router.push('/');
    };

    const handleFeedPress = (feedId: number) => {
        setFilter({ feed_id: feedId, type: undefined, folder_id: undefined });
        onNavigate?.();
        router.push('/');
    };

    const handleAllPress = () => {
        setFilter({ feed_id: undefined, folder_id: undefined, type: undefined });
        onNavigate?.();
        router.push('/');
    };

    const handleRefresh = async () => {
        // Trigger generic refresh for all feeds
        await refreshAllFeeds();
    };

    const isHome = pathname === '/' || pathname === '/index';
    const isAllActive = isHome && !filter.feed_id && !filter.folder_id && !filter.type;

    return (
        <View style={s.container}>
            {/* Header */}
            <View style={s.header}>
                <View style={s.logoRow}>
                    <Rss size={24} color={colors.primary.DEFAULT} />
                    <Text style={s.logoText}>Feeds</Text>
                    {isBackgroundRefreshing && <View style={s.refreshDot} />}
                </View>
                <TouchableOpacity
                    onPress={handleRefresh}
                    style={s.iconButton}
                    disabled={isLoading}
                    accessibilityLabel="Refresh feeds"
                    accessibilityRole="button"
                >
                    {isLoading ? (
                        <ActivityIndicator size={18} color={colors.primary.DEFAULT} />
                    ) : (
                        <RefreshCw size={18} color={colors.text.secondary} />
                    )}
                </TouchableOpacity>
            </View>

            {/* Search */}
            <TouchableOpacity
                style={s.searchBar}
                onPress={() => { onNavigate?.(); router.push('/search'); }}
                accessibilityLabel="Search articles"
                accessibilityRole="search"
            >
                <Search size={18} color={colors.text.tertiary} />
                <Text style={s.searchText}>Search…</Text>
            </TouchableOpacity>

            <ScrollView style={s.scrollView} showsVerticalScrollIndicator={false}>
                {/* All */}
                <TouchableOpacity
                    style={[s.navItem, isAllActive && s.navItemActive]}
                    onPress={handleAllPress}
                    accessibilityLabel="View all articles"
                    accessibilityRole="link"
                >
                    <Rss size={18} color={isAllActive ? colors.text.inverse : colors.primary.DEFAULT} />
                    <Text style={[s.navItemText, isAllActive && s.navItemTextActive]}>All Articles</Text>
                    {totalUnread > 0 && (
                        <View style={[s.badge, isAllActive && s.badgeActive]}>
                            <Text style={[s.badgeText, isAllActive && s.badgeTextActive]}>{formatCount(totalUnread)}</Text>
                        </View>
                    )}
                </TouchableOpacity>

                {/* Bookmarks */}
                <TouchableOpacity
                    style={[s.navItem, pathname === '/bookmarks' && s.navItemActive]}
                    onPress={() => { onNavigate?.(); router.push('/bookmarks'); }}
                    accessibilityLabel="View bookmarks"
                    accessibilityRole="link"
                >
                    <Bookmark size={18} color={pathname === '/bookmarks' ? colors.text.inverse : colors.primary.DEFAULT} />
                    <Text style={[s.navItemText, pathname === '/bookmarks' && s.navItemTextActive]}>Bookmarks</Text>
                </TouchableOpacity>

                {/* Daily Digest */}
                <TouchableOpacity
                    style={[s.navItem, pathname === '/digest' && s.navItemActive]}
                    onPress={() => { onNavigate?.(); router.push('/digest'); }}
                    accessibilityLabel="View daily digest"
                    accessibilityRole="link"
                >
                    <BookOpen size={18} color={pathname === '/digest' ? colors.text.inverse : colors.primary.DEFAULT} />
                    <Text style={[s.navItemText, pathname === '/digest' && s.navItemTextActive]}>Daily Digest</Text>
                </TouchableOpacity>

                {/* Analytics */}
                <TouchableOpacity
                    style={[s.navItem, pathname.includes('/analytics') && s.navItemActive]}
                    onPress={() => { onNavigate?.(); router.push('/(app)/analytics' as any); }}
                    accessibilityLabel="View analytics dashboard"
                    accessibilityRole="link"
                >
                    <BarChart3 size={18} color={pathname.includes('/analytics') ? colors.text.inverse : colors.primary.DEFAULT} />
                    <Text style={[s.navItemText, pathname.includes('/analytics') && s.navItemTextActive]}>Analytics</Text>
                </TouchableOpacity>

                {/* Automation Rules */}
                <TouchableOpacity
                    style={[s.navItem, pathname.includes('/rules') && s.navItemActive]}
                    onPress={() => { onNavigate?.(); router.push('/(app)/rules' as any); }}
                    accessibilityLabel="Manage automation rules"
                    accessibilityRole="link"
                >
                    <Zap size={18} color={pathname.includes('/rules') ? colors.text.inverse : colors.warning} />
                    <Text style={[s.navItemText, pathname.includes('/rules') && s.navItemTextActive]}>Automation</Text>
                </TouchableOpacity>

                {/* Smart Folders */}
                <Text style={s.sectionTitle}>By Type</Text>
                {smartFolders.map((smartFolder) => {
                    const Icon = FEED_TYPE_ICONS[smartFolder.type] || Rss;
                    const isActive = isHome && filter.type === smartFolder.type;
                    const iconColor = isActive ? colors.text.inverse : colors.text.secondary;

                    return (
                        <TouchableOpacity
                            key={smartFolder.type}
                            style={[s.navItem, isActive && s.navItemActive]}
                            onPress={() => handleSmartFolderPress(smartFolder.type)}
                            accessibilityLabel={`View ${smartFolder.name}`}
                            accessibilityRole="link"
                        >
                            <Icon size={18} color={isActive ? colors.text.inverse : iconColor} />
                            <Text style={[s.navItemText, isActive && s.navItemTextActive]}>{smartFolder.name}</Text>
                            {smartFolder.unread_count > 0 && (
                                <View style={[s.badge, isActive && s.badgeActive]}>
                                    <Text style={[s.badgeText, isActive && s.badgeTextActive]}>{formatCount(smartFolder.unread_count)}</Text>
                                </View>
                            )}
                        </TouchableOpacity>
                    );
                })}

                {/* User Folders */}
                {folders.length > 0 && (
                    <>
                        <Text style={s.sectionTitle}>Folders</Text>
                        {folders.map((folder) => {
                            const isActive = isHome && filter.folder_id === folder.id;
                            return (
                                <TouchableOpacity
                                    key={folder.id}
                                    style={[s.navItem, isActive && s.navItemActive]}
                                    onPress={() => handleFolderPress(folder.id)}
                                    accessibilityLabel={`View folder ${folder.name}`}
                                    accessibilityRole="link"
                                >
                                    <Folder size={18} color={isActive ? colors.text.inverse : colors.primary.DEFAULT} />
                                    <Text style={[s.navItemText, isActive && s.navItemTextActive]}>{folder.name}</Text>
                                    {folder.unread_count > 0 && (
                                        <View style={[s.badge, isActive && s.badgeActive]}>
                                            <Text style={[s.badgeText, isActive && s.badgeTextActive]}>{formatCount(folder.unread_count)}</Text>
                                        </View>
                                    )}
                                </TouchableOpacity>
                            );
                        })}
                    </>
                )}

                {/* Feeds without folder */}
                <Text style={s.sectionTitle}>Feeds</Text>
                {feeds
                    .filter((feedItem) => !feedItem.folder_id)
                    .map((feed) => {
                        const Icon = FEED_TYPE_ICONS[feed.type] || Rss;
                        const isActive = isHome && filter.feed_id === feed.id;
                        const isPaused = !!feed.paused_at;
                        return (
                            <TouchableOpacity
                                key={feed.id}
                                style={[s.navItem, isActive && s.navItemActive, isPaused && s.navItemPaused]}
                                onPress={() => handleFeedPress(feed.id)}
                                accessibilityLabel={`View feed ${feed.title}${isPaused ? ' (paused)' : ''}`}
                                accessibilityRole="link"
                            >
                                {feed.icon_url ? (
                                    <View style={s.feedIconWrapper}>
                                        <Image source={{ uri: feed.icon_url }} style={[s.feedIcon, isPaused && s.feedIconPaused]} />
                                        {isPaused && (
                                            <View style={s.pausedIndicator}>
                                                <Pause size={8} color={colors.text.inverse} />
                                            </View>
                                        )}
                                    </View>
                                ) : (
                                    <View style={s.feedIconWrapper}>
                                        <Icon size={18} color={isActive ? colors.text.inverse : (isPaused ? colors.text.tertiary : colors.text.tertiary)} />
                                        {isPaused && (
                                            <View style={s.pausedIndicator}>
                                                <Pause size={8} color={colors.text.inverse} />
                                            </View>
                                        )}
                                    </View>
                                )}
                                <Text style={[s.navItemText, isActive && s.navItemTextActive, isPaused && s.navItemTextPaused]} numberOfLines={1}>{feed.title}</Text>
                                {isPaused ? (
                                    <View style={s.pausedBadge}>
                                        <Pause size={10} color={colors.warning} />
                                    </View>
                                ) : feed.unread_count > 0 && (
                                    <View style={[s.badge, isActive && s.badgeActive]}>
                                        <Text style={[s.badgeText, isActive && s.badgeTextActive]}>{formatCount(feed.unread_count)}</Text>
                                    </View>
                                )}
                            </TouchableOpacity>
                        );
                    })}
            </ScrollView>

            {/* Footer */}
            <View style={s.footer}>
                <TouchableOpacity
                    style={s.footerButton}
                    onPress={() => { onNavigate?.(); router.push('/manage'); }}
                    accessibilityLabel="Add new feed"
                    accessibilityRole="button"
                >
                    <Plus size={18} color={colors.primary.DEFAULT} />
                    <Text style={s.footerButtonText}>Add Feed</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[s.footerButton, { backgroundColor: 'transparent' }]}
                    onPress={() => { onNavigate?.(); router.push('/settings'); }}
                    accessibilityLabel="App settings"
                    accessibilityRole="button"
                >
                    <Settings size={18} color={colors.text.secondary} />
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = (colors: any, isDesktop: boolean) => StyleSheet.create({
    container: {
        width: 280,
        minWidth: 280,
        maxWidth: 280,
        height: '100%',
        backgroundColor: colors.background.primary,
        borderRightWidth: 1,
        borderRightColor: colors.border.DEFAULT,
        // Premium elevation for desktop
        ...Platform.select({
            web: {
                boxShadow: '4px 0 16px rgba(0, 0, 0, 0.05)',
            },
        }),
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: spacing.lg,
        paddingTop: Platform.OS === 'ios' ? 60 : 20,
    },
    logoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    logoText: {
        fontSize: 22,
        fontWeight: '800',
        color: colors.text.primary,
        letterSpacing: -0.5,
    },
    iconButton: {
        padding: spacing.md,
        borderRadius: borderRadius.md,
        backgroundColor: colors.background.tertiary,
        minWidth: 44,
        minHeight: 44,
        justifyContent: 'center',
        alignItems: 'center',
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.background.secondary,
        marginHorizontal: spacing.lg,
        marginBottom: spacing.xl,
        padding: spacing.md,
        borderRadius: borderRadius.lg,
        gap: spacing.sm,
        borderWidth: 1,
        borderColor: colors.border.DEFAULT,
    },
    searchText: {
        color: colors.text.tertiary,
        fontSize: 14,
        fontWeight: '500',
    },
    scrollView: {
        flex: 1,
        paddingHorizontal: spacing.md,
    },
    sectionTitle: {
        fontSize: 11,
        fontWeight: '700',
        color: colors.text.tertiary,
        textTransform: 'uppercase',
        letterSpacing: 1,
        paddingHorizontal: spacing.sm,
        paddingTop: spacing.xl,
        paddingBottom: spacing.sm,
    },
    navItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        padding: spacing.md,
        borderRadius: borderRadius.md,
        marginBottom: 4,
    },
    navItemActive: {
        backgroundColor: colors.primary.DEFAULT,
        borderLeftWidth: 4,
        borderLeftColor: colors.primary.DEFAULT,
        ...shadows.colored(colors.primary.DEFAULT),
        // Premium shadow for active state
        ...Platform.select({
            web: {
                boxShadow: `0 4px 12px ${colors.primary.DEFAULT}33`,
            },
        }),
    },
    navItemText: {
        flex: 1,
        fontSize: 14,
        fontWeight: '500',
        color: colors.text.secondary,
    },
    navItemTextActive: {
        color: colors.text.inverse,
        fontWeight: '700',
    },
    badge: {
        backgroundColor: colors.background.tertiary,
        paddingHorizontal: spacing.sm,
        paddingVertical: 2,
        borderRadius: borderRadius.full,
        minWidth: 28,
        alignItems: 'center',
    },
    badgeActive: {
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
    },
    badgeText: {
        fontSize: 11,
        color: colors.text.secondary,
        fontWeight: '700',
    },
    badgeTextActive: {
        color: colors.text.inverse,
    },
    feedIconWrapper: {
        width: 18,
        height: 18,
        borderRadius: 4,
        overflow: 'hidden',
        backgroundColor: colors.background.tertiary,
        position: 'relative',
    },
    feedIcon: {
        width: '100%',
        height: '100%',
    },
    feedIconPaused: {
        opacity: 0.6,
    },
    pausedIndicator: {
        position: 'absolute',
        bottom: -3,
        right: -3,
        backgroundColor: colors.warning,
        borderRadius: 6,
        padding: 1.5,
    },
    navItemPaused: {
        opacity: 0.7,
    },
    navItemTextPaused: {
        color: colors.text.tertiary,
    },
    pausedBadge: {
        backgroundColor: colors.warning + '22',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: borderRadius.sm,
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        padding: spacing.lg,
        borderTopWidth: 1,
        borderTopColor: colors.border.DEFAULT,
        backgroundColor: colors.background.primary,
        gap: spacing.md,
    },
    footerButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: spacing.md,
        borderRadius: borderRadius.lg,
        backgroundColor: colors.background.secondary,
        borderWidth: 1,
        borderColor: colors.border.DEFAULT,
    },
    footerButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.text.primary,
    },
    refreshDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: colors.primary.DEFAULT,
        opacity: 0.8,
    },
});
