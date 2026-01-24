import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Plus, AlertCircle } from 'lucide-react-native';
import { useColors, spacing, typography, borderRadius } from '@/theme';
import { useRulesStore } from '@/stores';
import { RulesList } from '@/components/rules/RulesList';
import { RulesHeader } from '@/components/rules/RulesHeader';

/**
 * Automation Rules Dashboard
 * List all rules, create new ones, manage existing ones
 */
export default function RulesScreen() {
    const colors = useColors();
    const router = useRouter();
    const { rules, loading, error, fetchRules, clearError } = useRulesStore();
    const [showEnabledOnly, setShowEnabledOnly] = useState(false);

    const s = styles(colors);

    // Fetch rules on mount
    useEffect(() => {
        fetchRules(showEnabledOnly);
    }, [showEnabledOnly]);

    // Filter rules
    const displayedRules = showEnabledOnly ? rules.filter((r) => r.enabled) : rules;

    const handleCreateRule = () => {
        router.push('/(app)/rules/create');
    };

    const handleRefresh = () => {
        fetchRules(showEnabledOnly);
    };

    const handleToggleFilter = () => {
        setShowEnabledOnly(!showEnabledOnly);
    };

    return (
        <View style={s.container}>
            <ScrollView style={s.scrollView} showsVerticalScrollIndicator={false}>
                <RulesHeader
                    onRefresh={handleRefresh}
                    onCreateRule={handleCreateRule}
                    onToggleFilter={handleToggleFilter}
                    showEnabledOnly={showEnabledOnly}
                />

                {error && (
                    <View style={s.errorContainer}>
                        <AlertCircle size={20} color={colors.error.DEFAULT} />
                        <Text style={s.errorText}>{error}</Text>
                        <Pressable onPress={clearError}>
                            <Text style={s.dismissText}>Dismiss</Text>
                        </Pressable>
                    </View>
                )}

                {loading && displayedRules.length === 0 ? (
                    <View style={s.loadingContainer}>
                        <ActivityIndicator size="large" color={colors.primary.DEFAULT} />
                        <Text style={s.loadingText}>Loading rules…</Text>
                    </View>
                ) : displayedRules.length === 0 ? (
                    <View style={s.emptyContainer}>
                        <Text style={s.emptyTitle}>No Automation Rules</Text>
                        <Text style={s.emptyText}>
                            {showEnabledOnly
                                ? 'No enabled rules found. Try disabling the filter.'
                                : 'Create your first automation rule to automatically organize your articles.'}
                        </Text>
                        {!showEnabledOnly && (
                            <Pressable style={s.createButton} onPress={handleCreateRule}>
                                <Plus size={20} color={colors.background.DEFAULT} />
                                <Text style={s.createButtonText}>Create First Rule</Text>
                            </Pressable>
                        )}
                    </View>
                ) : (
                    <RulesList rules={displayedRules} />
                )}
            </ScrollView>
        </View>
    );
}

const styles = (colors: any) =>
    StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: colors.background.DEFAULT,
        },
        scrollView: {
            flex: 1,
        },
        errorContainer: {
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colors.error.DEFAULT + '20',
            padding: spacing.md,
            marginHorizontal: spacing.lg,
            marginTop: spacing.md,
            borderRadius: borderRadius.md,
            gap: spacing.sm,
        },
        errorText: {
            ...typography.body,
            color: colors.error.DEFAULT,
            flex: 1,
        },
        dismissText: {
            ...typography.small,
            color: colors.error.DEFAULT,
            fontWeight: '600',
        },
        loadingContainer: {
            padding: spacing.xl,
            alignItems: 'center',
            gap: spacing.md,
        },
        loadingText: {
            ...typography.body,
            color: colors.text.secondary,
        },
        emptyContainer: {
            padding: spacing.xl,
            alignItems: 'center',
            gap: spacing.md,
        },
        emptyTitle: {
            ...typography.h2,
            color: colors.text.primary,
        },
        emptyText: {
            ...typography.body,
            color: colors.text.secondary,
            textAlign: 'center',
            maxWidth: 400,
        },
        createButton: {
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colors.primary.DEFAULT,
            paddingHorizontal: spacing.lg,
            paddingVertical: spacing.md,
            borderRadius: borderRadius.md,
            gap: spacing.sm,
            marginTop: spacing.md,
        },
        createButtonText: {
            ...typography.button,
            color: colors.background.DEFAULT,
        },
    });
