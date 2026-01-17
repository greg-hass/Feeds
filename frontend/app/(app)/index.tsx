import { useEffect, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { formatDistanceToNow } from 'date-fns';
import { useArticleStore, useFeedStore } from '@/stores';
import { Article } from '@/services/api';
import { Circle, CheckCircle, Headphones, Play, ExternalLink } from 'lucide-react-native';

export default function ArticleListScreen() {
    const router = useRouter();
    const { articles, isLoading, hasMore, filter, fetchArticles, setFilter } = useArticleStore();
    const { totalUnread } = useFeedStore();

    useEffect(() => {
        fetchArticles(true);
    }, []);

    const handleRefresh = useCallback(() => {
        fetchArticles(true);
    }, []);

    const handleLoadMore = useCallback(() => {
        if (hasMore && !isLoading) {
            fetchArticles();
        }
    }, [hasMore, isLoading]);

    const handleArticlePress = (article: Article) => {
        router.push(`/(app)/article/${article.id}`);
    };

    const renderArticle = ({ item }: { item: Article }) => (
        <TouchableOpacity
            style={[styles.article, item.is_read && styles.articleRead]}
            onPress={() => handleArticlePress(item)}
            activeOpacity={0.7}
        >
            <View style={styles.articleHeader}>
                <View style={styles.feedInfo}>
                    {item.feed_icon_url ? (
                        <Image source={{ uri: item.feed_icon_url }} style={styles.feedIcon} />
                    ) : (
                        <View style={[styles.feedIcon, styles.feedIconPlaceholder]} />
                    )}
                    <Text style={styles.feedTitle} numberOfLines={1}>{item.feed_title}</Text>
                    {item.has_audio && <Headphones size={14} color="#a3e635" />}
                </View>
                <View style={styles.readIndicator}>
                    {item.is_read ? (
                        <CheckCircle size={18} color="#52525b" />
                    ) : (
                        <Circle size={18} color="#a3e635" fill="#a3e635" />
                    )}
                </View>
            </View>

            <Text style={[styles.articleTitle, item.is_read && styles.textRead]} numberOfLines={2}>
                {item.title}
            </Text>

            {item.summary && (
                <Text style={[styles.articleSummary, item.is_read && styles.textRead]} numberOfLines={2}>
                    {item.summary}
                </Text>
            )}

            <View style={styles.articleFooter}>
                {item.author && (
                    <Text style={styles.author} numberOfLines={1}>
                        {item.author}
                    </Text>
                )}
                {item.published_at && (
                    <Text style={styles.timestamp}>
                        {formatDistanceToNow(new Date(item.published_at), { addSuffix: true })}
                    </Text>
                )}
            </View>
        </TouchableOpacity>
    );

    const renderHeader = () => (
        <View style={styles.header}>
            <Text style={styles.headerTitle}>
                {filter.feed_id ? 'Feed' : filter.folder_id ? 'Folder' : filter.type ? filter.type.toUpperCase() : 'All Articles'}
            </Text>
            <View style={styles.filterRow}>
                <TouchableOpacity
                    style={[styles.filterChip, filter.unread_only && styles.filterChipActive]}
                    onPress={() => setFilter({ unread_only: !filter.unread_only })}
                >
                    <Text style={[styles.filterChipText, filter.unread_only && styles.filterChipTextActive]}>
                        Unread ({totalUnread})
                    </Text>
                </TouchableOpacity>
            </View>
        </View>
    );

    return (
        <View style={styles.container}>
            <FlatList
                data={articles}
                keyExtractor={(item) => String(item.id)}
                renderItem={renderArticle}
                ListHeaderComponent={renderHeader}
                refreshControl={
                    <RefreshControl
                        refreshing={isLoading}
                        onRefresh={handleRefresh}
                        tintColor="#a3e635"
                    />
                }
                onEndReached={handleLoadMore}
                onEndReachedThreshold={0.5}
                contentContainerStyle={styles.list}
                ItemSeparatorComponent={() => <View style={styles.separator} />}
                ListEmptyComponent={
                    !isLoading ? (
                        <View style={styles.empty}>
                            <Text style={styles.emptyText}>
                                {filter.unread_only ? 'All caught up!' : 'No articles yet'}
                            </Text>
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
        backgroundColor: '#18181b',
    },
    list: {
        padding: 16,
        paddingBottom: 100,
    },
    header: {
        marginBottom: 16,
    },
    headerTitle: {
        fontSize: 28,
        fontWeight: '700',
        color: '#fafafa',
        marginBottom: 12,
    },
    filterRow: {
        flexDirection: 'row',
        gap: 8,
    },
    filterChip: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        backgroundColor: '#27272a',
        borderWidth: 1,
        borderColor: '#3f3f46',
    },
    filterChipActive: {
        backgroundColor: '#a3e635',
        borderColor: '#a3e635',
    },
    filterChipText: {
        fontSize: 14,
        color: '#a1a1aa',
    },
    filterChipTextActive: {
        color: '#18181b',
        fontWeight: '600',
    },
    article: {
        backgroundColor: '#27272a',
        borderRadius: 12,
        padding: 16,
    },
    articleRead: {
        opacity: 0.7,
    },
    articleHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    feedInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        flex: 1,
    },
    feedIcon: {
        width: 20,
        height: 20,
        borderRadius: 4,
    },
    feedIconPlaceholder: {
        backgroundColor: '#3f3f46',
    },
    feedTitle: {
        fontSize: 13,
        color: '#a1a1aa',
        flex: 1,
    },
    readIndicator: {
        marginLeft: 8,
    },
    articleTitle: {
        fontSize: 17,
        fontWeight: '600',
        color: '#fafafa',
        lineHeight: 24,
        marginBottom: 6,
    },
    articleSummary: {
        fontSize: 14,
        color: '#a1a1aa',
        lineHeight: 20,
        marginBottom: 8,
    },
    textRead: {
        color: '#71717a',
    },
    articleFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    author: {
        fontSize: 12,
        color: '#71717a',
        flex: 1,
    },
    timestamp: {
        fontSize: 12,
        color: '#52525b',
    },
    separator: {
        height: 12,
    },
    empty: {
        alignItems: 'center',
        paddingVertical: 48,
    },
    emptyText: {
        fontSize: 16,
        color: '#71717a',
    },
});
