import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useColors } from '@/theme';

interface ProgressBarProps {
    current: number;
    total: number;
}

export function ProgressBar({ current, total }: ProgressBarProps) {
    const colors = useColors();
    const percentage = total > 0 ? (current / total) * 100 : 0;

    return (
        <View style={[styles.container, { backgroundColor: colors.background.tertiary }]}>
            <View
                style={[
                    styles.fill,
                    {
                        backgroundColor: colors.primary.DEFAULT,
                        width: `${Math.min(percentage, 100)}%`,
                    },
                ]}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        height: 6,
        borderRadius: 3,
        overflow: 'hidden',
        width: '100%',
    },
    fill: {
        height: '100%',
        borderRadius: 3,
    },
});
