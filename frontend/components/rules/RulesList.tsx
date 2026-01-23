import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, Switch, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import {
    ChevronRight,
    Trash2,
    Settings,
    BarChart3,
    Power,
    AlertTriangle,
} from 'lucide-react-native';
import { useColors, spacing, typography, borderRadius } from '@/theme';
import {
    useRulesStore,
    AutomationRule,
    formatTriggerType,
    getPriorityColor,
    formatDate,
} from '@/stores/rulesStore';

interface RulesListProps {
    rules: AutomationRule[];
}

/**
 * List of automation rules with toggle, edit, delete actions
 */
export function RulesList({ rules }: RulesListProps) {
    const colors = useColors();
    const router = useRouter();
    const { toggleRule, deleteRule } = useRulesStore();
    const [togglingId, setTogglingId] = useState<number | null>(null);

    const s = styles(colors);

    const handleToggle = async (rule: AutomationRule) => {
        setTogglingId(rule.id);
        await toggleRule(rule.id, !rule.enabled);
        setTogglingId(null);
    };

    const handleDelete = (rule: AutomationRule) => {
        Alert.alert(
            'Delete Rule',
            `Are you sure you want to delete "${rule.name}"? This action cannot be undone.`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        await deleteRule(rule.id);
                    },
                },
            ]
        );
    };

    const handleEdit = (rule: AutomationRule) => {
        router.push(`/(app)/rules/${rule.id}`);
    };

    const handleViewStats = (rule: AutomationRule) => {
        router.push(`/(app)/rules/${rule.id}/stats`);
    };

    return (
        <View style={s.container}>
            {rules.map((rule) => (
                <View key={rule.id} style={s.ruleCard}>
                    {/* Header */}
                    <View style={s.ruleHeader}>
                        <View style={s.ruleHeaderLeft}>
                            <View style={[s.priorityIndicator, { backgroundColor: getPriorityColor(rule.priority) }]} />
                            <View style={s.ruleTitleContainer}>
                                <Text style={s.ruleName} numberOfLines={1}>
                                    {rule.name}
                                </Text>
                                {rule.description && (
                                    <Text style={s.ruleDescription} numberOfLines={2}>
                                        {rule.description}
                                    </Text>
                                )}
                            </View>
                        </View>

                        <Switch
                            value={rule.enabled}
                            onValueChange={() => handleToggle(rule)}
                            disabled={togglingId === rule.id}
                            trackColor={{ false: colors.border.DEFAULT, true: colors.primary.DEFAULT }}
                            thumbColor={colors.background.DEFAULT}
                        />
                    </View>

                    {/* Details */}
                    <View style={s.ruleDetails}>
                        <View style={s.detailRow}>
                            <Text style={s.detailLabel}>Trigger:</Text>
                            <Text style={s.detailValue}>{formatTriggerType(rule.trigger_type)}</Text>
                        </View>
                        <View style={s.detailRow}>
                            <Text style={s.detailLabel}>Conditions:</Text>
                            <Text style={s.detailValue}>{rule.conditions.length}</Text>
                        </View>
                        <View style={s.detailRow}>
                            <Text style={s.detailLabel}>Actions:</Text>
                            <Text style={s.detailValue}>{rule.actions.length}</Text>
                        </View>
                        <View style={s.detailRow}>
                            <Text style={s.detailLabel}>Matches:</Text>
                            <Text style={s.detailValue}>{rule.match_count}</Text>
                        </View>
                        {rule.last_matched_at && (
                            <View style={s.detailRow}>
                                <Text style={s.detailLabel}>Last Match:</Text>
                                <Text style={s.detailValue}>{formatDate(rule.last_matched_at)}</Text>
                            </View>
                        )}
                    </View>

                    {/* Actions */}
                    <View style={s.ruleActions}>
                        <Pressable style={s.actionButton} onPress={() => handleEdit(rule)}>
                            <Settings size={16} color={colors.text.secondary} />
                            <Text style={s.actionButtonText}>Edit</Text>
                        </Pressable>

                        <Pressable style={s.actionButton} onPress={() => handleViewStats(rule)}>
                            <BarChart3 size={16} color={colors.text.secondary} />
                            <Text style={s.actionButtonText}>Stats</Text>
                        </Pressable>

                        <Pressable style={[s.actionButton, s.deleteButton]} onPress={() => handleDelete(rule)}>
                            <Trash2 size={16} color={colors.error.DEFAULT} />
                            <Text style={[s.actionButtonText, s.deleteButtonText]}>Delete</Text>
                        </Pressable>
                    </View>

                    {/* Warning if disabled */}
                    {!rule.enabled && (
                        <View style={s.disabledBanner}>
                            <AlertTriangle size={14} color={colors.warning.DEFAULT} />
                            <Text style={s.disabledText}>This rule is disabled and won't execute</Text>
                        </View>
                    )}
                </View>
            ))}
        </View>
    );
}

const styles = (colors: any) =>
    StyleSheet.create({
        container: {
            padding: spacing.lg,
            gap: spacing.md,
        },
        ruleCard: {
            backgroundColor: colors.background.elevated,
            borderRadius: borderRadius.lg,
            borderWidth: 1,
            borderColor: colors.border.DEFAULT,
            padding: spacing.md,
            gap: spacing.md,
        },
        ruleHeader: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: spacing.sm,
        },
        ruleHeaderLeft: {
            flex: 1,
            flexDirection: 'row',
            alignItems: 'flex-start',
            gap: spacing.sm,
        },
        priorityIndicator: {
            width: 4,
            height: '100%',
            borderRadius: 2,
            marginTop: 2,
        },
        ruleTitleContainer: {
            flex: 1,
            gap: spacing.xs,
        },
        ruleName: {
            ...typography.h4,
            color: colors.text.primary,
        },
        ruleDescription: {
            ...typography.small,
            color: colors.text.secondary,
        },
        ruleDetails: {
            gap: spacing.xs,
            paddingLeft: spacing.md,
        },
        detailRow: {
            flexDirection: 'row',
            gap: spacing.sm,
        },
        detailLabel: {
            ...typography.small,
            color: colors.text.tertiary,
            width: 80,
        },
        detailValue: {
            ...typography.small,
            color: colors.text.secondary,
            flex: 1,
        },
        ruleActions: {
            flexDirection: 'row',
            gap: spacing.sm,
            paddingTop: spacing.sm,
            borderTopWidth: 1,
            borderTopColor: colors.border.light,
        },
        actionButton: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: spacing.sm,
            paddingVertical: spacing.xs,
            borderRadius: borderRadius.sm,
            backgroundColor: colors.background.secondary,
            gap: spacing.xs,
        },
        actionButtonText: {
            ...typography.small,
            color: colors.text.secondary,
        },
        deleteButton: {
            backgroundColor: colors.error.DEFAULT + '10',
        },
        deleteButtonText: {
            color: colors.error.DEFAULT,
        },
        disabledBanner: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.xs,
            paddingTop: spacing.sm,
            borderTopWidth: 1,
            borderTopColor: colors.border.light,
        },
        disabledText: {
            ...typography.caption,
            color: colors.warning.DEFAULT,
            fontStyle: 'italic',
        },
    });
