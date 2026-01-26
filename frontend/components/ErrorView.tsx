import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { AlertTriangle, RefreshCw } from 'lucide-react-native';
import { useColors, spacing, borderRadius } from '@/theme';

interface ErrorViewProps {
    message?: string;
    onRetry?: () => void;
    icon?: React.ElementType;
}

export const ErrorView = ({ message = 'Something went wrong', onRetry, icon: Icon = AlertTriangle }: ErrorViewProps) => {
    const colors = useColors();
    const s = styles(colors);

    return (
        <View style={s.container}>
            <View style={s.iconContainer}>
                <Icon size={48} color={colors.status.error} />
            </View>
            <Text style={s.title}>Oops!</Text>
            <Text style={s.message}>{message}</Text>
            {onRetry && (
                <TouchableOpacity style={s.button} onPress={onRetry}>
                    <RefreshCw size={20} color={colors.text.inverse} />
                    <Text style={s.buttonText}>Try Again</Text>
                </TouchableOpacity>
            )}
        </View>
    );
};

const styles = (colors: any) => StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: spacing.xl,
        backgroundColor: colors.background.primary,
    },
    iconContainer: {
        marginBottom: spacing.lg,
        padding: spacing.lg,
        backgroundColor: colors.status.error + '22',
        borderRadius: borderRadius.full,
    },
    title: {
        fontSize: 24,
        fontWeight: '800',
        color: colors.text.primary,
        marginBottom: spacing.sm,
    },
    message: {
        fontSize: 16,
        color: colors.text.secondary,
        textAlign: 'center',
        marginBottom: spacing.xl,
        maxWidth: 300,
        lineHeight: 24,
    },
    button: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        backgroundColor: colors.primary.DEFAULT,
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
