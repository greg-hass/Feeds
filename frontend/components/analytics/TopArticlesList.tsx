import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { BookOpen } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useColors, spacing, typography, borderRadius } from '@/theme';
import { useAnalyticsStore, formatReadingTime } from '@/stores/analyticsStore';

/**
 * List of most-read articles with stats
 */
export function TopArticlesList() {
    const colors = useColors();
    const router = useRouter();
    const { topArticles } = useAnalyticsStore();

    const handleArticlePress = (articleId: number) => {
        router.push(`/(app)/article/${articleId}`);
    };

    const s = styles(colors);

    return (
        <View style={s.container}>
            <Text style={s.title}>Most Read Articles</Text>
            <Text style={s.subtitle}>Your top reads</Text>

            <ScrollView style={s.list} showsVerticalScrollIndicator={false}>
                {topArticles.map((article, idx) => (
                    <TouchableOpacity
                        key={article.article_id}
                        style={s.articleRow}
                        onPress={() => handleArticlePress(article.article_id)}
                    >
                        <View style={s.articleRank}>
                            <Text style={s.rankText}>{idx + 1}</Text>
                        </View>
                        <View style={s.articleInfo}>
                            <Text style={s.articleTitle} numberOfLines={2}>{article.title}</Text>
                            <Text style={s.articleSource}>{article.feed_title}</Text>
                            <Text style={s.articleStats}>
                                {formatReadingTime(article.total_read_time_seconds)} • Read {article.read_count}x • {Math.round(article.avg_scroll_depth)}% avg depth
                            </Text>
                        </View>
                    </TouchableOpacity>
                ))}
                {topArticles.length === 0 && (
                    <Text style={s.noData}>No reading data yet. Start reading!</Text>
                )}
            </ScrollView>
        </View>
    );
}

const styles = (colors: any) => StyleSheet.create({
    container: {
        backgroundColor: colors.background.elevated,
        borderRadius: borderRadius.lg,
        padding: spacing.lg,
        borderWidth: 1,
        borderColor: colors.border.DEFAULT,
        maxHeight: 500,
    },
    title: {
        ...typography.h3,
        color: colors.text.primary,
        marginBottom: spacing.xs,
    },
    subtitle: {
        ...typography.caption,
        color: colors.text.secondary,
        marginBottom: spacing.md,
    },
    list: {
        flex: 1,
    },
    articleRow: {
        flexDirection: 'row',
        paddingVertical: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.border.light,
        gap: spacing.sm,
    },
    articleRank: {
        width: 32,
        height: 32,
        borderRadius: borderRadius.full,
        backgroundColor: colors.background.secondary,
        justifyContent: 'center',
        alignItems: 'center',
    },
    rankText: {
        ...typography.caption,
        color: colors.text.secondary,
        fontWeight: '600',
    },
    articleInfo: {
        flex: 1,
    },
    articleTitle: {
        ...typography.body,
        color: colors.text.primary,
        marginBottom: spacing.xs,
        fontWeight: '500',
    },
    articleSource: {
        ...typography.small,
        color: colors.text.secondary,
        marginBottom: spacing.xs,
    },
    articleStats: {
        ...typography.small,
        color: colors.text.tertiary,
    },
    noData: {
        ...typography.body,
        color: colors.text.tertiary,
        textAlign: 'center',
        paddingVertical: spacing.lg,
    },
});
