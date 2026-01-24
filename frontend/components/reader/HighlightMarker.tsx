import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useColors, spacing, borderRadius } from '@/theme';
import { Highlight, getHighlightColor, getHighlightAccentColor } from '@/stores/highlightsStore';

interface HighlightMarkerProps {
    highlight: Highlight;
    onPress: (highlight: Highlight) => void;
}

/**
 * Visual marker for a highlighted text segment
 * Displays the highlighted text with color background
 */
export function HighlightMarker({ highlight, onPress }: HighlightMarkerProps) {
    const colors = useColors();
    const s = styles(colors);

    const backgroundColor = getHighlightColor(highlight.color);
    const borderColor = getHighlightAccentColor(highlight.color);

    return (
        <Pressable
            onPress={() => onPress(highlight)}
            style={[
                s.marker,
                {
                    backgroundColor: backgroundColor + '80', // 50% opacity
                    borderLeftColor: borderColor,
                },
            ]}
        >
            <Text style={s.text}>{highlight.text}</Text>
            {highlight.note && (
                <View style={[s.noteIndicator, { backgroundColor: borderColor }]} />
            )}
        </Pressable>
    );
}

const styles = (colors: any) =>
    StyleSheet.create({
        marker: {
            borderLeftWidth: 3,
            paddingLeft: spacing.xs,
            paddingRight: spacing.xs,
            paddingVertical: 2,
            borderRadius: borderRadius.sm,
            position: 'relative',
        },
        text: {
            color: colors.text.primary,
            fontSize: 16,
            lineHeight: 26,
        },
        noteIndicator: {
            position: 'absolute',
            top: -4,
            right: -4,
            width: 8,
            height: 8,
            borderRadius: 4,
            borderWidth: 2,
            borderColor: colors.background.primary,
        },
    });
