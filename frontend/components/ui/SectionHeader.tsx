import React from 'react';
import { Text, StyleSheet, ViewStyle } from 'react-native';
import { useColors, spacing } from '@/theme';

interface SectionHeaderProps {
    title: string;
    style?: ViewStyle;
}

export const SectionHeader = ({ title, style }: SectionHeaderProps) => {
    const colors = useColors();
    const s = styles(colors);

    return (
        <Text style={[s.text, style]}>
            {title}
        </Text>
    );
};

const styles = (colors: any) => StyleSheet.create({
    text: {
        fontSize: 12,
        fontWeight: '700',
        color: colors.text.tertiary,
        marginBottom: spacing.sm,
        textTransform: 'uppercase',
        letterSpacing: 1,
        paddingHorizontal: spacing.xs,
    },
});
