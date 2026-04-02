import React from 'react';
import { Text, StyleSheet, View, ViewStyle } from 'react-native';
import { useColors, spacing } from '@/theme';

interface SectionHeaderProps {
    title: string;
    icon?: React.ReactNode;
    style?: ViewStyle;
}

export const SectionHeader = ({ title, icon, style }: SectionHeaderProps) => {
    const colors = useColors();
    const s = styles(colors);

    return (
        <View style={[s.container, style]}>
            {icon ? <View style={s.icon}>{icon}</View> : null}
            <Text style={s.text}>{title}</Text>
        </View>
    );
};

const styles = (colors: any) => StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: spacing.sm,
        paddingHorizontal: spacing.xs,
        gap: spacing.xs,
    },
    icon: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    text: {
        fontSize: 12,
        fontWeight: '700',
        color: colors.text.tertiary,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
});
