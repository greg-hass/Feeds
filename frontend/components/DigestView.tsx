import React, { useEffect, lazy, Suspense } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, Platform } from 'react-native';
import { useDigestStore } from '@/stores';
import { Sparkles, BarChart3, BookOpen, RefreshCw, AlertCircle, Calendar } from 'lucide-react-native';
import { useColors, spacing, borderRadius } from '@/theme';

// Lazy load markdown renderer (heavy dependency ~100KB) - only loads when digest is viewed
const Markdown = lazy(() => import('react-native-markdown-display').then(m => ({ default: m.default })));

export const DigestView = () => {
    const { latestDigest, isLoading, error, fetchLatestDigest, generateDigest } = useDigestStore();
    const colors = useColors();

    useEffect(() => {
        fetchLatestDigest();
    }, []);

    const s = styles(colors);

    if (isLoading && !latestDigest) {
        return (
            <View style={s.center}>
                <RefreshCw size={48} color={colors.primary.DEFAULT} style={s.spinIcon} />
                <Text style={s.loadingText}>Curating your personalized digest…</Text>
            </View>
        );
    }

    if (error && !latestDigest) {
        return (
            <View style={s.center}>
                <AlertCircle size={48} color={colors.error} />
                <Text style={s.errorText}>{error}</Text>
                <TouchableOpacity
                    style={s.button}
                    onPress={generateDigest}
                >
                    <Text style={s.buttonText}>Try Again</Text>
                </TouchableOpacity>
            </View>
        );
    }

    if (!latestDigest) {
        return (
            <View style={s.center}>
                <Sparkles size={64} color={colors.text.tertiary} />
                <Text style={s.emptySubtitle}>STAY INFORMED</Text>
                <Text style={s.emptyText}>Your daily intelligence briefing is ready to be generated.</Text>
                <TouchableOpacity
                    style={s.button}
                    onPress={generateDigest}
                >
                    <Sparkles size={18} color="#fff" style={{ marginRight: 8 }} />
                    <Text style={s.buttonText}>Generate Daily Digest</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <ScrollView style={s.container} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
            <View style={s.header}>
                <TouchableOpacity
                    onPress={generateDigest}
                    disabled={isLoading}
                    style={s.headerRefreshButton}
                    accessibilityLabel="Regenerate digest"
                >
                    {isLoading ? (
                        <ActivityIndicator size={20} color={colors.primary.DEFAULT} />
                    ) : (
                        <RefreshCw size={20} color={colors.text.tertiary} />
                    )}
                </TouchableOpacity>

                <View style={s.headerBadge}>
                    <Sparkles size={12} color={colors.primary.DEFAULT} />
                    <Text style={s.badgeText}>
                        {latestDigest.edition ? `${latestDigest.edition.toUpperCase()} INSIGHTS` : 'AI INSIGHTS'}
                    </Text>
                </View>
                <Text style={s.title}>{latestDigest.title || 'Intelligence Briefing'}</Text>
                <View style={s.headerMeta}>
                    <Calendar size={14} color={colors.text.tertiary} />
                    <Text style={s.date}>
                        {new Intl.DateTimeFormat(undefined, { dateStyle: 'long', timeStyle: 'short' }).format(new Date(latestDigest.generated_at))}
                    </Text>
                </View>
            </View>

            <View style={s.statsRow}>
                <View style={[s.statCard, { backgroundColor: colors.background.elevated }]}>
                    <BookOpen size={20} color={colors.primary.DEFAULT} />
                    <View>
                        <Text style={s.statValue}>{latestDigest.article_count}</Text>
                        <Text style={s.statLabel}>Articles Analyzed</Text>
                    </View>
                </View>
                <View style={[s.statCard, { backgroundColor: colors.background.elevated }]}>
                    <BarChart3 size={20} color={colors.primary.DEFAULT} />
                    <View>
                        <Text style={s.statValue}>{latestDigest.feed_count}</Text>
                        <Text style={s.statLabel}>Sources Refreshed</Text>
                    </View>
                </View>
            </View>

            <View style={s.card}>
                <Suspense fallback={<ActivityIndicator size="small" color={colors.primary.DEFAULT} />}>
                    <Markdown
                        style={{
                            body: { color: colors.text.primary, fontSize: 17, lineHeight: 28, fontWeight: '400' },
                            heading2: { color: colors.text.primary, fontSize: 22, fontWeight: '800', marginTop: 32, marginBottom: 16, letterSpacing: -0.5 },
                            bullet_list: { marginBottom: 16 },
                            list_item: { marginBottom: 8 },
                            link: { color: colors.primary.DEFAULT, fontWeight: '700', textDecorationLine: 'none' },
                            paragraph: { marginBottom: 16 }
                        }}
                    >
                        {latestDigest.content}
                    </Markdown>
                </Suspense>
            </View>

            <TouchableOpacity
                style={s.refreshFooter}
                onPress={generateDigest}
                disabled={isLoading}
            >
                <RefreshCw size={16} color={colors.text.tertiary} />
                <Text style={s.refreshFooterText}>Regenerate Briefing</Text>
            </TouchableOpacity>
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
        maxWidth: 800,
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
        marginBottom: spacing.xxl,
        alignItems: 'center',
        position: 'relative', // Enable absolute positioning for children
    },
    headerRefreshButton: {
        position: 'absolute',
        right: 0,
        top: 0,
        padding: spacing.sm,
        zIndex: 10,
    },
    headerBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: colors.primary.DEFAULT + '15',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: borderRadius.full,
        marginBottom: spacing.md,
    },
    badgeText: {
        fontSize: 10,
        fontWeight: '900',
        color: colors.primary.DEFAULT,
        letterSpacing: 1.5,
    },
    title: {
        fontSize: 32,
        fontWeight: '900',
        color: colors.text.primary,
        textAlign: 'center',
        letterSpacing: -1,
    },
    headerMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginTop: spacing.sm,
    },
    date: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.text.tertiary,
    },
    statsRow: {
        flexDirection: 'row',
        gap: spacing.md,
        marginBottom: spacing.xxl,
    },
    statCard: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        padding: spacing.lg,
        borderRadius: borderRadius.xl,
        borderWidth: 1,
        borderColor: colors.border.DEFAULT,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 2,
    },
    statValue: {
        fontSize: 18,
        fontWeight: '900',
        color: colors.text.primary,
    },
    statLabel: {
        fontSize: 11,
        fontWeight: '700',
        color: colors.text.tertiary,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    card: {
        backgroundColor: colors.background.elevated,
        borderRadius: borderRadius.xxl,
        padding: spacing.xl,
        borderWidth: 1,
        borderColor: colors.border.DEFAULT,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 20 },
        shadowOpacity: 0.1,
        shadowRadius: 40,
        elevation: 5,
    },
    loadingText: {
        marginTop: spacing.xl,
        fontSize: 16,
        fontWeight: '600',
        color: colors.text.secondary,
        textAlign: 'center',
    },
    errorText: {
        marginTop: spacing.md,
        color: colors.error,
        textAlign: 'center',
        marginBottom: spacing.xl,
        fontWeight: '600',
    },
    emptySubtitle: {
        fontSize: 12,
        fontWeight: '900',
        color: colors.primary.DEFAULT,
        letterSpacing: 2,
        marginBottom: 8,
    },
    emptyText: {
        fontSize: 16,
        color: colors.text.secondary,
        textAlign: 'center',
        marginBottom: spacing.xl,
        paddingHorizontal: spacing.xl,
        lineHeight: 24,
    },
    button: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.primary.DEFAULT,
        paddingHorizontal: spacing.xxl,
        paddingVertical: spacing.lg,
        borderRadius: borderRadius.full,
        shadowColor: colors.primary.DEFAULT,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 15,
        elevation: 8,
    },
    buttonText: {
        color: '#fff',
        fontWeight: '900',
        fontSize: 16,
    },
    refreshFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        marginTop: spacing.xxl,
        padding: spacing.md,
    },
    refreshFooterText: {
        fontSize: 13,
        fontWeight: '700',
        color: colors.text.tertiary,
    },
    spinIcon: {
        // Animation handled in component logic or via external lib if needed
    }
});
