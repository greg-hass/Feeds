import { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, useWindowDimensions, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { formatDistanceToNow } from 'date-fns';
import { useArticleStore } from '@/stores';
import { ArrowLeft, ExternalLink, CircleCheck, Circle, Headphones } from 'lucide-react-native';

export default function ArticleDetailScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const router = useRouter();
    const { width } = useWindowDimensions();
    const { currentArticle, fetchArticle, markRead, markUnread } = useArticleStore();
    const [isLoading, setIsLoading] = useState(true);
    const [useReadability, setUseReadability] = useState(true);

    useEffect(() => {
        if (id) {
            setIsLoading(true);
            fetchArticle(parseInt(id, 10))
                .finally(() => setIsLoading(false));
        }
    }, [id]);

    const handleToggleRead = async () => {
        if (!currentArticle) return;
        if (currentArticle.is_read) {
            await markUnread(currentArticle.id);
        } else {
            await markRead(currentArticle.id);
        }
    };

    const handleOpenOriginal = () => {
        if (currentArticle?.url) {
            window.open(currentArticle.url, '_blank');
        }
    };

    if (isLoading) {
        return (
            <View style={styles.loading}>
                <ActivityIndicator size="large" color="#a3e635" />
            </View>
        );
    }

    if (!currentArticle) {
        return (
            <View style={styles.loading}>
                <Text style={styles.errorText}>Article not found</Text>
            </View>
        );
    }

    const content = useReadability && currentArticle.readability_content
        ? currentArticle.readability_content
        : currentArticle.content;

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <ArrowLeft size={24} color="#fafafa" />
                </TouchableOpacity>

                <View style={styles.headerActions}>
                    <TouchableOpacity onPress={handleToggleRead} style={styles.actionButton}>
                        {currentArticle.is_read ? (
                            <CircleCheck size={22} color="#a3e635" />
                        ) : (
                            <Circle size={22} color="#a1a1aa" />
                        )}
                    </TouchableOpacity>

                    {currentArticle.url && (
                        <TouchableOpacity onPress={handleOpenOriginal} style={styles.actionButton}>
                            <ExternalLink size={22} color="#a1a1aa" />
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            <ScrollView style={styles.scrollView} contentContainerStyle={[
                styles.contentContainer,
                { maxWidth: Math.min(width, 720), alignSelf: 'center', width: '100%' }
            ]}>
                {/* Article meta */}
                <View style={styles.meta}>
                    <Text style={styles.feedTitle}>{currentArticle.feed_title}</Text>
                    {currentArticle.published_at && (
                        <Text style={styles.timestamp}>
                            {formatDistanceToNow(new Date(currentArticle.published_at), { addSuffix: true })}
                        </Text>
                    )}
                </View>

                {/* Title */}
                <Text style={styles.title}>{currentArticle.title}</Text>

                {/* Author */}
                {currentArticle.author && (
                    <Text style={styles.author}>By {currentArticle.author}</Text>
                )}

                {/* Audio player for podcasts */}
                {currentArticle.has_audio && currentArticle.enclosure_url && (
                    <View style={styles.audioPlayer}>
                        <Headphones size={20} color="#a3e635" />
                        <audio
                            controls
                            src={currentArticle.enclosure_url}
                            style={{ flex: 1, marginLeft: 12 }}
                        />
                    </View>
                )}

                {/* Content toggle */}
                {currentArticle.readability_content && currentArticle.content && (
                    <View style={styles.toggleRow}>
                        <TouchableOpacity
                            style={[styles.toggleButton, useReadability && styles.toggleButtonActive]}
                            onPress={() => setUseReadability(true)}
                        >
                            <Text style={[styles.toggleText, useReadability && styles.toggleTextActive]}>Clean</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.toggleButton, !useReadability && styles.toggleButtonActive]}
                            onPress={() => setUseReadability(false)}
                        >
                            <Text style={[styles.toggleText, !useReadability && styles.toggleTextActive]}>Original</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {/* Article content */}
                {content ? (
                    <View style={styles.articleContent}>
                        <div
                            dangerouslySetInnerHTML={{ __html: content }}
                            style={{
                                color: '#e4e4e7',
                                fontSize: 17,
                                lineHeight: 1.7,
                                fontFamily: 'Georgia, serif',
                            }}
                        />
                    </View>
                ) : (
                    <Text style={styles.noContent}>No content available</Text>
                )}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#18181b',
    },
    loading: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#18181b',
    },
    errorText: {
        color: '#71717a',
        fontSize: 16,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#27272a',
    },
    backButton: {
        padding: 8,
        marginLeft: -8,
    },
    headerActions: {
        flexDirection: 'row',
        gap: 12,
    },
    actionButton: {
        padding: 8,
    },
    scrollView: {
        flex: 1,
    },
    contentContainer: {
        padding: 24,
        paddingBottom: 100,
    },
    meta: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    feedTitle: {
        fontSize: 14,
        color: '#a3e635',
        fontWeight: '500',
    },
    timestamp: {
        fontSize: 13,
        color: '#71717a',
    },
    title: {
        fontSize: 28,
        fontWeight: '700',
        color: '#fafafa',
        lineHeight: 36,
        marginBottom: 12,
    },
    author: {
        fontSize: 15,
        color: '#a1a1aa',
        marginBottom: 24,
    },
    audioPlayer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#27272a',
        borderRadius: 12,
        padding: 16,
        marginBottom: 24,
    },
    toggleRow: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 24,
    },
    toggleButton: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 8,
        backgroundColor: '#27272a',
    },
    toggleButtonActive: {
        backgroundColor: '#a3e635',
    },
    toggleText: {
        fontSize: 14,
        color: '#a1a1aa',
    },
    toggleTextActive: {
        color: '#18181b',
        fontWeight: '600',
    },
    articleContent: {
        // Styles applied via dangerouslySetInnerHTML
    },
    noContent: {
        fontSize: 16,
        color: '#71717a',
        fontStyle: 'italic',
    },
});
