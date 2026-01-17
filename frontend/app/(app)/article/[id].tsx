import { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Linking } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { formatDistanceToNow } from 'date-fns';
import { useArticleStore } from '@/stores';
import { ArrowLeft, ExternalLink, Circle, CircleCheck, Headphones, BookOpen } from 'lucide-react-native';
import { colors, borderRadius, spacing } from '@/theme';

export default function ArticleScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const router = useRouter();
    const { currentArticle, fetchArticle, markRead, markUnread } = useArticleStore();
    const [isLoading, setIsLoading] = useState(true);
    const [showReadability, setShowReadability] = useState(false);

    useEffect(() => {
        if (id) {
            setIsLoading(true);
            fetchArticle(Number(id))
                .then(() => markRead(Number(id)))
                .finally(() => setIsLoading(false));
        }
    }, [id]);

    if (isLoading || !currentArticle) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.primary.DEFAULT} />
            </View>
        );
    }

    const content = showReadability && currentArticle.readability_content
        ? currentArticle.readability_content
        : currentArticle.content;

    const handleOpenExternal = () => {
        if (currentArticle.url) {
            Linking.openURL(currentArticle.url);
        }
    };

    const handleToggleRead = () => {
        if (currentArticle.is_read) {
            markUnread(currentArticle.id);
        } else {
            markRead(currentArticle.id);
        }
    };

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <ArrowLeft size={24} color={colors.text.primary} />
                </TouchableOpacity>

                <View style={styles.headerActions}>
                    <TouchableOpacity onPress={handleToggleRead} style={styles.actionButton}>
                        {currentArticle.is_read ? (
                            <CircleCheck size={22} color={colors.primary.DEFAULT} />
                        ) : (
                            <Circle size={22} color={colors.text.secondary} />
                        )}
                    </TouchableOpacity>

                    {currentArticle.readability_content && (
                        <TouchableOpacity
                            onPress={() => setShowReadability(!showReadability)}
                            style={[styles.actionButton, showReadability && styles.actionButtonActive]}
                        >
                            <BookOpen size={22} color={showReadability ? colors.primary.DEFAULT : colors.text.secondary} />
                        </TouchableOpacity>
                    )}

                    {currentArticle.url && (
                        <TouchableOpacity onPress={handleOpenExternal} style={styles.actionButton}>
                            <ExternalLink size={22} color={colors.text.secondary} />
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
                {/* Article Meta */}
                <Text style={styles.feedName}>{currentArticle.feed_title}</Text>
                <Text style={styles.title}>{currentArticle.title}</Text>

                <View style={styles.meta}>
                    {currentArticle.author && (
                        <Text style={styles.author}>{currentArticle.author}</Text>
                    )}
                    {currentArticle.published_at && (
                        <Text style={styles.date}>
                            {formatDistanceToNow(new Date(currentArticle.published_at), { addSuffix: true })}
                        </Text>
                    )}
                </View>

                {/* Audio Player for Podcasts */}
                {currentArticle.has_audio && currentArticle.enclosure_url && (
                    <TouchableOpacity
                        style={styles.audioPlayer}
                        onPress={() => Linking.openURL(currentArticle.enclosure_url!)}
                    >
                        <Headphones size={20} color={colors.secondary.DEFAULT} />
                        <Text style={styles.audioText}>Play Episode</Text>
                    </TouchableOpacity>
                )}

                {/* Content */}
                <View style={styles.articleContent}>
                    <Text style={styles.contentText}>
                        {content || currentArticle.summary || 'No content available'}
                    </Text>
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
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
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
    backButton: {
        padding: spacing.sm,
        marginLeft: -spacing.sm,
    },
    headerActions: {
        flexDirection: 'row',
        gap: spacing.md,
    },
    actionButton: {
        padding: spacing.sm,
    },
    actionButtonActive: {
        backgroundColor: colors.background.secondary,
        borderRadius: borderRadius.md,
    },
    scrollView: {
        flex: 1,
    },
    content: {
        padding: spacing.xl,
        paddingBottom: 64,
    },
    feedName: {
        fontSize: 13,
        color: colors.secondary.DEFAULT,
        fontWeight: '600',
        marginBottom: spacing.sm,
    },
    title: {
        fontSize: 26,
        fontWeight: '700',
        color: colors.text.primary,
        lineHeight: 34,
        marginBottom: spacing.md,
    },
    meta: {
        flexDirection: 'row',
        gap: spacing.sm,
        marginBottom: spacing.xl,
    },
    author: {
        fontSize: 14,
        color: colors.text.secondary,
    },
    date: {
        fontSize: 14,
        color: colors.text.tertiary,
    },
    audioPlayer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        backgroundColor: colors.background.secondary,
        padding: spacing.lg,
        borderRadius: borderRadius.lg,
        marginBottom: spacing.xl,
        borderWidth: 1,
        borderColor: colors.secondary.DEFAULT,
    },
    audioText: {
        fontSize: 15,
        fontWeight: '500',
        color: colors.secondary.DEFAULT,
    },
    articleContent: {
        paddingTop: spacing.md,
    },
    contentText: {
        fontSize: 17,
        color: colors.text.primary,
        lineHeight: 28,
    },
});
