import React from 'react';
import { TextInput, TextInputProps, StyleSheet, View, Text } from 'react-native';
import { useColors, spacing, borderRadius } from '@/theme';

interface InputProps extends TextInputProps {
    error?: string;
}

export const Input = React.forwardRef<TextInput, InputProps>(({ style, error, ...props }, ref) => {
    const colors = useColors();
    const s = styles(colors);

    return (
        <View style={s.container}>
            <TextInput
                ref={ref}
                style={[
                    s.input,
                    !!error && s.inputError,
                    style
                ]}
                placeholderTextColor={colors.text.tertiary}
                {...props}
            />
            {error && <Text style={s.errorText}>{error}</Text>}
        </View>
    );
});

const styles = (colors: any) => StyleSheet.create({
    container: {
        width: '100%',
    },
    input: {
        backgroundColor: colors.background.secondary,
        borderRadius: borderRadius.md,
        padding: spacing.md,
        fontSize: 16,
        color: colors.text.primary,
        borderWidth: 1,
        borderColor: colors.border.DEFAULT,
        minHeight: 44,
    },
    inputError: {
        borderColor: colors.status.error,
    },
    errorText: {
        fontSize: 12,
        color: colors.status.error,
        marginTop: spacing.xs,
        marginLeft: spacing.xs,
    },
});
