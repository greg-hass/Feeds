import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Inbox, Plus, CheckCircle2 } from 'lucide-react-native';
import { useColors, spacing, borderRadius } from '@/theme';
import { useRouter } from 'expo-router';

interface TimelineEmptyStateProps {
    isFiltered: boolean;
    hasFeeds: boolean;
    filterType?: string;
    onClearFilter?: () => void;
}

export const TimelineEmptyState = ({ isFiltered, hasFeeds, filterType, onClearFilter }: TimelineEmptyStateProps) => {
    const colors = useColors();
    const router = useRouter();
    const s = styles(colors);

    // If no feeds at all, show empty feed message regardless of filter
    if (!hasFeeds) {
        // Map filter types to user-friendly feed names
        const feedNameMap: Record<string, string> = {
            'youtube': 'YouTube',
            'podcast': 'Podcasts',
            'reddit': 'Reddit',
            'rss': 'RSS',
        };
        const feedName = filterType ? feedNameMap[filterType] || filterType.charAt(0).toUpperCase() + filterType.slice(1) : 'feed';
        return (
            <View style={s.container}>
                <View style={[s.iconContainer, { backgroundColor: (colors.primary?.DEFAULT ?? colors.primary) + '22' }]}>
                    <Inbox size={48} color={colors.primary?.DEFAULT ?? colors.primary} />
                </View>
                <Text style={s.title}>Your {feedName} feed is empty</Text>
                <Text style={s.message}>
                    It looks like you haven't subscribed to any feeds yet. Add your favorite content to get started!
                </Text>
                <TouchableOpacity 
                    style={s.button}
                    onPress={() => router.push('/manage')}
                >
                    <Plus size={20} color={colors.text.inverse} />
                    <Text style={s.buttonText}>Add First Feed</Text>
                </TouchableOpacity>
            </View>
        );
    }

    if (isFiltered) {
        return (
            <View style={s.container}>
                <View style={[s.iconContainer, { backgroundColor: colors.status.success + '22' }]}>
                    <CheckCircle2 size={48} color={colors.status.success} />
                </View>
                <Text style={s.title}>All caught up!</Text>
                <Text style={s.message}>
                    No unread articles here. You've read everything in this view.
                </Text>
                {onClearFilter && (
                    <TouchableOpacity 
                        style={[s.button, { backgroundColor: colors.background.tertiary }]}
                        onPress={onClearFilter}
                    >
                        <Text style={[s.buttonText, { color: colors.text.primary }]}>View Read Articles</Text>
                    </TouchableOpacity>
                )}
            </View>
        );
    }

    return (
        <View style={s.container}>
            <View style={[s.iconContainer, { backgroundColor: colors.background.tertiary }]}>
                <Inbox size={48} color={colors.text.tertiary} />
            </View>
            <Text style={s.title}>No articles found</Text>
            <Text style={s.message}>
                We couldn't find any articles matching your criteria.
            </Text>
        </View>
    );
};

const styles = (colors: any) => StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: spacing.xxl,
        paddingTop: 100,
        minHeight: 400,
    },
    iconContainer: {
        marginBottom: spacing.lg,
        padding: spacing.xl,
        borderRadius: borderRadius.full,
    },
    title: {
        fontSize: 24,
        fontWeight: '800',
        color: colors.text.primary,
        marginBottom: spacing.sm,
        textAlign: 'center',
    },
    message: {
        fontSize: 16,
        color: colors.text.secondary,
        textAlign: 'center',
        marginBottom: spacing.xl,
        maxWidth: 320,
        lineHeight: 24,
    },
    button: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        backgroundColor: colors.primary?.DEFAULT ?? colors.primary,
        paddingHorizontal: spacing.xl,
        paddingVertical: spacing.md,
        borderRadius: borderRadius.full,
    },
    buttonText: {
        color: colors.text.inverse,
        fontWeight: '700',
        fontSize: 16,
    },
});
