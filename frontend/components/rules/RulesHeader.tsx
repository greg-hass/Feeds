import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { RefreshCw, Plus, Filter } from 'lucide-react-native';
import { useColors, spacing, typography, borderRadius } from '@/theme';

interface RulesHeaderProps {
    onRefresh: () => void;
    onCreateRule: () => void;
    onToggleFilter: () => void;
    showEnabledOnly: boolean;
}

/**
 * Header for rules dashboard with actions
 */
export function RulesHeader({ onRefresh, onCreateRule, onToggleFilter, showEnabledOnly }: RulesHeaderProps) {
    const colors = useColors();
    const s = styles(colors);

    return (
        <View style={s.container}>
            <View style={s.titleRow}>
                <View>
                    <Text style={s.title}>Automation Rules</Text>
                    <Text style={s.subtitle}>Automatically organize and manage your articles</Text>
                </View>
            </View>

            <View style={s.actions}>
                <Pressable
                    style={[s.actionButton, showEnabledOnly && s.filterActive]}
                    onPress={onToggleFilter}
                >
                    <Filter size={18} color={showEnabledOnly ? colors.primary.DEFAULT : colors.text.secondary} />
                    <Text style={[s.actionText, showEnabledOnly && s.filterActiveText]}>
                        {showEnabledOnly ? 'Enabled Only' : 'All Rules'}
                    </Text>
                </Pressable>

                <Pressable style={s.actionButton} onPress={onRefresh}>
                    <RefreshCw size={18} color={colors.text.secondary} />
                    <Text style={s.actionText}>Refresh</Text>
                </Pressable>

                <Pressable style={s.primaryButton} onPress={onCreateRule}>
                    <Plus size={18} color={colors.background.DEFAULT} />
                    <Text style={s.primaryButtonText}>New Rule</Text>
                </Pressable>
            </View>
        </View>
    );
}

const styles = (colors: any) =>
    StyleSheet.create({
        container: {
            padding: spacing.lg,
            gap: spacing.md,
        },
        titleRow: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
        },
        title: {
            ...typography.h1,
            color: colors.text.primary,
        },
        subtitle: {
            ...typography.body,
            color: colors.text.secondary,
            marginTop: spacing.xs,
        },
        actions: {
            flexDirection: 'row',
            gap: spacing.sm,
        },
        actionButton: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
            borderRadius: borderRadius.md,
            backgroundColor: colors.background.elevated,
            borderWidth: 1,
            borderColor: colors.border.DEFAULT,
            gap: spacing.xs,
        },
        actionText: {
            ...typography.small,
            color: colors.text.secondary,
        },
        filterActive: {
            backgroundColor: colors.primary.DEFAULT + '20',
            borderColor: colors.primary.DEFAULT,
        },
        filterActiveText: {
            color: colors.primary.DEFAULT,
            fontWeight: '600',
        },
        primaryButton: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
            borderRadius: borderRadius.md,
            backgroundColor: colors.primary.DEFAULT,
            gap: spacing.xs,
        },
        primaryButtonText: {
            ...typography.button,
            color: colors.background.DEFAULT,
        },
    });
