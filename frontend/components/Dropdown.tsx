import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, ScrollView } from 'react-native';
import { ChevronDown, Check } from 'lucide-react-native';
import { useColors, spacing, borderRadius } from '@/theme';

interface DropdownProps {
    value: string;
    options: { label: string; value: string | number }[];
    onSelect: (value: string | number) => void;
    placeholder?: string;
}

export const Dropdown: React.FC<DropdownProps> = ({ value, options, onSelect, placeholder }) => {
    const [isOpen, setIsOpen] = useState(false);
    const colors = useColors();
    const s = styles(colors);

    const selectedOption = options.find(opt => String(opt.value) === String(value));
    const displayValue = selectedOption?.label || placeholder || 'Select...';

    return (
        <>
            <TouchableOpacity 
                style={s.dropdownButton}
                onPress={() => setIsOpen(true)}
                activeOpacity={0.7}
            >
                <Text style={s.dropdownButtonText}>{displayValue}</Text>
                <ChevronDown size={16} color={colors.text.tertiary} />
            </TouchableOpacity>

            <Modal
                visible={isOpen}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setIsOpen(false)}
            >
                <TouchableOpacity 
                    style={s.modalOverlay}
                    activeOpacity={1}
                    onPress={() => setIsOpen(false)}
                >
                    <View style={s.modalContent}>
                        <ScrollView style={s.optionsList}>
                            {options.map((option) => (
                                <TouchableOpacity
                                    key={String(option.value)}
                                    style={[
                                        s.option,
                                        String(option.value) === String(value) && s.optionSelected
                                    ]}
                                    onPress={() => {
                                        onSelect(option.value);
                                        setIsOpen(false);
                                    }}
                                    activeOpacity={0.7}
                                >
                                    <Text style={[
                                        s.optionText,
                                        String(option.value) === String(value) && s.optionTextSelected
                                    ]}>
                                        {option.label}
                                    </Text>
                                    {String(option.value) === String(value) && (
                                        <Check size={16} color={colors.text.inverse} />
                                    )}
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                </TouchableOpacity>
            </Modal>
        </>
    );
};

const styles = (colors: any) => StyleSheet.create({
    dropdownButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: colors.background.tertiary,
        borderRadius: borderRadius.md,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        minWidth: 120,
        gap: spacing.sm,
    },
    dropdownButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.text.primary,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: spacing.xl,
    },
    modalContent: {
        backgroundColor: colors.background.secondary,
        borderRadius: borderRadius.lg,
        maxWidth: 300,
        width: '100%',
        maxHeight: 400,
        overflow: 'hidden',
    },
    optionsList: {
        maxHeight: 400,
    },
    option: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.border.DEFAULT,
    },
    optionSelected: {
        backgroundColor: colors.primary.DEFAULT,
    },
    optionText: {
        fontSize: 16,
        color: colors.text.primary,
    },
    optionTextSelected: {
        color: colors.text.inverse,
        fontWeight: '600',
    },
});