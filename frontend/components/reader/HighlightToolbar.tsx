import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Highlighter } from 'lucide-react-native';
import { useColors, spacing, borderRadius, typography } from '@/theme';
import {
    Highlight,
    useHighlightsStore,
    CreateHighlightParams,
    getHighlightColor,
    getHighlightAccentColor,
} from '@/stores/highlightsStore';
import { useToastStore } from '@/stores/toastStore';

interface HighlightToolbarProps {
    visible: boolean;
    selectedText: string;
    startOffset: number;
    endOffset: number;
    articleId: number;
    position: { x: number; y: number };
    onClose: () => void;
}

const COLORS: Highlight['color'][] = ['yellow', 'green', 'blue', 'pink', 'purple'];

/**
 * Floating toolbar that appears when text is selected
 * Allows choosing highlight color to create highlight
 */
export function HighlightToolbar({
    visible,
    selectedText,
    startOffset,
    endOffset,
    articleId,
    position,
    onClose,
}: HighlightToolbarProps) {
    const colors = useColors();
    const { createHighlight } = useHighlightsStore();
    const { showToast } = useToastStore();

    const s = styles(colors);

    if (!visible || !selectedText) return null;

    const handleCreateHighlight = async (color: Highlight['color']) => {
        try {
            const params: CreateHighlightParams = {
                article_id: articleId,
                text: selectedText,
                start_offset: startOffset,
                end_offset: endOffset,
                color,
            };

            await createHighlight(params);
            showToast('Highlight created', 'success');
            onClose();
        } catch (error) {
            showToast('Failed to create highlight', 'error');
        }
    };

    return (
        <View
            style={[
                s.toolbar,
                {
                    top: position.y - 60, // Position above selection
                    left: Math.max(spacing.md, Math.min(position.x - 150, 300)),
                },
            ]}
        >
            <View style={s.header}>
                <Highlighter size={14} color={colors.text.secondary} />
                <Text style={s.headerText}>Highlight</Text>
            </View>

            <View style={s.colorRow}>
                {COLORS.map((color) => {
                    const bgColor = getHighlightColor(color);
                    const accentColor = getHighlightAccentColor(color);

                    return (
                        <Pressable
                            key={color}
                            style={[
                                s.colorButton,
                                {
                                    backgroundColor: bgColor,
                                    borderColor: accentColor,
                                },
                            ]}
                            onPress={() => handleCreateHighlight(color)}
                        >
                            <View
                                style={[
                                    s.colorInner,
                                    {
                                        backgroundColor: accentColor,
                                    },
                                ]}
                            />
                        </Pressable>
                    );
                })}
            </View>

            {/* Arrow pointer */}
            <View style={[s.arrow, { borderTopColor: colors.background.elevated }]} />
        </View>
    );
}

const styles = (colors: any) =>
    StyleSheet.create({
        toolbar: {
            position: 'absolute',
            backgroundColor: colors.background.elevated,
            borderRadius: borderRadius.lg,
            padding: spacing.md,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.2,
            shadowRadius: 8,
            elevation: 8,
            borderWidth: 1,
            borderColor: colors.border.DEFAULT,
            zIndex: 1000,
        },
        header: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.xs,
            marginBottom: spacing.sm,
        },
        headerText: {
            ...typography.caption,
            color: colors.text.secondary,
            textTransform: 'uppercase',
            fontWeight: '700',
            letterSpacing: 0.5,
        },
        colorRow: {
            flexDirection: 'row',
            gap: spacing.sm,
        },
        colorButton: {
            width: 40,
            height: 40,
            borderRadius: borderRadius.md,
            borderWidth: 2,
            justifyContent: 'center',
            alignItems: 'center',
        },
        colorInner: {
            width: 16,
            height: 16,
            borderRadius: borderRadius.sm,
        },
        arrow: {
            position: 'absolute',
            bottom: -8,
            left: '50%',
            marginLeft: -8,
            width: 0,
            height: 0,
            borderLeftWidth: 8,
            borderLeftColor: 'transparent',
            borderRightWidth: 8,
            borderRightColor: 'transparent',
            borderTopWidth: 8,
        },
    });
