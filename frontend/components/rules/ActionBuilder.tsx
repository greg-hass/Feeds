import React from 'react';
import { View, Text, StyleSheet, Pressable, TextInput } from 'react-native';
import { X } from 'lucide-react-native';
import { useColors, spacing, typography, borderRadius } from '@/theme';
import { RuleAction, formatActionType } from '@/stores/rulesStore';
import { PickerSelect } from '@/components/ui/PickerSelect';

interface ActionBuilderProps {
    action: RuleAction;
    onChange: (action: RuleAction) => void;
    onRemove: () => void;
}

/**
 * Builder for individual rule action
 * Action type + Parameters configuration
 */
export function ActionBuilder({ action, onChange, onRemove }: ActionBuilderProps) {
    const colors = useColors();
    const s = styles(colors);

    const actionOptions: Array<{ label: string; value: RuleAction['type'] }> = [
        { label: 'Move to Folder', value: 'move_to_folder' },
        { label: 'Add Tag', value: 'add_tag' },
        { label: 'Mark as Read', value: 'mark_read' },
        { label: 'Bookmark', value: 'bookmark' },
        { label: 'Delete', value: 'delete' },
        { label: 'Send Notification', value: 'notify' },
    ];

    const handleTypeChange = (type: RuleAction['type']) => {
        onChange({
            type,
            params: {},
        });
    };

    const handleParamChange = (key: string, value: any) => {
        onChange({
            ...action,
            params: {
                ...action.params,
                [key]: value,
            },
        });
    };

    // Render parameter inputs based on action type
    const renderParams = () => {
        switch (action.type) {
            case 'move_to_folder':
                return (
                    <View style={s.paramContainer}>
                        <Text style={s.label}>Folder ID</Text>
                        <TextInput
                            style={s.input}
                            value={action.params.folder_id?.toString() || ''}
                            onChangeText={(text) => {
                                const num = parseInt(text, 10);
                                handleParamChange('folder_id', isNaN(num) ? undefined : num);
                            }}
                            placeholder="Enter folder ID"
                            placeholderTextColor={colors.text.tertiary}
                            keyboardType="numeric"
                        />
                        <Text style={s.helperText}>
                            TODO: Replace with folder picker
                        </Text>
                    </View>
                );

            case 'add_tag':
                return (
                    <View style={s.paramContainer}>
                        <Text style={s.label}>Tag Name</Text>
                        <TextInput
                            style={s.input}
                            value={action.params.tag || ''}
                            onChangeText={(text) => handleParamChange('tag', text)}
                            placeholder="e.g., important, read-later"
                            placeholderTextColor={colors.text.tertiary}
                        />
                    </View>
                );

            case 'notify':
                return (
                    <View style={s.paramContainer}>
                        <Text style={s.label}>Notification Message</Text>
                        <TextInput
                            style={[s.input, s.textArea]}
                            value={action.params.message || ''}
                            onChangeText={(text) => handleParamChange('message', text)}
                            placeholder="Optional custom message"
                            placeholderTextColor={colors.text.tertiary}
                            multiline
                            numberOfLines={2}
                        />
                    </View>
                );

            case 'mark_read':
            case 'bookmark':
            case 'delete':
                return (
                    <View style={s.paramContainer}>
                        <Text style={s.helperText}>
                            This action requires no additional parameters
                        </Text>
                    </View>
                );

            default:
                return null;
        }
    };

    return (
        <View style={s.container}>
            <View style={s.row}>
                <View style={s.typeContainer}>
                    <Text style={s.label}>Action</Text>
                    <PickerSelect
                        value={action.type}
                        options={actionOptions}
                        onChange={handleTypeChange}
                        placeholder="Select action"
                    />
                </View>

                <Pressable style={s.removeButton} onPress={onRemove}>
                    <X size={18} color={colors.error.DEFAULT} />
                </Pressable>
            </View>

            {renderParams()}
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
        typeContainer: {
            flex: 1,
        },
        label: {
            ...typography.caption,
            color: colors.text.secondary,
            marginBottom: spacing.xs,
        },
        helperText: {
            ...typography.caption,
            color: colors.text.tertiary,
            fontStyle: 'italic',
        },
        paramContainer: {
            gap: spacing.xs,
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
        textArea: {
            minHeight: 60,
            textAlignVertical: 'top',
        },
        removeButton: {
            padding: spacing.sm,
            borderRadius: borderRadius.full,
            backgroundColor: colors.error.DEFAULT + '10',
        },
    });
