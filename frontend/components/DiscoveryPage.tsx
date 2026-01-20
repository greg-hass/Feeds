import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, Image, Animated, Platform } from 'react-native';
import { api, Recommendation, Interest, ApiError } from '@/services/api';
import { Sparkles, X, ChevronRight, Plus, RefreshCw, LayoutGrid, Zap, Newspaper, Youtube } from 'lucide-react-native';
import { useFeedStore, useToastStore, useSettingsStore } from '@/stores';
import { useColors, spacing, borderRadius } from '@/theme';

export const DiscoveryPage = () => {
    const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
    const [interests, setInterests] = useState<Interest[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const colors = useColors();
    const { addFeed } = useFeedStore();
    const { show: showToast } = useToastStore();
    const { settings } = useSettingsStore();

    const fadeAnim = useRef(new Animated.Value(0)).current;

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const [recRes, intRes] = await Promise.all([
                api.getRecommendations(),
                api.getInterests()
            ]);
            setRecommendations(recRes.recommendations);
            setInterests(intRes.interests);

            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 600,
                useNativeDriver: true,
            }).start();
        } catch (error) {
            console.error('Failed to fetch discovery data:', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleRefresh = async () => {
        setIsRefreshing(true);
        try {
            const res = await api.refreshRecommendations();
            setRecommendations(res.recommendations);
            showToast('Recommendations refreshed!', 'success');
        } catch (error) {
            showToast('Failed to refresh recommendations', 'error');
        } finally {
            setIsRefreshing(false);
        }
    };

    const handleSubscribe = async (rec: Recommendation) => {
        try {
            await addFeed(rec.feed_url, undefined, settings?.refresh_interval_minutes, false);
            setRecommendations(prev => prev.filter(r => r.id !== rec.id));
            showToast(`Subscribed to ${rec.title}`, 'success');
        } catch (error) {
            if (error instanceof ApiError && error.status === 409) {
                setRecommendations(prev => prev.filter(r => r.id !== rec.id));
                showToast(`Already subscribed to ${rec.title}`, 'info');
                return;
            }
            const message = error instanceof Error ? error.message : 'Failed to subscribe';
            showToast(message, 'error');
        }
    };

    const handleDismiss = async (id: number) => {
        try {
            await api.dismissRecommendation(id);
            setRecommendations(prev => prev.filter(r => r.id !== id));
        } catch (error) {
            showToast('Failed to dismiss', 'error');
        }
    };

    const s = styles(colors);

    if (isLoading) {
        return (
            <View style={s.center}>
                <ActivityIndicator size="large" color={colors.primary.DEFAULT} />
            </View>
        );
    }

    return (
        <ScrollView style={s.container} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
            <View style={s.header}>
                <View>
                    <View style={s.headerBadge}>
                        <Zap size={12} color={colors.primary.DEFAULT} fill={colors.primary.DEFAULT} />
                        <Text style={s.badgeText}>SMART RECOMMENDATIONS</Text>
                    </View>
                    <Text style={s.title}>Discovery</Text>
                    <Text style={s.subtitle}>AI-curated feeds matching your reading habits</Text>
                </View>
                <TouchableOpacity
                    onPress={handleRefresh}
                    disabled={isRefreshing}
                    style={s.refreshButton}
                >
                    {isRefreshing ? (
                        <ActivityIndicator size="small" color={colors.primary.DEFAULT} />
                    ) : (
                        <RefreshCw size={24} color={colors.primary.DEFAULT} />
                    )}
                </TouchableOpacity>
            </View>

            {interests.length > 0 && (
                <View style={s.interestsContainer}>
                    <Text style={s.sectionHeader}>TAILORED TOPICS</Text>
                    <View style={s.interestsList}>
                        {interests.map((int, i) => (
                            <View key={i} style={s.interestTag}>
                                <Text style={s.interestText}>{int.topic}</Text>
                            </View>
                        ))}
                    </View>
                </View>
            )}

            <View style={s.sectionHeaderRow}>
                <Text style={s.sectionHeader}>RECOMMENDED FOR YOU</Text>
                <LayoutGrid size={16} color={colors.text.tertiary} />
            </View>

            {recommendations.length === 0 ? (
                <View style={s.emptyContainer}>
                    <Sparkles size={64} color={colors.text.tertiary} />
                    <Text style={s.emptyText}>All caught up! Check back later for more tailored recommendations.</Text>
                </View>
            ) : (
                <Animated.View style={{ opacity: fadeAnim }}>
                    {recommendations.map((rec) => {
                        const metadata = JSON.parse(rec.metadata || '{}');
                        return (
                            <View key={rec.id} style={s.card}>
                                <View style={s.cardHeader}>
                                    {metadata.thumbnail ? (
                                        <Image source={{ uri: metadata.thumbnail }} style={s.thumbnail} />
                                    ) : (
                                        <View style={[s.thumbnailPlaceholder, { backgroundColor: rec.feed_type === 'youtube' ? colors.feedTypes.youtube : colors.primary.DEFAULT }]}>
                                            {rec.feed_type === 'youtube' ? <Youtube size={24} color="#FFF" /> : <Newspaper size={24} color="#FFF" />}
                                        </View>
                                    )}
                                    <View style={s.cardTitles}>
                                        <Text style={s.cardTitle} numberOfLines={1}>{rec.title}</Text>
                                        <View style={s.scoreRow}>
                                            <View style={s.scoreIndicator}>
                                                <View style={[s.scoreBar, { width: `${rec.relevance_score}%` }]} />
                                            </View>
                                            <Text style={s.scoreText}>{Math.round(rec.relevance_score)}% Match</Text>
                                        </View>
                                    </View>
                                </View>

                                <Text style={s.description} numberOfLines={3}>
                                    {rec.description || 'No description available for this source.'}
                                </Text>

                                <View style={[s.reasonBox, { backgroundColor: colors.background.tertiary }]}>
                                    <Sparkles size={16} color={colors.primary.DEFAULT} />
                                    <Text style={s.reasonText}>{rec.reason}</Text>
                                </View>

                                <View style={s.actions}>
                                    <TouchableOpacity
                                        style={s.dismissButton}
                                        onPress={() => handleDismiss(rec.id)}
                                    >
                                        <X size={18} color={colors.text.tertiary} />
                                        <Text style={s.dismissText}>Dismiss</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={s.subscribeButton}
                                        onPress={() => handleSubscribe(rec)}
                                    >
                                        <Plus size={18} color="#fff" strokeWidth={3} />
                                        <Text style={s.subscribeText}>Subscribe</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        );
                    })}
                </Animated.View>
            )}
        </ScrollView>
    );
};

const styles = (colors: any) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background.primary,
    },
    content: {
        padding: spacing.xl,
        paddingBottom: 60,
        maxWidth: 900,
        alignSelf: 'center',
        width: '100%',
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: spacing.xl,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: spacing.xxl,
    },
    headerBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: colors.primary.DEFAULT + '15',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: borderRadius.sm,
        marginBottom: spacing.sm,
    },
    badgeText: {
        fontSize: 10,
        fontWeight: '900',
        color: colors.primary.DEFAULT,
        letterSpacing: 1,
    },
    title: {
        fontSize: 40,
        fontWeight: '900',
        color: colors.text.primary,
        letterSpacing: -1.5,
    },
    subtitle: {
        fontSize: 16,
        color: colors.text.tertiary,
        marginTop: 4,
        fontWeight: '600',
    },
    refreshButton: {
        padding: spacing.md,
        borderRadius: borderRadius.xl,
        backgroundColor: colors.background.elevated,
        borderWidth: 1,
        borderColor: colors.border.DEFAULT,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 2,
    },
    sectionHeader: {
        fontSize: 12,
        fontWeight: '900',
        color: colors.text.tertiary,
        letterSpacing: 1.5,
        marginBottom: spacing.lg,
    },
    sectionHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.lg,
        marginTop: spacing.xl,
    },
    interestsContainer: {
        marginBottom: spacing.xl,
    },
    interestsList: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
    },
    interestTag: {
        backgroundColor: colors.background.elevated,
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: borderRadius.lg,
        borderWidth: 1,
        borderColor: colors.border.DEFAULT,
    },
    interestText: {
        fontSize: 14,
        fontWeight: '800',
        color: colors.text.primary,
    },
    card: {
        backgroundColor: colors.background.elevated,
        borderRadius: borderRadius.xxl,
        padding: spacing.xl,
        marginBottom: spacing.xl,
        borderWidth: 1,
        borderColor: colors.border.DEFAULT,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.08,
        shadowRadius: 20,
        elevation: 4,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: spacing.lg,
    },
    thumbnail: {
        width: 60,
        height: 60,
        borderRadius: borderRadius.lg,
    },
    thumbnailPlaceholder: {
        width: 60,
        height: 60,
        borderRadius: borderRadius.lg,
        justifyContent: 'center',
        alignItems: 'center',
    },
    cardTitles: {
        flex: 1,
        marginLeft: spacing.lg,
    },
    cardTitle: {
        fontSize: 22,
        fontWeight: '900',
        color: colors.text.primary,
        letterSpacing: -0.5,
    },
    scoreRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 8,
        gap: 12,
    },
    scoreIndicator: {
        width: 80,
        height: 6,
        backgroundColor: colors.background.tertiary,
        borderRadius: 3,
        overflow: 'hidden',
    },
    scoreBar: {
        height: '100%',
        backgroundColor: colors.primary.DEFAULT,
    },
    scoreText: {
        fontSize: 12,
        fontWeight: '800',
        color: colors.primary.DEFAULT,
    },
    description: {
        fontSize: 16,
        color: colors.text.secondary,
        lineHeight: 24,
        marginBottom: spacing.xl,
        fontWeight: '400',
    },
    reasonBox: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        padding: spacing.lg,
        borderRadius: borderRadius.lg,
        marginBottom: spacing.xl,
        gap: 12,
        borderWidth: 1,
        borderColor: colors.border.DEFAULT,
    },
    reasonText: {
        flex: 1,
        fontSize: 14,
        color: colors.text.primary,
        fontWeight: '600',
        lineHeight: 20,
    },
    actions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        alignItems: 'center',
        gap: spacing.lg,
    },
    dismissButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 16,
        paddingVertical: 10,
    },
    dismissText: {
        color: colors.text.tertiary,
        fontWeight: '800',
        fontSize: 15,
    },
    subscribeButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: colors.primary.DEFAULT,
        paddingHorizontal: 32,
        paddingVertical: 14,
        borderRadius: borderRadius.full,
        shadowColor: colors.primary.DEFAULT,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
        elevation: 6,
    },
    subscribeText: {
        color: '#fff',
        fontWeight: '900',
        fontSize: 16,
    },
    emptyContainer: {
        alignItems: 'center',
        paddingVertical: 100,
        gap: 24,
    },
    emptyText: {
        fontSize: 16,
        color: colors.text.tertiary,
        textAlign: 'center',
        fontWeight: '600',
        maxWidth: 280,
        lineHeight: 24,
    },
});
