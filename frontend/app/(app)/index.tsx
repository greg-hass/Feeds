import { useEffect, useCallback, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { formatDistanceToNow } from 'date-fns';
import { useArticleStore, useFeedStore } from '@/stores';
import { Article } from '@/services/api';
import { Circle, CircleCheck, Headphones, Filter, CheckCheck, MoreVertical } from 'lucide-react-native';
import { colors, borderRadius, spacing } from '@/theme';

export default function ArticleListScreen() {
    const router = useRouter();
    const { articles, isLoading, hasMore, filter, fetchArticles, setFilter, markAllRead } = useArticleStore();
    const { fetchFeeds, fetchFolders } = useFeedStore();
    const [showMenu, setShowMenu] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(-1);

    useEffect(() => {
        fetchFeeds();
        fetchFolders();
        fetchArticles(true);
    }, []);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Ignore if typing in an input
            if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') {
                if (e.key === 'Escape') {
                    (document.activeElement as HTMLElement).blur();
                }
                return;
            }

            switch (e.key.toLowerCase()) {
                case 'j': // Next
                    setSelectedIndex(prev => Math.min(prev + 1, articles.length - 1));
                    break;
                case 'k': // Previous
                    setSelectedIndex(prev => Math.max(prev - 1, 0));
                    break;
                case 'm': // Toggle Read
                    if (selectedIndex >= 0 && selectedIndex < articles.length) {
                        const article = articles[selectedIndex];
                        useArticleStore.getState().markRead([article.id], !article.is_read);
                    }
                    break;
                case 'o': // Open in browser
                case 'enter':
                    if (selectedIndex >= 0 && selectedIndex < articles.length) {
                        const article = articles[selectedIndex];
                        if (e.key.toLowerCase() === 'o' && article.url) {
                            window.open(article.url, '_blank');
                        } else {
                            handleArticlePress(article.id);
                        }
                    }
                    break;
                case 'r': // Refresh
                    handleRefresh();
                    break;
                case '/': // Focus search (if search was on this screen, but it's separate)
                    e.preventDefault();
                    router.push('/(app)/search');
                    break;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [articles, selectedIndex, handleRefresh, handleArticlePress]);

    const handleArticlePress = (id: number) => {
        router.push(`/(app)/article/${id}`);
    };

    const handleRefresh = useCallback(() => {
        fetchFeeds();
        fetchFolders();
        fetchArticles(true);
    }, []);

    const handleLoadMore = useCallback(() => {
        if (hasMore && !isLoading) {
            fetchArticles(false);
        }
    }, [hasMore, isLoading]);

    const toggleUnreadFilter = () => {
        setFilter({ unread_only: !filter.unread_only });
    };

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
        setShowMenu(false);
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

    const unreadCount = articles.filter(a => !a.is_read).length;

    const renderArticle = ({ item, index }: { item: Article; index: number }) => (
        <TouchableOpacity
            style={[
                styles.articleCard,
                item.is_read && styles.articleRead,
                index === selectedIndex && styles.articleFocused
            ]}
            onPress={() => handleArticlePress(item.id)}
        >
            <View style={styles.articleHeader}>
                <Text style={styles.feedName}>{item.feed_title}</Text>
                {item.has_audio && <Headphones size={14} color={colors.secondary.DEFAULT} />}
            </View>
            <Text style={[styles.articleTitle, item.is_read && styles.articleTitleRead]} numberOfLines={2}>
                {!item.is_read && (
                    <Circle size={8} color={colors.primary.DEFAULT} fill={colors.primary.DEFAULT} style={{ marginRight: 6 }} />
                )}
                {item.title}
            </Text>
            {item.summary && (
                <Text style={styles.articleSummary} numberOfLines={2}>
                    {item.summary}
                </Text>
            )}
            <Text style={styles.articleMeta}>
                {item.author && `${item.author} • `}
                {item.published_at && formatDistanceToNow(new Date(item.published_at), { addSuffix: true })}
            </Text>
        </TouchableOpacity>
    );

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <View style={styles.headerLeft}>
                    <Text style={styles.headerTitle}>{getHeaderTitle()}</Text>
                    {unreadCount > 0 && (
                        <View style={styles.unreadBadge}>
                            <Text style={styles.unreadBadgeText}>{unreadCount}</Text>
                        </View>
                    )}
                </View>
                <View style={styles.headerActions}>
                    {/* Mark All Read */}
                    <TouchableOpacity
                        style={styles.iconButton}
                        onPress={handleMarkAllRead}
                    >
                        <CheckCheck size={20} color={colors.primary.DEFAULT} />
                    </TouchableOpacity>

                    {/* Unread Filter */}
                    <TouchableOpacity
                        style={[styles.filterButton, filter.unread_only && styles.filterButtonActive]}
                        onPress={toggleUnreadFilter}
                    >
                        <Filter size={16} color={filter.unread_only ? colors.text.inverse : colors.text.secondary} />
                        <Text style={[styles.filterText, filter.unread_only && styles.filterTextActive]}>
                            {filter.unread_only ? 'Unread' : 'All'}
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* List */}
            <FlatList
                data={articles}
                keyExtractor={(item) => String(item.id)}
                renderItem={({ item, index }) => renderArticle({ item, index })}
                contentContainerStyle={styles.list}
                ItemSeparatorComponent={() => <View style={styles.separator} />}
                refreshControl={
                    <RefreshControl
                        refreshing={isLoading && articles.length === 0}
                        onRefresh={handleRefresh}
                        tintColor={colors.primary.DEFAULT}
                        colors={[colors.primary.DEFAULT]}
                    />
                }
                onEndReached={handleLoadMore}
                onEndReachedThreshold={0.5}
                ListFooterComponent={
                    isLoading && articles.length > 0 ? (
                        <ActivityIndicator style={styles.loader} color={colors.primary.DEFAULT} />
                    ) : null
                }
                ListEmptyComponent={
                    !isLoading ? (
                        <View style={styles.empty}>
                            <CircleCheck size={48} color={colors.primary.DEFAULT} />
                            <Text style={styles.emptyTitle}>All caught up!</Text>
                            <Text style={styles.emptyText}>No unread articles</Text>
                        </View>
                    ) : null
                }
            />
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
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: spacing.lg,
        borderBottomWidth: 1,
        borderBottomColor: colors.border.DEFAULT,
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: '700',
        color: colors.text.primary,
    },
    unreadBadge: {
        backgroundColor: colors.primary.DEFAULT,
        paddingHorizontal: spacing.sm,
        paddingVertical: 2,
        borderRadius: borderRadius.full,
        minWidth: 24,
        alignItems: 'center',
    },
    unreadBadgeText: {
        fontSize: 12,
        color: colors.text.inverse,
        fontWeight: '600',
    },
    headerActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
    },
    iconButton: {
        padding: spacing.sm,
        borderRadius: borderRadius.md,
        backgroundColor: colors.background.secondary,
    },
    filterButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: borderRadius.md,
        backgroundColor: colors.background.secondary,
        borderWidth: 1,
        borderColor: colors.border.DEFAULT,
    },
    filterButtonActive: {
        backgroundColor: colors.primary.DEFAULT,
        borderColor: colors.primary.DEFAULT,
    },
    filterText: {
        fontSize: 14,
        color: colors.text.secondary,
    },
    filterTextActive: {
        color: colors.text.inverse,
        fontWeight: '500',
    },
    list: {
        padding: spacing.lg,
    },
    articleCard: {
        backgroundColor: colors.background.secondary,
        borderRadius: borderRadius.lg,
        padding: spacing.lg,
    },
    articleRead: {
        opacity: 0.6,
    },
    articleFocused: {
        borderColor: colors.primary.DEFAULT,
        borderWidth: 2,
        padding: spacing.lg - 2, // Account for border to avoid jump
    },
    articleHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: spacing.sm,
    },
    feedName: {
        fontSize: 12,
        color: colors.secondary.DEFAULT,
        fontWeight: '500',
    },
    articleTitle: {
        fontSize: 17,
        fontWeight: '600',
        color: colors.text.primary,
        lineHeight: 24,
        marginBottom: spacing.sm,
    },
    articleTitleRead: {
        color: colors.text.secondary,
    },
    articleSummary: {
        fontSize: 14,
        color: colors.text.secondary,
        lineHeight: 20,
        marginBottom: spacing.sm,
    },
    articleMeta: {
        fontSize: 12,
        color: colors.text.tertiary,
    },
    separator: {
        height: spacing.md,
    },
    loader: {
        paddingVertical: spacing.xl,
    },
    empty: {
        alignItems: 'center',
        paddingVertical: 64,
    },
    emptyTitle: {
        fontSize: 20,
        fontWeight: '600',
        color: colors.text.primary,
        marginTop: spacing.lg,
    },
    emptyText: {
        fontSize: 14,
        color: colors.text.secondary,
        marginTop: spacing.sm,
    },
});
