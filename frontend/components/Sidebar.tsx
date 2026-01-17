import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { useFeedStore, useArticleStore, useAuthStore } from '@/stores';
import {
    Rss, Youtube, MessageSquare, Headphones,
    Folder, ChevronRight, Search, Settings,
    Plus, LogOut, RefreshCw
} from 'lucide-react-native';

const FEED_TYPE_ICONS: Record<string, React.ComponentType<any>> = {
    rss: Rss,
    youtube: Youtube,
    reddit: MessageSquare,
    podcast: Headphones,
};

export default function Sidebar() {
    const router = useRouter();
    const { feeds, folders, smartFolders, totalUnread, fetchFeeds, fetchFolders } = useFeedStore();
    const { setFilter } = useArticleStore();
    const { logout } = useAuthStore();

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

    const handleRefresh = () => {
        fetchFeeds();
        fetchFolders();
    };

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <View style={styles.logoRow}>
                    <Rss size={24} color="#a3e635" />
                    <Text style={styles.logoText}>Feeds</Text>
                </View>
                <TouchableOpacity onPress={handleRefresh} style={styles.iconButton}>
                    <RefreshCw size={18} color="#a1a1aa" />
                </TouchableOpacity>
            </View>

            {/* Search */}
            <TouchableOpacity style={styles.searchBar} onPress={() => router.push('/(app)/search')}>
                <Search size={18} color="#71717a" />
                <Text style={styles.searchText}>Search...</Text>
            </TouchableOpacity>

            <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
                {/* All */}
                <TouchableOpacity style={styles.navItem} onPress={handleAllPress}>
                    <Rss size={18} color="#a3e635" />
                    <Text style={styles.navItemText}>All Articles</Text>
                    {totalUnread > 0 && (
                        <View style={styles.badge}>
                            <Text style={styles.badgeText}>{totalUnread}</Text>
                        </View>
                    )}
                </TouchableOpacity>

                {/* Smart Folders */}
                <Text style={styles.sectionTitle}>By Type</Text>
                {smartFolders.map((sf) => {
                    const Icon = FEED_TYPE_ICONS[sf.type] || Rss;
                    return (
                        <TouchableOpacity
                            key={sf.type}
                            style={styles.navItem}
                            onPress={() => handleSmartFolderPress(sf.type)}
                        >
                            <Icon size={18} color="#a1a1aa" />
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
                                <Folder size={18} color="#a1a1aa" />
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
                                    <Icon size={18} color="#71717a" />
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
                    <Plus size={18} color="#a1a1aa" />
                    <Text style={styles.footerButtonText}>Add Feed</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.footerButton} onPress={() => router.push('/(app)/settings')}>
                    <Settings size={18} color="#a1a1aa" />
                    <Text style={styles.footerButtonText}>Settings</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.footerButton} onPress={logout}>
                    <LogOut size={18} color="#71717a" />
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        width: 280,
        backgroundColor: '#09090b',
        borderRightWidth: 1,
        borderRightColor: '#27272a',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
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
        color: '#fafafa',
    },
    iconButton: {
        padding: 8,
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#18181b',
        marginHorizontal: 12,
        marginBottom: 16,
        padding: 10,
        borderRadius: 8,
        gap: 8,
    },
    searchText: {
        color: '#71717a',
        fontSize: 14,
    },
    scrollView: {
        flex: 1,
        paddingHorizontal: 8,
    },
    sectionTitle: {
        fontSize: 11,
        fontWeight: '600',
        color: '#52525b',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        paddingHorizontal: 8,
        paddingTop: 16,
        paddingBottom: 8,
    },
    navItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        padding: 10,
        borderRadius: 8,
        marginBottom: 2,
    },
    navItemText: {
        flex: 1,
        fontSize: 14,
        color: '#e4e4e7',
    },
    badge: {
        backgroundColor: '#27272a',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 10,
        minWidth: 24,
        alignItems: 'center',
    },
    badgeText: {
        fontSize: 12,
        color: '#a1a1aa',
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
        padding: 12,
        borderTopWidth: 1,
        borderTopColor: '#27272a',
        gap: 8,
    },
    footerButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        padding: 10,
        borderRadius: 8,
        backgroundColor: '#18181b',
    },
    footerButtonText: {
        fontSize: 13,
        color: '#a1a1aa',
    },
});
