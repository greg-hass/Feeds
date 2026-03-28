import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Sparkles, ChevronRight } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useDigestStore } from '@/stores';
import { useColors, borderRadius, spacing } from '@/theme';

export const DigestCard = () => {
    const router = useRouter();
    const colors = useColors();
    const { pendingDigest, dismissDigest } = useDigestStore();
    const s = styles(colors);

    if (!pendingDigest) return null;

    const topics = (pendingDigest.topics || []).slice(0, 3);
    const topicSummary = topics.length > 0
        ? topics.join(' · ')
        : 'A new digest is ready';

    const handleOpen = async () => {
        await dismissDigest(pendingDigest.id);
        router.push('/digest');
    };

    return (
        <TouchableOpacity
            activeOpacity={0.9}
            style={s.container}
            onPress={handleOpen}
        >
            <LinearGradient
                colors={[colors.background.secondary, colors.background.tertiary]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={s.gradient}
            >
                <View style={s.header}>
                    <View style={s.titleRow}>
                        <Sparkles size={16} color={colors.primary.DEFAULT} style={s.icon} />
                        <View style={s.textBlock}>
                            <Text style={s.title} numberOfLines={1}>
                                {pendingDigest.title || 'Your Daily Digest'}
                            </Text>
                            <Text style={s.subtitle} numberOfLines={1}>
                                {topicSummary}
                            </Text>
                        </View>
                    </View>
                    <ChevronRight size={18} color={colors.text.tertiary} />
                </View>

                <Text style={s.footerText} numberOfLines={1}>
                    Tap once to open and clear it from Home
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
        borderRadius: borderRadius.lg,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: colors.border.DEFAULT,
    },
    gradient: {
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: spacing.sm,
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    icon: {
        marginRight: spacing.sm,
    },
    textBlock: {
        flex: 1,
    },
    title: {
        color: colors.text.primary,
        fontSize: 15,
        fontWeight: '800',
        letterSpacing: -0.2,
    },
    subtitle: {
        color: colors.text.secondary,
        fontSize: 12,
        fontWeight: '500',
        marginTop: 2,
    },
    footerText: {
        color: colors.text.tertiary,
        fontSize: 12,
        fontWeight: '600',
        marginTop: spacing.xs,
    },
});
