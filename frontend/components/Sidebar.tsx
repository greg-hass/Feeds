import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { useFeedStore, useArticleStore, useAuthStore, useToastStore } from '@/stores';
import {
    Rss, Youtube, MessageSquare, Headphones,
    Folder, Search, Settings,
    Plus, LogOut, RefreshCw, List, Bookmark
} from 'lucide-react-native';
import { colors, borderRadius, spacing } from '@/theme';
import { ActivityIndicator } from 'react-native';

const FEED_TYPE_ICONS: Record<string, React.ComponentType<any>> = {
    rss: Rss,
    youtube: Youtube,
    reddit: MessageSquare,
    podcast: Headphones,
};

export default function Sidebar() {
    const router = useRouter();
    const { feeds, folders, smartFolders, totalUnread, fetchFeeds, fetchFolders, isLoading } = useFeedStore();
    const { setFilter } = useArticleStore();
    const { logout } = useAuthStore();
    const { show } = useToastStore();

    const handleSmartFolderPress = (type: string) => {
        setFilter({ type, feed_id: undefined, folder_id: undefined });
        router.push('/(app)');
    };

    const handleFolderPress = (folderId: number) => {
        setFilter({ folder_id: folderId, type: undefined, feed_id: undefined });
        router.push('/(app)');
    };

    const handleFeedPress = (feedId: number) => {
        setFilter({ feed_id: feedId, type: undefined, folder_id: undefined });
        router.push('/(app)');
    };

    const handleAllPress = () => {
        setFilter({ feed_id: undefined, folder_id: undefined, type: undefined });
        router.push('/(app)');
    };

    const handleRefresh = async () => {
        try {
            await Promise.all([fetchFeeds(), fetchFolders()]);
            show('Feeds updated', 'success');
        } catch (error) {
            show('Failed to refresh feeds', 'error');
        }
    };

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <View style={styles.logoRow}>
                    <Rss size={24} color={colors.primary.DEFAULT} />
                    <Text style={styles.logoText}>Feeds</Text>
                </View>
                <TouchableOpacity onPress={handleRefresh} style={styles.iconButton} disabled={isLoading}>
                    {isLoading ? (
                        <ActivityIndicator size={18} color={colors.primary.DEFAULT} />
                    ) : (
                        <RefreshCw size={18} color={colors.text.secondary} />
                    )}
                </TouchableOpacity>
            </View>

            {/* Search */}
            <TouchableOpacity style={styles.searchBar} onPress={() => router.push('/(app)/search')}>
                <Search size={18} color={colors.text.tertiary} />
                <Text style={styles.searchText}>Search...</Text>
            </TouchableOpacity>

            <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
                {/* All */}
                <TouchableOpacity style={styles.navItem} onPress={handleAllPress}>
                    <Rss size={18} color={colors.primary.DEFAULT} />
                    <Text style={styles.navItemText}>All Articles</Text>
                    {totalUnread > 0 && (
                        <View style={styles.badge}>
                            <Text style={styles.badgeText}>{totalUnread}</Text>
                        </View>
                    )}
                </TouchableOpacity>

                {/* Bookmarks */}
                <TouchableOpacity style={styles.navItem} onPress={() => router.push('/(app)/bookmarks')}>
                    <Bookmark size={18} color={colors.primary.DEFAULT} />
                    <Text style={styles.navItemText}>Bookmarks</Text>
                </TouchableOpacity>

                {/* Subscriptions */}
                {/* Manage Feeds */}
                <TouchableOpacity style={styles.navItem} onPress={() => router.push('/(app)/manage')}>
                    <Settings size={18} color={colors.text.secondary} />
                    <Text style={styles.navItemText}>Manage Feeds</Text>
                </TouchableOpacity>

                {/* Smart Folders */}
                <Text style={styles.sectionTitle}>By Type</Text>
                {smartFolders.map((sf) => {
                    const Icon = FEED_TYPE_ICONS[sf.type] || Rss;
                    const iconColor = sf.type === 'podcast' ? colors.secondary.DEFAULT : colors.text.secondary;
                    return (
                        <TouchableOpacity
                            key={sf.type}
                            style={styles.navItem}
                            onPress={() => handleSmartFolderPress(sf.type)}
                        >
                            <Icon size={18} color={iconColor} />
                            <Text style={styles.navItemText}>{sf.name}</Text>
                            {sf.unread_count > 0 && (
                                <View style={styles.badge}>
                                    <Text style={styles.badgeText}>{sf.unread_count}</Text>
                                </View>
                            )}
                        </TouchableOpacity>
                    );
                })}

                {/* User Folders */}
                {folders.length > 0 && (
                    <>
                        <Text style={styles.sectionTitle}>Folders</Text>
                        {folders.map((folder) => (
                            <TouchableOpacity
                                key={folder.id}
                                style={styles.navItem}
                                onPress={() => handleFolderPress(folder.id)}
                            >
                                <Folder size={18} color={colors.secondary.DEFAULT} />
                                <Text style={styles.navItemText}>{folder.name}</Text>
                                {folder.unread_count > 0 && (
                                    <View style={styles.badge}>
                                        <Text style={styles.badgeText}>{folder.unread_count}</Text>
                                    </View>
                                )}
                            </TouchableOpacity>
                        ))}
                    </>
                )}

                {/* Feeds without folder */}
                <Text style={styles.sectionTitle}>Feeds</Text>
                {feeds
                    .filter((f) => !f.folder_id)
                    .map((feed) => {
                        const Icon = FEED_TYPE_ICONS[feed.type] || Rss;
                        return (
                            <TouchableOpacity
                                key={feed.id}
                                style={styles.navItem}
                                onPress={() => handleFeedPress(feed.id)}
                            >
                                {feed.icon_url ? (
                                    <Image source={{ uri: feed.icon_url }} style={styles.feedIcon} />
                                ) : (
                                    <Icon size={18} color={colors.text.tertiary} />
                                )}
                                <Text style={styles.navItemText} numberOfLines={1}>{feed.title}</Text>
                                {feed.unread_count > 0 && (
                                    <View style={styles.badge}>
                                        <Text style={styles.badgeText}>{feed.unread_count}</Text>
                                    </View>
                                )}
                            </TouchableOpacity>
                        );
                    })}
            </ScrollView>

            {/* Footer */}
            <View style={styles.footer}>
                <TouchableOpacity style={styles.footerButton} onPress={() => router.push('/(app)/manage')}>
                    <Plus size={18} color={colors.primary.DEFAULT} />
                    <Text style={styles.footerButtonText}>Add Feed</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.footerButton} onPress={() => router.push('/(app)/settings')}>
                    <Settings size={18} color={colors.text.secondary} />
                    <Text style={styles.footerButtonText}>Settings</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.footerButton} onPress={logout}>
                    <LogOut size={18} color={colors.text.tertiary} />
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        width: 280,
        backgroundColor: colors.background.elevated,
        borderRightWidth: 1,
        borderRightColor: colors.border.DEFAULT,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: spacing.lg,
        paddingTop: 20,
    },
    logoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    logoText: {
        fontSize: 20,
        fontWeight: '700',
        color: colors.text.primary,
    },
    iconButton: {
        padding: spacing.sm,
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.background.secondary,
        marginHorizontal: spacing.md,
        marginBottom: spacing.lg,
        padding: spacing.md,
        borderRadius: borderRadius.md,
        gap: spacing.sm,
    },
    searchText: {
        color: colors.text.tertiary,
        fontSize: 14,
    },
    scrollView: {
        flex: 1,
        paddingHorizontal: spacing.sm,
    },
    sectionTitle: {
        fontSize: 11,
        fontWeight: '600',
        color: colors.text.tertiary,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        paddingHorizontal: spacing.sm,
        paddingTop: spacing.lg,
        paddingBottom: spacing.sm,
    },
    navItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        padding: spacing.md,
        borderRadius: borderRadius.md,
        marginBottom: 2,
    },
    navItemText: {
        flex: 1,
        fontSize: 14,
        color: colors.text.primary,
    },
    badge: {
        backgroundColor: colors.background.tertiary,
        paddingHorizontal: spacing.sm,
        paddingVertical: 2,
        borderRadius: borderRadius.full,
        minWidth: 24,
        alignItems: 'center',
    },
    badgeText: {
        fontSize: 12,
        color: colors.text.secondary,
        fontWeight: '500',
    },
    feedIcon: {
        width: 18,
        height: 18,
        borderRadius: 4,
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        padding: spacing.md,
        borderTopWidth: 1,
        borderTopColor: colors.border.DEFAULT,
        gap: spacing.sm,
    },
    footerButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        padding: spacing.md,
        borderRadius: borderRadius.md,
        backgroundColor: colors.background.secondary,
    },
    footerButtonText: {
        fontSize: 13,
        color: colors.text.secondary,
    },
});
