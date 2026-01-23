import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Plus, Filter, Zap } from 'lucide-react-native';
import { useColors, spacing, typography, borderRadius } from '@/theme';
import { RuleCondition, RuleAction, AutomationRule, formatTriggerType } from '@/stores/rulesStore';
import { ConditionBuilder } from './ConditionBuilder';
import { ActionBuilder } from './ActionBuilder';

interface RuleBuilderProps {
    triggerType: AutomationRule['trigger_type'];
    conditions: RuleCondition[];
    actions: RuleAction[];
    onTriggerTypeChange: (type: AutomationRule['trigger_type']) => void;
    onConditionsChange: (conditions: RuleCondition[]) => void;
    onActionsChange: (actions: RuleAction[]) => void;
}

/**
 * Visual rule builder component
 * Allows users to configure triggers, conditions (AND logic), and actions
 */
export function RuleBuilder({
    triggerType,
    conditions,
    actions,
    onTriggerTypeChange,
    onConditionsChange,
    onActionsChange,
}: RuleBuilderProps) {
    const colors = useColors();
    const s = styles(colors);

    const handleAddCondition = () => {
        onConditionsChange([
            ...conditions,
            {
                field: 'title',
                operator: 'contains',
                value: '',
                case_sensitive: false,
            },
        ]);
    };

    const handleUpdateCondition = (index: number, condition: RuleCondition) => {
        const updated = [...conditions];
        updated[index] = condition;
        onConditionsChange(updated);
    };

    const handleRemoveCondition = (index: number) => {
        onConditionsChange(conditions.filter((_, i) => i !== index));
    };

    const handleAddAction = () => {
        onActionsChange([
            ...actions,
            {
                type: 'add_tag',
                params: {},
            },
        ]);
    };

    const handleUpdateAction = (index: number, action: RuleAction) => {
        const updated = [...actions];
        updated[index] = action;
        onActionsChange(updated);
    };

    const handleRemoveAction = (index: number) => {
        onActionsChange(actions.filter((_, i) => i !== index));
    };

    return (
        <View style={s.container}>
            {/* Trigger Type */}
            <View style={s.section}>
                <View style={s.sectionHeader}>
                    <Zap size={18} color={colors.primary.DEFAULT} />
                    <Text style={s.sectionTitle}>Trigger</Text>
                </View>
                <View style={s.triggerButtons}>
                    {(['new_article', 'keyword_match', 'feed_match', 'author_match'] as const).map((type) => (
                        <Pressable
                            key={type}
                            style={[s.triggerButton, triggerType === type && s.triggerButtonActive]}
                            onPress={() => onTriggerTypeChange(type)}
                        >
                            <Text
                                style={[s.triggerButtonText, triggerType === type && s.triggerButtonTextActive]}
                            >
                                {formatTriggerType(type)}
                            </Text>
                        </Pressable>
                    ))}
                </View>
                <Text style={s.helperText}>When should this rule run?</Text>
            </View>

            {/* Conditions */}
            <View style={s.section}>
                <View style={s.sectionHeader}>
                    <Filter size={18} color={colors.primary.DEFAULT} />
                    <Text style={s.sectionTitle}>Conditions (AND logic)</Text>
                </View>

                {conditions.length === 0 ? (
                    <View style={s.emptyState}>
                        <Text style={s.emptyStateText}>
                            No conditions added. Rule will match all articles.
                        </Text>
                    </View>
                ) : (
                    <View style={s.conditionsList}>
                        {conditions.map((condition, index) => (
                            <View key={index}>
                                <ConditionBuilder
                                    condition={condition}
                                    onChange={(c) => handleUpdateCondition(index, c)}
                                    onRemove={() => handleRemoveCondition(index)}
                                />
                                {index < conditions.length - 1 && (
                                    <View style={s.andConnector}>
                                        <View style={s.andLine} />
                                        <Text style={s.andText}>AND</Text>
                                        <View style={s.andLine} />
                                    </View>
                                )}
                            </View>
                        ))}
                    </View>
                )}

                <Pressable style={s.addButton} onPress={handleAddCondition}>
                    <Plus size={18} color={colors.primary.DEFAULT} />
                    <Text style={s.addButtonText}>Add Condition</Text>
                </Pressable>
                <Text style={s.helperText}>
                    All conditions must be true for the rule to match (AND logic)
                </Text>
            </View>

            {/* Actions */}
            <View style={s.section}>
                <View style={s.sectionHeader}>
                    <Zap size={18} color={colors.primary.DEFAULT} />
                    <Text style={s.sectionTitle}>Actions *</Text>
                </View>

                {actions.length === 0 ? (
                    <View style={s.emptyState}>
                        <Text style={s.emptyStateText}>
                            Add at least one action to execute when conditions match
                        </Text>
                    </View>
                ) : (
                    <View style={s.actionsList}>
                        {actions.map((action, index) => (
                            <ActionBuilder
                                key={index}
                                action={action}
                                onChange={(a) => handleUpdateAction(index, a)}
                                onRemove={() => handleRemoveAction(index)}
                            />
                        ))}
                    </View>
                )}

                <Pressable style={s.addButton} onPress={handleAddAction}>
                    <Plus size={18} color={colors.primary.DEFAULT} />
                    <Text style={s.addButtonText}>Add Action</Text>
                </Pressable>
                <Text style={s.helperText}>All actions will execute when the rule matches</Text>
            </View>
        </View>
    );
}

const styles = (colors: any) =>
    StyleSheet.create({
        container: {
            gap: spacing.xl,
        },
        section: {
            gap: spacing.md,
        },
        sectionHeader: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.sm,
        },
        sectionTitle: {
            ...typography.h4,
            color: colors.text.primary,
        },
        helperText: {
            ...typography.caption,
            color: colors.text.tertiary,
        },
        triggerButtons: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: spacing.sm,
        },
        triggerButton: {
            paddingVertical: spacing.sm,
            paddingHorizontal: spacing.md,
            borderRadius: borderRadius.md,
            backgroundColor: colors.background.elevated,
            borderWidth: 1,
            borderColor: colors.border.DEFAULT,
        },
        triggerButtonActive: {
            backgroundColor: colors.primary.DEFAULT,
            borderColor: colors.primary.DEFAULT,
        },
        triggerButtonText: {
            ...typography.small,
            color: colors.text.secondary,
        },
        triggerButtonTextActive: {
            color: colors.background.DEFAULT,
            fontWeight: '600',
        },
        emptyState: {
            padding: spacing.lg,
            backgroundColor: colors.background.elevated,
            borderRadius: borderRadius.md,
            borderWidth: 1,
            borderColor: colors.border.light,
            borderStyle: 'dashed',
        },
        emptyStateText: {
            ...typography.body,
            color: colors.text.tertiary,
            textAlign: 'center',
        },
        conditionsList: {
            gap: spacing.md,
        },
        actionsList: {
            gap: spacing.sm,
        },
        andConnector: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.sm,
            paddingVertical: spacing.xs,
        },
        andLine: {
            flex: 1,
            height: 1,
            backgroundColor: colors.border.light,
        },
        andText: {
            ...typography.caption,
            color: colors.text.tertiary,
            fontWeight: '600',
        },
        addButton: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: spacing.sm,
            paddingVertical: spacing.md,
            borderRadius: borderRadius.md,
            backgroundColor: colors.primary.DEFAULT + '10',
            borderWidth: 1,
            borderColor: colors.primary.DEFAULT + '40',
            borderStyle: 'dashed',
        },
        addButtonText: {
            ...typography.button,
            color: colors.primary.DEFAULT,
        },
    });
