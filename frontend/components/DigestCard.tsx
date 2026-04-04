import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Sparkles, ChevronRight } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useDigestStore } from '@/stores/digestStore';
import { useColors, borderRadius, spacing } from '@/theme';

export const DigestCard = () => {
    const router = useRouter();
    const colors = useColors();
    const { pendingDigest, dismissDigest } = useDigestStore();
    const s = styles(colors);
    const SparklesIcon = Sparkles as any;
    const ChevronRightIcon = ChevronRight as any;

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
            <View style={s.panel}>
                <View style={s.header}>
                    <View style={s.titleRow}>
                        <View style={s.badge}>
                            <SparklesIcon size={14} color={colors.primary.DEFAULT} style={s.icon} />
                        </View>
                        <View style={s.textBlock}>
                            <Text style={s.eyebrow}>Daily digest</Text>
                            <Text style={s.title} numberOfLines={1}>
                                {pendingDigest.title || 'Morning edition'}
                            </Text>
                        </View>
                    </View>
                    <ChevronRightIcon size={18} color={colors.text.secondary} />
                </View>

                <Text style={s.footerText} numberOfLines={1}>
                    Open it once and it clears from Home.
                </Text>
            </View>
        </TouchableOpacity>
    );
};

const styles = (colors: any) => StyleSheet.create({
    container: {
        marginHorizontal: spacing.lg,
        marginTop: spacing.sm,
        marginBottom: spacing.sm,
    },
    panel: {
        backgroundColor: colors.background.secondary,
        borderRadius: borderRadius.xl,
        borderWidth: 1,
        borderColor: colors.border.DEFAULT,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.md,
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
    badge: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: colors.primary.soft,
        borderWidth: 1,
        borderColor: colors.primary.DEFAULT,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: spacing.sm,
    },
    icon: {
        marginRight: 0,
    },
    textBlock: {
        flex: 1,
    },
    eyebrow: {
        color: colors.text.tertiary,
        fontSize: 10,
        fontWeight: '800',
        letterSpacing: 0.6,
        textTransform: 'uppercase',
        marginBottom: 2,
    },
    title: {
        color: colors.text.primary,
        fontSize: 15,
        fontWeight: '800',
        letterSpacing: -0.2,
    },
    footerText: {
        color: colors.text.secondary,
        fontSize: 11,
        fontWeight: '600',
        marginTop: spacing.sm,
    },
});
