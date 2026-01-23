import React from 'react';
import { View, Text, StyleSheet, Pressable, TextInput } from 'react-native';
import { X } from 'lucide-react-native';
import { useColors, spacing, typography, borderRadius } from '@/theme';
import { RuleCondition, formatField, formatOperator } from '@/stores/rulesStore';
import { PickerSelect } from '@/components/ui/PickerSelect';

interface ConditionBuilderProps {
    condition: RuleCondition;
    onChange: (condition: RuleCondition) => void;
    onRemove: () => void;
}

/**
 * Builder for individual rule condition
 * Field + Operator + Value configuration
 */
export function ConditionBuilder({ condition, onChange, onRemove }: ConditionBuilderProps) {
    const colors = useColors();
    const s = styles(colors);

    const fieldOptions: Array<{ label: string; value: RuleCondition['field'] }> = [
        { label: 'Title', value: 'title' },
        { label: 'Content', value: 'content' },
        { label: 'Author', value: 'author' },
        { label: 'URL', value: 'url' },
        { label: 'Feed', value: 'feed_id' },
        { label: 'Type', value: 'type' },
        { label: 'Tags', value: 'tags' },
    ];

    const operatorOptions: Array<{ label: string; value: RuleCondition['operator'] }> = [
        { label: 'Contains', value: 'contains' },
        { label: 'Does Not Contain', value: 'not_contains' },
        { label: 'Equals', value: 'equals' },
        { label: 'Does Not Equal', value: 'not_equals' },
        { label: 'Matches Pattern (Regex)', value: 'matches_regex' },
        { label: 'In List', value: 'in' },
        { label: 'Not In List', value: 'not_in' },
    ];

    const handleFieldChange = (field: RuleCondition['field']) => {
        onChange({
            ...condition,
            field,
            value: field === 'feed_id' ? 0 : '',
        });
    };

    const handleOperatorChange = (operator: RuleCondition['operator']) => {
        onChange({
            ...condition,
            operator,
            value: operator === 'in' || operator === 'not_in' ? [] : condition.value,
        });
    };

    const handleValueChange = (value: string) => {
        // TODO: Implement value input logic
        // For 'in' and 'not_in' operators, parse comma-separated values into array
        // For 'feed_id', parse as number
        // For other fields, use string value

        if (condition.operator === 'in' || condition.operator === 'not_in') {
            const values = value.split(',').map((v) => v.trim()).filter(Boolean);
            onChange({ ...condition, value: values });
        } else if (condition.field === 'feed_id') {
            const numValue = parseInt(value, 10);
            onChange({ ...condition, value: isNaN(numValue) ? 0 : numValue });
        } else {
            onChange({ ...condition, value });
        }
    };

    const getValuePlaceholder = (): string => {
        if (condition.operator === 'in' || condition.operator === 'not_in') {
            return 'Enter comma-separated values';
        }
        if (condition.field === 'feed_id') {
            return 'Enter feed ID';
        }
        if (condition.operator === 'matches_regex') {
            return 'Enter regex pattern';
        }
        return `Enter ${formatField(condition.field).toLowerCase()} value`;
    };

    const getDisplayValue = (): string => {
        if (Array.isArray(condition.value)) {
            return condition.value.join(', ');
        }
        return String(condition.value);
    };

    return (
        <View style={s.container}>
            <View style={s.row}>
                <View style={s.fieldContainer}>
                    <Text style={s.label}>Field</Text>
                    <PickerSelect
                        value={condition.field}
                        options={fieldOptions}
                        onChange={handleFieldChange}
                        placeholder="Select field"
                    />
                </View>

                <View style={s.operatorContainer}>
                    <Text style={s.label}>Operator</Text>
                    <PickerSelect
                        value={condition.operator}
                        options={operatorOptions}
                        onChange={handleOperatorChange}
                        placeholder="Select operator"
                    />
                </View>

                <Pressable style={s.removeButton} onPress={onRemove}>
                    <X size={18} color={colors.error.DEFAULT} />
                </Pressable>
            </View>

            <View style={s.valueRow}>
                <View style={s.valueContainer}>
                    <Text style={s.label}>Value</Text>
                    <TextInput
                        style={s.input}
                        value={getDisplayValue()}
                        onChangeText={handleValueChange}
                        placeholder={getValuePlaceholder()}
                        placeholderTextColor={colors.text.tertiary}
                    />
                </View>
            </View>

            {/* Case sensitivity toggle (only for text fields) */}
            {(condition.field === 'title' ||
                condition.field === 'content' ||
                condition.field === 'author' ||
                condition.field === 'url') && (
                <Pressable
                    style={s.caseSensitiveToggle}
                    onPress={() =>
                        onChange({
                            ...condition,
                            case_sensitive: !condition.case_sensitive,
                        })
                    }
                >
                    <View
                        style={[
                            s.checkbox,
                            condition.case_sensitive && s.checkboxActive,
                        ]}
                    >
                        {condition.case_sensitive && <View style={s.checkmark} />}
                    </View>
                    <Text style={s.caseSensitiveText}>Case sensitive</Text>
                </Pressable>
            )}
        </View>
    );
}

const styles = (colors: any) =>
    StyleSheet.create({
        container: {
            backgroundColor: colors.background.elevated,
            borderRadius: borderRadius.md,
            borderWidth: 1,
            borderColor: colors.border.DEFAULT,
            padding: spacing.md,
            gap: spacing.sm,
        },
        row: {
            flexDirection: 'row',
            gap: spacing.sm,
            alignItems: 'flex-end',
        },
        fieldContainer: {
            flex: 1,
        },
        operatorContainer: {
            flex: 1,
        },
        valueRow: {
            flexDirection: 'row',
            gap: spacing.sm,
        },
        valueContainer: {
            flex: 1,
        },
        label: {
            ...typography.caption,
            color: colors.text.secondary,
            marginBottom: spacing.xs,
        },
        input: {
            ...typography.body,
            color: colors.text.primary,
            backgroundColor: colors.background.secondary,
            borderWidth: 1,
            borderColor: colors.border.light,
            borderRadius: borderRadius.sm,
            padding: spacing.sm,
        },
        removeButton: {
            padding: spacing.sm,
            borderRadius: borderRadius.full,
            backgroundColor: colors.error.DEFAULT + '10',
        },
        caseSensitiveToggle: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.sm,
            paddingTop: spacing.xs,
        },
        checkbox: {
            width: 18,
            height: 18,
            borderRadius: 4,
            borderWidth: 2,
            borderColor: colors.border.DEFAULT,
            backgroundColor: colors.background.secondary,
            alignItems: 'center',
            justifyContent: 'center',
        },
        checkboxActive: {
            borderColor: colors.primary.DEFAULT,
            backgroundColor: colors.primary.DEFAULT,
        },
        checkmark: {
            width: 10,
            height: 10,
            borderRadius: 2,
            backgroundColor: colors.background.DEFAULT,
        },
        caseSensitiveText: {
            ...typography.small,
            color: colors.text.secondary,
        },
    });
