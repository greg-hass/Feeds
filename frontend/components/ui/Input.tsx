import React, { useState, useMemo } from 'react';
import { TextInput, TextInputProps, StyleSheet, View, Text } from 'react-native';
import { useColors, spacing, borderRadius } from '@/theme';

export type InputSize = 'sm' | 'md' | 'lg';

interface InputProps extends TextInputProps {
    error?: string;
    size?: InputSize;
    label?: string;
    helper?: string;
    showCharacterCount?: boolean;
    maxLength?: number;
}

export const Input = React.forwardRef<TextInput, InputProps>(({
    style,
    error,
    size = 'md',
    label,
    helper,
    showCharacterCount,
    maxLength,
    multiline,
    numberOfLines,
    onFocus,
    onBlur,
    value,
    ...props
}, ref) => {
    const colors = useColors();
    const s = useMemo(() => styles(colors, size, multiline), [colors, size, multiline]);
    const [isFocused, setIsFocused] = useState(false);
    const characterCount = value?.length ?? 0;

    const handleFocus = (e: any) => {
        setIsFocused(true);
        onFocus?.(e);
    };

    const handleBlur = (e: any) => {
        setIsFocused(false);
        onBlur?.(e);
    };

    return (
        <View style={s.container}>
            {label && (
                <Text style={s.label}>
                    {label}
                </Text>
            )}
            <TextInput
                ref={ref}
                style={[
                    s.input,
                    isFocused && s.inputFocused,
                    !!error && s.inputError,
                    multiline && s.textArea,
                    style
                ]}
                placeholderTextColor={colors.text.tertiary}
                multiline={multiline}
                numberOfLines={multiline ? (numberOfLines ?? 3) : undefined}
                textAlignVertical={multiline ? 'top' : 'center'}
                maxLength={maxLength}
                value={value}
                onFocus={handleFocus}
                onBlur={handleBlur}
                {...props}
            />
            {(error || helper || showCharacterCount) && (
                <View style={s.footer}>
                    <View style={s.footerLeft}>
                        {error ? (
                            <Text style={s.errorText}>{error}</Text>
                        ) : helper ? (
                            <Text style={s.helperText}>{helper}</Text>
                        ) : null}
                    </View>
                    {showCharacterCount && maxLength && (
                        <Text style={[
                            s.characterCount,
                            characterCount >= maxLength && s.characterCountMax
                        ]}>
                            {characterCount}/{maxLength}
                        </Text>
                    )}
                </View>
            )}
        </View>
    );
});

Input.displayName = 'Input';

const getSizeStyles = (size: InputSize) => {
    switch (size) {
        case 'sm':
            return { padding: spacing.sm, fontSize: 14, minHeight: 36 };
        case 'lg':
            return { padding: spacing.lg, fontSize: 18, minHeight: 56 };
        default: // md
            return { padding: spacing.md, fontSize: 16, minHeight: 44 };
    }
};

const styles = (colors: any, size: InputSize, multiline?: boolean) => {
    const sizeStyles = getSizeStyles(size);

    return StyleSheet.create({
        container: {
            width: '100%',
        },
        label: {
            fontSize: 14,
            fontWeight: '600',
            color: colors.text.secondary,
            marginBottom: spacing.xs,
        },
        input: {
            backgroundColor: colors.background.secondary,
            borderRadius: borderRadius.lg,
            padding: sizeStyles.padding,
            fontSize: sizeStyles.fontSize,
            color: colors.text.primary,
            borderWidth: 1,
            borderColor: colors.border.DEFAULT,
            minHeight: multiline ? undefined : sizeStyles.minHeight,
        },
        inputFocused: {
            borderColor: colors.primary?.DEFAULT ?? colors.primary,
            backgroundColor: colors.background.tertiary,
        },
        inputError: {
            borderColor: colors.status.error,
        },
        textArea: {
            minHeight: 80,
            paddingTop: spacing.md,
        },
        footer: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginTop: spacing.xs,
        },
        footerLeft: {
            flex: 1,
        },
        errorText: {
            fontSize: 12,
            color: colors.status.error,
        },
        helperText: {
            fontSize: 12,
            color: colors.text.tertiary,
        },
        characterCount: {
            fontSize: 12,
            color: colors.text.tertiary,
            marginLeft: spacing.sm,
        },
        characterCountMax: {
            color: colors.status.warning,
        },
    });
};
