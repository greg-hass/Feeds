import { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { useFeedStore, useToastStore, useArticleStore } from '@/stores';
import { api, Feed, Folder } from '@/services/api';
import {
    ArrowLeft, Rss, Youtube, Headphones, MessageSquare,
    Folder as FolderIcon, RefreshCw, Trash2, ChevronRight, Check
} from 'lucide-react-native';
import { colors, borderRadius, spacing } from '@/theme';

export default function SubscriptionsScreen() {
    const router = useRouter();
    const { feeds, folders, fetchFeeds, fetchFolders, isLoading } = useFeedStore();
    const { setFilter } = useArticleStore();
    const { show } = useToastStore();

    const [isRefreshing, setIsRefreshing] = useState(false);

    const handleRefresh = async () => {
        setIsRefreshing(true);
        try {
            await Promise.all([fetchFeeds(), fetchFolders()]);
            show('Feeds updated', 'success');
        } catch (error) {
            show('Failed to refresh feeds', 'error');
        } finally {
            setIsRefreshing(false);
        }
    };

    const handleFeedPress = (feedId: number) => {
        setFilter({ feed_id: feedId, type: undefined, folder_id: undefined });
        router.push('/(app)');
    };

    const handleFolderPress = (folderId: number) => {
        setFilter({ folder_id: folderId, type: undefined, feed_id: undefined });
        router.push('/(app)');
    };

    const handleRefreshFeed = async (feedId: number, title: string) => {
        try {
            await api.refreshFeed(feedId);
            show(`Refreshing "${title}"...`, 'info');
        } catch (err) {
            show('Refresh failed', 'error');
        }
    };

    const handleDeleteFeed = (feedId: number, title: string) => {
        Alert.alert(
            'Delete Feed',
            `Are you sure you want to delete "${title}"?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await api.deleteFeed(feedId);
                            fetchFeeds();
                            show('Feed deleted', 'success');
                        } catch (err) {
                            show('Delete failed', 'error');
                        }
                    }
                }
            ]
        );
    };

    const getTypeIcon = (type: string) => {
        switch (type) {
            case 'youtube': return <Youtube size={16} color="#ef4444" />;
            case 'podcast': return <Headphones size={16} color={colors.secondary.DEFAULT} />;
            case 'reddit': return <MessageSquare size={16} color="#f97316" />;
            default: return <Rss size={16} color={colors.primary.DEFAULT} />;
        }
    };

    const renderFeedItem = (feed: Feed) => (
        <View key={feed.id} style={styles.feedRow}>
            <TouchableOpacity
                style={styles.feedContent}
                onPress={() => handleFeedPress(feed.id)}
            >
                {getTypeIcon(feed.type)}
                <View style={styles.feedInfo}>
                    <Text style={styles.feedTitle} numberOfLines={1}>{feed.title}</Text>
                    {feed.last_fetched_at && (
                        <Text style={styles.lastFetched}>
                            Last updated: {new Date(feed.last_fetched_at).toLocaleDateString()}
                        </Text>
                    )}
                </View>
                {feed.unread_count > 0 && (
                    <View style={styles.unreadBadge}>
                        <Text style={styles.unreadCount}>{feed.unread_count}</Text>
                    </View>
                )}
            </TouchableOpacity>

            <View style={styles.feedActions}>
                <TouchableOpacity
                    onPress={() => handleRefreshFeed(feed.id, feed.title)}
                    style={styles.actionButton}
                >
                    <RefreshCw size={16} color={colors.text.tertiary} />
                </TouchableOpacity>
                <TouchableOpacity
                    onPress={() => handleDeleteFeed(feed.id, feed.title)}
                    style={styles.actionButton}
                >
                    <Trash2 size={16} color={colors.text.tertiary} />
                </TouchableOpacity>
            </View>
        </View>
    );

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <ArrowLeft size={24} color={colors.text.primary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>All Subscriptions</Text>
                <TouchableOpacity
                    onPress={handleRefresh}
                    style={styles.headerRefresh}
                    disabled={isRefreshing}
                >
                    {isRefreshing ? (
                        <ActivityIndicator size="small" color={colors.primary.DEFAULT} />
                    ) : (
                        <RefreshCw size={20} color={colors.text.secondary} />
                    )}
                </TouchableOpacity>
            </View>

            <ScrollView
                style={styles.scrollView}
                refreshControl={
                    <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor={colors.primary.DEFAULT} />
                }
            >
                <View style={styles.content}>
                    {/* Folders & their feeds */}
                    {folders.map(folder => {
                        const folderFeeds = feeds.filter(f => f.folder_id === folder.id);
                        if (folderFeeds.length === 0) return null;

                        return (
                            <View key={folder.id} style={styles.section}>
                                <TouchableOpacity
                                    style={styles.sectionHeader}
                                    onPress={() => handleFolderPress(folder.id)}
                                >
                                    <FolderIcon size={18} color={colors.secondary.DEFAULT} />
                                    <Text style={styles.sectionTitle}>{folder.name}</Text>
                                    <ChevronRight size={16} color={colors.text.tertiary} />
                                </TouchableOpacity>
                                <View style={styles.sectionContent}>
                                    {folderFeeds.map(renderFeedItem)}
                                </View>
                            </View>
                        );
                    })}

                    {/* Uncategorized feeds */}
                    {feeds.filter(f => !f.folder_id).length > 0 && (
                        <View style={styles.section}>
                            <View style={styles.sectionHeader}>
                                <Text style={styles.sectionTitle}>Uncategorized</Text>
                            </View>
                            <View style={styles.sectionContent}>
                                {feeds.filter(f => !f.folder_id).map(renderFeedItem)}
                            </View>
                        </View>
                    )}

                    {feeds.length === 0 && !isLoading && (
                        <View style={styles.emptyState}>
                            <Rss size={48} color={colors.text.tertiary} />
                            <Text style={styles.emptyText}>No subscriptions yet</Text>
                            <TouchableOpacity
                                style={styles.addButton}
                                onPress={() => router.push('/(app)/manage')}
                            >
                                <Text style={styles.addButtonText}>Add your first feed</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </View>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background.primary,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: spacing.lg,
        gap: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.border.DEFAULT,
    },
    backButton: {
        padding: spacing.sm,
        marginLeft: -spacing.sm,
    },
    headerTitle: {
        flex: 1,
        fontSize: 20,
        fontWeight: '600',
        color: colors.text.primary,
    },
    headerRefresh: {
        padding: spacing.sm,
    },
    scrollView: {
        flex: 1,
    },
    content: {
        padding: spacing.lg,
    },
    section: {
        marginBottom: spacing.xl,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        marginBottom: spacing.md,
        paddingHorizontal: spacing.sm,
    },
    sectionTitle: {
        flex: 1,
        fontSize: 16,
        fontWeight: '700',
        color: colors.text.primary,
    },
    sectionContent: {
        backgroundColor: colors.background.secondary,
        borderRadius: borderRadius.lg,
        overflow: 'hidden',
    },
    feedRow: {
        flexDirection: 'row',
        alignItems: 'center',
        borderBottomWidth: 1,
        borderBottomColor: colors.border.DEFAULT,
    },
    feedContent: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        padding: spacing.lg,
        gap: spacing.md,
    },
    feedInfo: {
        flex: 1,
    },
    feedTitle: {
        fontSize: 15,
        fontWeight: '500',
        color: colors.text.primary,
    },
    lastFetched: {
        fontSize: 12,
        color: colors.text.tertiary,
        marginTop: 2,
    },
    unreadBadge: {
        backgroundColor: colors.primary.DEFAULT + '22',
        paddingHorizontal: spacing.sm,
        paddingVertical: 2,
        borderRadius: borderRadius.full,
        minWidth: 24,
        alignItems: 'center',
    },
    unreadCount: {
        fontSize: 12,
        color: colors.primary.DEFAULT,
        fontWeight: '600',
    },
    feedActions: {
        flexDirection: 'row',
        paddingRight: spacing.sm,
    },
    actionButton: {
        padding: spacing.md,
    },
    emptyState: {
        padding: 60,
        alignItems: 'center',
        gap: spacing.md,
    },
    emptyText: {
        fontSize: 16,
        color: colors.text.secondary,
    },
    addButton: {
        marginTop: spacing.md,
        paddingHorizontal: spacing.xl,
        paddingVertical: spacing.md,
        backgroundColor: colors.primary.DEFAULT,
        borderRadius: borderRadius.md,
    },
    addButtonText: {
        color: colors.text.inverse,
        fontWeight: '600',
    },
});
