import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Sparkles, X } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useDigestStore } from '@/stores';
import { useColors, borderRadius, spacing } from '@/theme';

export const DigestCard = () => {
    const router = useRouter();
    const colors = useColors();
    const { pendingDigest, dismissDigest } = useDigestStore();
    const s = styles(colors);

    if (!pendingDigest) return null;

    const topics = pendingDigest.topics || [];

    return (
        <TouchableOpacity
            activeOpacity={0.9}
            style={s.container}
            onPress={() => router.push('/digest')}
        >
            <LinearGradient
                colors={[colors.primary?.DEFAULT ?? colors.primary, colors.primary?.light ?? colors.primary]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={s.gradient}
            >
                <View style={s.header}>
                    <View style={s.titleRow}>
                        <Sparkles size={18} color="#fff" style={s.icon} />
                        <Text style={s.title}>{pendingDigest.title || 'Your Daily Digest'}</Text>
                    </View>
                    <TouchableOpacity
                        style={s.closeButton}
                        onPress={(e) => {
                            e.stopPropagation();
                            dismissDigest(pendingDigest.id);
                        }}
                    >
                        <X size={18} color="rgba(255, 255, 255, 0.7)" />
                    </TouchableOpacity>
                </View>

                {topics.length > 0 && (
                    <View style={s.topicsContainer}>
                        {topics.slice(0, 3).map((topic: string, i: number) => (
                            <View key={i} style={s.topicBadge}>
                                <Text style={s.topicText} numberOfLines={1}>
                                    {topic}
                                </Text>
                            </View>
                        ))}
                    </View>
                )}

                <Text style={s.footerText}>
                    Tap to read the full intelligence briefing
                </Text>
            </LinearGradient>
        </TouchableOpacity>
    );
};

const styles = (colors: any) => StyleSheet.create({
    container: {
        marginHorizontal: spacing.lg,
        marginTop: spacing.md,
        marginBottom: spacing.sm,
        borderRadius: borderRadius.xl,
        overflow: 'hidden',
        // Accent glow shadow
        shadowColor: colors.primary?.DEFAULT ?? colors.primary,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
        elevation: 10,
    },
    gradient: {
        padding: spacing.lg,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.md,
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    icon: {
        marginRight: spacing.sm,
    },
    title: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '900',
        letterSpacing: -0.5,
    },
    closeButton: {
        padding: 4,
    },
    topicsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
        marginBottom: spacing.md,
    },
    topicBadge: {
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: borderRadius.full,
        maxWidth: '100%',
    },
    topicText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '700',
    },
    footerText: {
        color: 'rgba(255, 255, 255, 0.8)',
        fontSize: 13,
        fontWeight: '600',
    },
});
