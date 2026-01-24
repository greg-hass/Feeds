import React from 'react';
import { View, Text, FlatList, Pressable, StyleSheet } from 'react-native';
import { Highlighter, StickyNote } from 'lucide-react-native';
import { useColors, spacing, borderRadius, typography } from '@/theme';
import {
    Highlight,
    useHighlightsStore,
    formatHighlightCount,
    getHighlightColor,
    getHighlightAccentColor,
} from '@/stores/highlightsStore';
import { formatDistanceToNow } from 'date-fns';

interface HighlightsListProps {
    highlights: Highlight[];
    onHighlightPress: (highlight: Highlight) => void;
    onNavigateToHighlight?: (highlight: Highlight) => void;
}

/**
 * List view of all highlights with notes
 * Displays in a sidebar or modal
 */
export function HighlightsList({
    highlights,
    onHighlightPress,
    onNavigateToHighlight,
}: HighlightsListProps) {
    const colors = useColors();
    const s = styles(colors);

    const sortedHighlights = [...highlights].sort((a, b) => a.start_offset - b.start_offset);

    const renderItem = ({ item }: { item: Highlight }) => {
        const backgroundColor = getHighlightColor(item.color);
        const borderColor = getHighlightAccentColor(item.color);

        return (
            <Pressable
                style={s.item}
                onPress={() => onHighlightPress(item)}
                onLongPress={() => onNavigateToHighlight?.(item)}
            >
                <View
                    style={[
                        s.colorBar,
                        {
                            backgroundColor: borderColor,
                        },
                    ]}
                />

                <View style={s.content}>
                    <View
                        style={[
                            s.textContainer,
                            {
                                backgroundColor: backgroundColor + '40',
                            },
                        ]}
                    >
                        <Text style={s.text} numberOfLines={3}>
                            {item.text}
                        </Text>
                    </View>

                    {item.note && (
                        <View style={s.noteContainer}>
                            <StickyNote size={14} color={colors.text.tertiary} />
                            <Text style={s.note} numberOfLines={2}>
                                {item.note}
                            </Text>
                        </View>
                    )}

                    <Text style={s.timestamp}>
                        {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
                    </Text>
                </View>
            </Pressable>
        );
    };

    return (
        <View style={s.container}>
            <View style={s.header}>
                <View style={s.headerLeft}>
                    <Highlighter size={18} color={colors.primary.DEFAULT} />
                    <Text style={s.title}>{formatHighlightCount(highlights.length)}</Text>
                </View>
            </View>

            {sortedHighlights.length === 0 ? (
                <View style={s.empty}>
                    <Highlighter size={48} color={colors.background.tertiary} />
                    <Text style={s.emptyText}>No highlights yet</Text>
                    <Text style={s.emptyHint}>Select text to create your first highlight</Text>
                </View>
            ) : (
                <FlatList
                    data={sortedHighlights}
                    keyExtractor={(item) => String(item.id)}
                    renderItem={renderItem}
                    contentContainerStyle={s.list}
                    ItemSeparatorComponent={() => <View style={s.separator} />}
                />
            )}
        </View>
    );
}

const styles = (colors: any) =>
    StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: colors.background.primary,
        },
        header: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: spacing.lg,
            borderBottomWidth: 1,
            borderBottomColor: colors.border.DEFAULT,
        },
        headerLeft: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.sm,
        },
        title: {
            ...typography.h3,
            color: colors.text.primary,
        },
        list: {
            padding: spacing.lg,
        },
        item: {
            flexDirection: 'row',
            backgroundColor: colors.background.elevated,
            borderRadius: borderRadius.lg,
            overflow: 'hidden',
        },
        colorBar: {
            width: 4,
        },
        content: {
            flex: 1,
            padding: spacing.md,
        },
        textContainer: {
            padding: spacing.sm,
            borderRadius: borderRadius.sm,
            marginBottom: spacing.sm,
        },
        text: {
            ...typography.body,
            color: colors.text.primary,
            lineHeight: 22,
        },
        noteContainer: {
            flexDirection: 'row',
            gap: spacing.xs,
            padding: spacing.sm,
            backgroundColor: colors.background.secondary,
            borderRadius: borderRadius.sm,
            marginBottom: spacing.sm,
        },
        note: {
            ...typography.small,
            color: colors.text.secondary,
            flex: 1,
            fontStyle: 'italic',
        },
        timestamp: {
            ...typography.caption,
            color: colors.text.tertiary,
        },
        separator: {
            height: spacing.md,
        },
        empty: {
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            padding: spacing.xxl,
        },
        emptyText: {
            ...typography.h3,
            color: colors.text.primary,
            marginTop: spacing.lg,
        },
        emptyHint: {
            ...typography.body,
            color: colors.text.tertiary,
            marginTop: spacing.sm,
            textAlign: 'center',
        },
    });
