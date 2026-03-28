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
                colors={[
                    colors.primary.dark ?? colors.primary.DEFAULT,
                    colors.primary.DEFAULT,
                ]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={s.gradient}
            >
                <View style={s.header}>
                    <View style={s.titleRow}>
                        <Sparkles size={16} color={colors.text.inverse} style={s.icon} />
                        <View style={s.textBlock}>
                            <Text style={s.title} numberOfLines={1}>
                                {pendingDigest.title || 'Your Daily Digest'}
                            </Text>
                        </View>
                    </View>
                    <ChevronRight size={18} color={colors.text.inverse} />
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
        marginTop: spacing.sm,
        marginBottom: spacing.sm,
        borderRadius: borderRadius.lg,
        overflow: 'hidden',
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
        color: colors.text.inverse,
        fontSize: 15,
        fontWeight: '800',
        letterSpacing: -0.2,
    },
    footerText: {
        color: `${colors.text.inverse}cc`,
        fontSize: 11,
        fontWeight: '600',
        marginTop: 2,
    },
});
