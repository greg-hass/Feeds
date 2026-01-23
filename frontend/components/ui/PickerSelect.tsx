import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, Modal, ScrollView } from 'react-native';
import { ChevronDown, Check } from 'lucide-react-native';
import { useColors, spacing, typography, borderRadius } from '@/theme';

interface PickerOption<T> {
    label: string;
    value: T;
}

interface PickerSelectProps<T> {
    value: T;
    options: PickerOption<T>[];
    onChange: (value: T) => void;
    placeholder?: string;
}

/**
 * Custom picker/select component that works on web and mobile
 * Shows a modal with options list
 */
export function PickerSelect<T extends string | number>({
    value,
    options,
    onChange,
    placeholder = 'Select option',
}: PickerSelectProps<T>) {
    const colors = useColors();
    const [visible, setVisible] = useState(false);
    const s = styles(colors);

    const selectedOption = options.find((opt) => opt.value === value);

    const handleSelect = (optionValue: T) => {
        onChange(optionValue);
        setVisible(false);
    };

    return (
        <>
            <Pressable style={s.trigger} onPress={() => setVisible(true)}>
                <Text style={[s.triggerText, !selectedOption && s.placeholderText]}>
                    {selectedOption?.label || placeholder}
                </Text>
                <ChevronDown size={16} color={colors.text.tertiary} />
            </Pressable>

            <Modal
                visible={visible}
                transparent
                animationType="fade"
                onRequestClose={() => setVisible(false)}
            >
                <Pressable style={s.overlay} onPress={() => setVisible(false)}>
                    <View style={s.modal} onStartShouldSetResponder={() => true}>
                        <ScrollView style={s.optionsList} showsVerticalScrollIndicator={false}>
                            {options.map((option, index) => (
                                <Pressable
                                    key={index}
                                    style={[
                                        s.option,
                                        option.value === value && s.optionSelected,
                                    ]}
                                    onPress={() => handleSelect(option.value)}
                                >
                                    <Text
                                        style={[
                                            s.optionText,
                                            option.value === value && s.optionTextSelected,
                                        ]}
                                    >
                                        {option.label}
                                    </Text>
                                    {option.value === value && (
                                        <Check size={18} color={colors.primary.DEFAULT} />
                                    )}
                                </Pressable>
                            ))}
                        </ScrollView>
                    </View>
                </Pressable>
            </Modal>
        </>
    );
}

const styles = (colors: any) =>
    StyleSheet.create({
        trigger: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: colors.background.secondary,
            borderWidth: 1,
            borderColor: colors.border.light,
            borderRadius: borderRadius.sm,
            padding: spacing.sm,
            gap: spacing.sm,
        },
        triggerText: {
            ...typography.body,
            color: colors.text.primary,
            flex: 1,
        },
        placeholderText: {
            color: colors.text.tertiary,
        },
        overlay: {
            flex: 1,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            justifyContent: 'center',
            alignItems: 'center',
            padding: spacing.lg,
        },
        modal: {
            backgroundColor: colors.background.elevated,
            borderRadius: borderRadius.lg,
            borderWidth: 1,
            borderColor: colors.border.DEFAULT,
            maxHeight: 400,
            width: '100%',
            maxWidth: 400,
            overflow: 'hidden',
        },
        optionsList: {
            maxHeight: 400,
        },
        option: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: spacing.md,
            borderBottomWidth: 1,
            borderBottomColor: colors.border.light,
        },
        optionSelected: {
            backgroundColor: colors.primary.DEFAULT + '10',
        },
        optionText: {
            ...typography.body,
            color: colors.text.primary,
            flex: 1,
        },
        optionTextSelected: {
            color: colors.primary.DEFAULT,
            fontWeight: '600',
        },
    });
