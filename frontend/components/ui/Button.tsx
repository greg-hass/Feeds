import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, ViewStyle, TextStyle, View } from 'react-native';
import { useColors, spacing, borderRadius } from '@/theme';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps {
    title?: string;
    onPress: () => void;
    variant?: ButtonVariant;
    size?: ButtonSize;
    icon?: React.ReactNode;
    disabled?: boolean;
    loading?: boolean;
    style?: ViewStyle;
    textStyle?: TextStyle;
    children?: React.ReactNode;
}

export const Button = ({
    title,
    onPress,
    variant = 'primary',
    size = 'md',
    icon,
    disabled = false,
    loading = false,
    style,
    textStyle,
    children
}: ButtonProps) => {
    const colors = useColors();
    const s = styles(colors);

    const getVariantStyle = () => {
        switch (variant) {
            case 'primary':
                return { backgroundColor: colors.primary?.DEFAULT ?? colors.primary, borderWidth: 0 };
            case 'secondary':
                return { backgroundColor: colors.background.secondary, borderWidth: 0 };
            case 'outline':
                return { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.border.DEFAULT };
            case 'ghost':
                return { backgroundColor: 'transparent', borderWidth: 0 };
            case 'danger':
                return { backgroundColor: colors.status.error + '22', borderWidth: 0 };
            default:
                return {};
        }
    };

    const getSizeStyle = () => {
        switch (size) {
            case 'sm':
                return { paddingVertical: spacing.xs, paddingHorizontal: spacing.md, minHeight: 32 };
            case 'lg':
                return { paddingVertical: spacing.lg, paddingHorizontal: spacing.xl, minHeight: 56 };
            default: // md
                return { paddingVertical: spacing.md, paddingHorizontal: spacing.lg, minHeight: 44 };
        }
    };

    const getTextColor = () => {
        if (disabled) return colors.text.tertiary;
        switch (variant) {
            case 'primary': return colors.text.inverse;
            case 'danger': return colors.status.error;
            case 'ghost': return colors.text.secondary;
            default: return colors.text.primary;
        }
    };

    const getTextSize = () => {
        switch (size) {
            case 'sm': return 13;
            case 'lg': return 16;
            default: return 14;
        }
    };

    return (
        <TouchableOpacity
            onPress={onPress}
            disabled={disabled || loading}
            style={[
                s.base,
                getVariantStyle(),
                getSizeStyle(),
                disabled && s.disabled,
                style
            ]}
            activeOpacity={0.7}
        >
            {loading ? (
                <ActivityIndicator 
                    size="small" 
                    color={getTextColor()} 
                    style={{ marginRight: title ? spacing.sm : 0 }}
                />
            ) : icon ? (
                <React.Fragment>
                    {icon}
                    {/* Add spacing if there is also text */}
                    {(title || children) && <View style={{ width: spacing.sm }} />} 
                </React.Fragment>
            ) : null}
            
            {title ? (
                <Text style={[
                    s.text, 
                    { color: getTextColor(), fontSize: getTextSize() },
                    (icon || loading) && { marginLeft: spacing.sm },
                    textStyle
                ]}>
                    {title}
                </Text>
            ) : children}
        </TouchableOpacity>
    );
};

const styles = (colors: any) => StyleSheet.create({
    base: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: borderRadius.md,
    },
    disabled: {
        opacity: 0.5,
    },
    text: {
        fontWeight: '600',
        textAlign: 'center',
    },
});
