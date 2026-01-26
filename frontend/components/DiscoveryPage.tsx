import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, Image, Animated, Platform, useWindowDimensions } from 'react-native';
import { api, Recommendation, Interest, ApiError } from '@/services/api';
import { Sparkles, X, ChevronRight, Plus, RefreshCw, LayoutGrid, Zap, Newspaper, Youtube, Menu } from 'lucide-react-native';
import { useFeedStore, useToastStore, useSettingsStore } from '@/stores';
import { useColors, spacing, borderRadius } from '@/theme';
import Sidebar from '@/components/Sidebar';
import { ErrorView } from '@/components/ErrorView';

export const DiscoveryPage = () => {
    const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
    const [interests, setInterests] = useState<Interest[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [subscribingIds, setSubscribingIds] = useState<Set<number>>(new Set());
    const [showMenu, setShowMenu] = useState(false);
    const [sidebarAnim] = useState(() => new Animated.Value(-300));
    const colors = useColors();
    const { width } = useWindowDimensions();
    const isMobile = width < 1024;
    const { addFeed } = useFeedStore();
    const { show: showToast } = useToastStore();
    const { settings } = useSettingsStore();

    const [fadeAnim] = useState(() => new Animated.Value(0));

    const fetchData = async () => {
        setIsLoading(true);
        setError(null);
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
            setError('Failed to load recommendations. Please check your connection.');
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
        // Prevent double-tap
        if (subscribingIds.has(rec.id)) return;

        // Optimistic UI: Show immediate feedback
        setSubscribingIds(prev => new Set(prev).add(rec.id));
        showToast(`Subscribing to ${rec.title}…`, 'success');

        try {
            await addFeed(rec.feed_url, undefined, settings?.refresh_interval_minutes, false);
            // Remove from list after successful subscription
            setRecommendations(prev => prev.filter(r => r.id !== rec.id));
        } catch (error) {
            if (error instanceof ApiError && error.status === 409) {
                // Already subscribed - just remove from list
                setRecommendations(prev => prev.filter(r => r.id !== rec.id));
                showToast(`Already subscribed to ${rec.title}`, 'info');
            } else {
                const message = error instanceof Error ? error.message : 'Failed to subscribe';
                showToast(message, 'error');
            }
        } finally {
            setSubscribingIds(prev => {
                const next = new Set(prev);
                next.delete(rec.id);
                return next;
            });
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

    const toggleMenu = () => {
        setShowMenu(!showMenu);
        Animated.timing(sidebarAnim, {
            toValue: showMenu ? -300 : 0,
            duration: 250,
            useNativeDriver: true,
        }).start();
    };

    const s = styles(colors, isMobile);

    if (isLoading) {
        return (
            <View style={s.center}>
                <ActivityIndicator size="large" color={colors.primary.DEFAULT} />
            </View>
        );
    }

    if (error) {
        return (
            <ErrorView 
                message={error} 
                onRetry={fetchData} 
            />
        );
    }

    return (
        <View style={s.container}>
            {/* Header matching other pages */}
            <View style={s.header}>
                <View style={s.headerLeft}>
                    <Text style={s.headerTitle}>Discover</Text>
                </View>
                <View style={s.headerActions}>
                    <TouchableOpacity
                        onPress={handleRefresh}
                        style={s.iconButton}
                        disabled={isRefreshing}
                        accessibilityLabel="Refresh recommendations"
                        accessibilityRole="button"
                    >
                        {isRefreshing ? (
                            <ActivityIndicator size={18} color={colors.primary.DEFAULT} />
                        ) : (
                            <RefreshCw size={20} color={colors.text.secondary} />
                        )}
                    </TouchableOpacity>
                </View>
            </View>

            <ScrollView style={s.scrollView} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>

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
                                    <Image source={{ uri: metadata.thumbnail }} style={s.thumbnail} accessibilityLabel={`${rec.title} thumbnail`} />
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
                                        disabled={subscribingIds.has(rec.id)}
                                    >
                                        {subscribingIds.has(rec.id) ? (
                                            <View style={s.loadingContent}>
                                                <ActivityIndicator size="small" color="#fff" />
                                            </View>
                                        ) : (
                                            <>
                                                <Plus size={18} color="#fff" strokeWidth={3} />
                                                <Text style={s.subscribeText}>Subscribe</Text>
                                            </>
                                        )}
                                    </TouchableOpacity>
                                </View>
                            </View>
                        );
                    })}
                </Animated.View>
            )}
            </ScrollView>

            {/* Mobile menu button */}
            {isMobile && (
                <>
                    <TouchableOpacity onPress={toggleMenu} style={s.mobileMenuButton} accessibilityLabel="Open menu">
                        <Menu size={24} color={colors.text.primary} />
                    </TouchableOpacity>

                    {/* Backdrop */}
                    {showMenu && (
                        <TouchableOpacity
                            style={s.sidebarBackdrop}
                            activeOpacity={1}
                            onPress={toggleMenu}
                        />
                    )}
                    {/* Sidebar */}
                    <Animated.View
                        style={[
                            s.sidebarContainer,
                            {
                                transform: [{ translateX: sidebarAnim }],
                                width: 280,
                            },
                        ]}
                    >
                        <View style={{ alignItems: 'flex-end', padding: spacing.md }}>
                            <TouchableOpacity onPress={toggleMenu} style={{ padding: spacing.sm }} accessibilityLabel="Close menu">
                                <X size={24} color={colors.text.primary} />
                            </TouchableOpacity>
                        </View>
                        <Sidebar onNavigate={toggleMenu} />
                    </Animated.View>
                </>
            )}
        </View>
    );
};

const styles = (colors: any, isMobile: boolean = false) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background.primary,
    },
    scrollView: {
        flex: 1,
    },
    content: {
        padding: spacing.lg,
        paddingBottom: 60,
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
        alignItems: 'center',
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.lg,
        paddingBottom: spacing.md,
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        marginLeft: isMobile ? 40 : 0,
    },
    headerTitle: {
        fontSize: 22,
        fontWeight: '900',
        color: colors.text.primary,
        letterSpacing: -0.5,
    },
    headerActions: {
        flexDirection: 'row',
        gap: spacing.sm,
    },
    iconButton: {
        padding: spacing.sm,
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
        minHeight: 46,
    },
    loadingContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        flex: 1,
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
    mobileMenuButton: {
        position: 'absolute',
        top: spacing.md,
        left: spacing.md,
        zIndex: 100,
        padding: 8,
        backgroundColor: colors.background.elevated,
        borderRadius: borderRadius.full,
        shadowColor: '#000',
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    sidebarBackdrop: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        zIndex: 900,
    },
    sidebarContainer: {
        position: 'absolute',
        top: 0,
        left: 0,
        bottom: 0,
        backgroundColor: colors.background.elevated,
        borderRightWidth: 1,
        borderRightColor: colors.border.DEFAULT,
        zIndex: 1000,
        shadowColor: '#000',
        shadowOffset: { width: 2, height: 0 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
        elevation: 5,
    },
});
