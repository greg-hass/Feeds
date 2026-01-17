import { useEffect, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { formatDistanceToNow } from 'date-fns';
import { useArticleStore, useFeedStore } from '@/stores';
import { Article } from '@/services/api';
import { Circle, CircleCheck, Headphones, Filter } from 'lucide-react-native';
import { colors, borderRadius, spacing } from '@/theme';

export default function ArticleListScreen() {
    const router = useRouter();
    const { articles, isLoading, hasMore, filter, fetchArticles, setFilter } = useArticleStore();
    const { fetchFeeds, fetchFolders } = useFeedStore();

    useEffect(() => {
        fetchFeeds();
        fetchFolders();
        fetchArticles(true);
    }, []);

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

    const renderArticle = ({ item }: { item: Article }) => (
        <TouchableOpacity
            style={[styles.articleCard, item.is_read && styles.articleRead]}
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
                <Text style={styles.headerTitle}>Articles</Text>
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

            {/* List */}
            <FlatList
                data={articles}
                keyExtractor={(item) => String(item.id)}
                renderItem={renderArticle}
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
    headerTitle: {
        fontSize: 24,
        fontWeight: '700',
        color: colors.text.primary,
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
        opacity: 0.7,
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
