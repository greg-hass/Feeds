import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ViewStyle } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { useColors, spacing } from '@/theme';

interface ScreenHeaderProps {
    title: string;
    showBackButton?: boolean;
    rightAction?: React.ReactNode;
    style?: ViewStyle;
}

export const ScreenHeader = ({ 
    title, 
    showBackButton = true, 
    rightAction,
    style 
}: ScreenHeaderProps) => {
    const router = useRouter();
    const colors = useColors();
    const s = styles(colors);

    return (
        <View style={[s.header, style]}>
            <View style={s.leftContainer}>
                {showBackButton && (
                    <TouchableOpacity 
                        onPress={() => router.back()} 
                        style={s.backButton}
                        accessibilityLabel="Go back"
                        accessibilityRole="button"
                    >
                        <ArrowLeft size={24} color={colors.text.primary} />
                    </TouchableOpacity>
                )}
                <Text style={s.headerTitle} numberOfLines={1}>{title}</Text>
            </View>
            {rightAction && (
                <View style={s.rightContainer}>
                    {rightAction}
                </View>
            )}
        </View>
    );
};

const styles = (colors: any) => StyleSheet.create({
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: spacing.lg,
        paddingTop: spacing.lg,
        paddingBottom: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.border.DEFAULT,
        backgroundColor: colors.background.primary,
        minHeight: 60,
    },
    leftContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        gap: spacing.md,
    },
    rightContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
    },
    backButton: {
        padding: spacing.sm,
        marginLeft: -spacing.sm,
        borderRadius: 999,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: colors.text.primary,
        flex: 1,
    },
});
