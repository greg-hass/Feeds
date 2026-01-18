import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, useColorScheme, Image } from 'react-native';
import { api, Recommendation, Interest } from '@/services/api';
import { Ionicons } from '@expo/vector-icons';
import { useFeedStore, useToastStore } from '@/stores';

export const DiscoveryPage = () => {
    const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
    const [interests, setInterests] = useState<Interest[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const isDark = useColorScheme() === 'dark';
    const { addFeed } = useFeedStore();
    const { show: showToast } = useToastStore();

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const [recRes, intRes] = await Promise.all([
                api.getRecommendations(),
                api.getInterests()
            ]);
            setRecommendations(recRes.recommendations);
            setInterests(intRes.interests);
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
            await addFeed(rec.feed_url);
            setRecommendations(prev => prev.filter(r => r.id !== rec.id));
            showToast(`Subscribed to ${rec.title}`, 'success');
        } catch (error) {
            showToast('Failed to subscribe', 'error');
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

    if (isLoading) {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" color="#007AFF" />
            </View>
        );
    }

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            <View style={styles.header}>
                <View>
                    <Text style={[styles.title, isDark && styles.darkText]}>Discover</Text>
                    <Text style={styles.subtitle}>Personalized for your interests</Text>
                </View>
                <TouchableOpacity onPress={handleRefresh} disabled={isRefreshing}>
                    {isRefreshing ? <ActivityIndicator size="small" color="#007AFF" /> : <Ionicons name="refresh" size={24} color="#007AFF" />}
                </TouchableOpacity>
            </View>

            {interests.length > 0 && (
                <View style={styles.interestsContainer}>
                    <Text style={[styles.sectionTitle, isDark && styles.darkText]}>Your Interests</Text>
                    <View style={styles.interestsList}>
                        {interests.map((int, i) => (
                            <View key={i} style={[styles.interestTag, isDark && styles.darkTag]}>
                                <Text style={[styles.interestText, isDark && styles.darkText]}>{int.topic}</Text>
                            </View>
                        ))}
                    </View>
                </View>
            )}

            <Text style={[styles.sectionTitle, isDark && styles.darkText]}>Recommended Feeds</Text>

            {recommendations.length === 0 ? (
                <View style={styles.emptyContainer}>
                    <Ionicons name="sparkles-outline" size={48} color="#8E8E93" />
                    <Text style={styles.emptyText}>No recommendations yet. Refresh to find some!</Text>
                </View>
            ) : (
                recommendations.map((rec) => {
                    const metadata = JSON.parse(rec.metadata || '{}');
                    return (
                        <View key={rec.id} style={[styles.card, isDark && styles.darkCard]}>
                            <View style={styles.cardHeader}>
                                {metadata.thumbnail ? (
                                    <Image source={{ uri: metadata.thumbnail }} style={styles.thumbnail} />
                                ) : (
                                    <View style={styles.thumbnailPlaceholder}>
                                        <Ionicons name={rec.feed_type === 'youtube' ? 'logo-youtube' : 'document-text-outline'} size={24} color="#FFF" />
                                    </View>
                                )}
                                <View style={styles.cardTitles}>
                                    <Text style={[styles.cardTitle, isDark && styles.darkText]} numberOfLines={1}>{rec.title}</Text>
                                    <View style={styles.scoreRow}>
                                        <Text style={styles.score}>{Math.round(rec.relevance_score)}% Match</Text>
                                        {metadata.subs && <Text style={styles.subs}> • {metadata.subs} subs</Text>}
                                    </View>
                                </View>
                            </View>

                            <Text style={[styles.description, isDark && styles.darkSubtext]} numberOfLines={2}>
                                {rec.description || 'No description available.'}
                            </Text>

                            <View style={styles.reasonBox}>
                                <Ionicons name="bulb-outline" size={14} color="#007AFF" />
                                <Text style={styles.reasonText}>{rec.reason}</Text>
                            </View>

                            <View style={styles.actions}>
                                <TouchableOpacity style={styles.dismissButton} onPress={() => handleDismiss(rec.id)}>
                                    <Text style={styles.dismissText}>Dismiss</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.subscribeButton} onPress={() => handleSubscribe(rec)}>
                                    <Text style={styles.subscribeText}>Subscribe</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    );
                })
            )}
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    content: {
        padding: 16,
        paddingBottom: 40,
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24,
    },
    title: {
        fontSize: 32,
        fontWeight: 'bold',
        color: '#000',
    },
    subtitle: {
        fontSize: 16,
        color: '#8E8E93',
        marginTop: 4,
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 16,
        marginTop: 8,
    },
    interestsContainer: {
        marginBottom: 24,
    },
    interestsList: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    interestTag: {
        backgroundColor: '#E5E5EA',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
    },
    darkTag: {
        backgroundColor: '#3A3A3C',
    },
    interestText: {
        fontSize: 14,
        color: '#3A3A3C',
    },
    card: {
        backgroundColor: '#FFF',
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 3,
    },
    darkCard: {
        backgroundColor: '#1C1C1E',
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    thumbnail: {
        width: 48,
        height: 48,
        borderRadius: 24,
    },
    thumbnailPlaceholder: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#007AFF',
        justifyContent: 'center',
        alignItems: 'center',
    },
    cardTitles: {
        flex: 1,
        marginLeft: 12,
    },
    cardTitle: {
        fontSize: 18,
        fontWeight: 'bold',
    },
    scoreRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 2,
    },
    score: {
        fontSize: 12,
        fontWeight: 'bold',
        color: '#34C759',
    },
    subs: {
        fontSize: 12,
        color: '#8E8E93',
    },
    description: {
        fontSize: 14,
        color: '#3A3A3C',
        lineHeight: 20,
        marginBottom: 12,
    },
    darkSubtext: {
        color: '#8E8E93',
    },
    reasonBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0,122,255,0.05)',
        padding: 8,
        borderRadius: 8,
        marginBottom: 16,
        gap: 6,
    },
    reasonText: {
        fontSize: 12,
        color: '#007AFF',
        fontStyle: 'italic',
    },
    actions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 12,
    },
    dismissButton: {
        paddingHorizontal: 16,
        paddingVertical: 8,
    },
    dismissText: {
        color: '#FF3B30',
        fontWeight: '600',
    },
    subscribeButton: {
        backgroundColor: '#007AFF',
        paddingHorizontal: 20,
        paddingVertical: 8,
        borderRadius: 8,
    },
    subscribeText: {
        color: '#FFF',
        fontWeight: 'bold',
    },
    emptyContainer: {
        alignItems: 'center',
        padding: 40,
    },
    emptyText: {
        marginTop: 12,
        color: '#8E8E93',
        textAlign: 'center',
    },
    darkText: {
        color: '#FFF',
    },
});
