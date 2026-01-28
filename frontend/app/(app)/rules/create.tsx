import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Save, TestTube } from 'lucide-react-native';
import { useColors, spacing, typography, borderRadius } from '@/theme';
import { useRulesStore, RuleCondition, RuleAction, AutomationRule } from '@/stores/rulesStore';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { Input } from '@/components/ui/Input';
import { RuleBuilder } from '@/components/rules/RuleBuilder';

/**
 * Create new automation rule screen
 */
export default function CreateRuleScreen() {
    const colors = useColors();
    const router = useRouter();
    const { createRule, testRule } = useRulesStore();

    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [triggerType, setTriggerType] = useState<AutomationRule['trigger_type']>('new_article');
    const [conditions, setConditions] = useState<RuleCondition[]>([]);
    const [actions, setActions] = useState<RuleAction[]>([]);
    const [priority, setPriority] = useState(0);
    const [saving, setSaving] = useState(false);
    const [testing, setTesting] = useState(false);

    const s = styles(colors);

    const handleSave = async () => {
        // Validation
        if (!name.trim()) {
            Alert.alert('Validation Error', 'Please enter a rule name');
            return;
        }

        if (actions.length === 0) {
            Alert.alert('Validation Error', 'Please add at least one action');
            return;
        }

        setSaving(true);
        const rule = await createRule({
            name: name.trim(),
            description: description.trim() || undefined,
            trigger_type: triggerType,
            conditions,
            actions,
            priority,
        });
        setSaving(false);

        if (rule) {
            Alert.alert('Success', 'Rule created successfully', [
                {
                    text: 'OK',
                    onPress: () => router.back(),
                },
            ]);
        }
    };

    const handleTest = async () => {
        if (actions.length === 0) {
            Alert.alert('Validation Error', 'Please add at least one action to test');
            return;
        }

        setTesting(true);
        const result = await testRule(conditions, actions, 10);
        setTesting(false);

        if (result) {
            const matchedArticles = result.results.filter((r) => r.would_match);
            Alert.alert(
                'Test Results',
                `Out of ${result.total_tested} recent articles:\n\n` +
                    `✓ ${result.match_count} would match this rule\n` +
                    `✗ ${result.total_tested - result.match_count} would not match\n\n` +
                    (matchedArticles.length > 0
                        ? `Matching articles:\n${matchedArticles
                              .slice(0, 5)
                              .map((r) => `• ${r.article_title}`)
                              .join('\n')}`
                        : '')
            );
        }
    };

    const handleCancel = () => {
        if (name || description || conditions.length > 0 || actions.length > 0) {
            Alert.alert('Discard Changes?', 'Are you sure you want to discard this rule?', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Discard', style: 'destructive', onPress: () => router.back() },
            ]);
        } else {
            router.back();
        }
    };

    return (
        <View style={s.container}>
            <ScreenHeader
                title="Create Rule"
                backButtonVariant="close"
                onBackPress={handleCancel}
                rightActions={[
                    {
                        icon: <Save size={20} color={colors.text.inverse} />,
                        onPress: handleSave,
                        loading: saving,
                        accessibilityLabel: 'Save rule',
                        variant: 'primary',
                    },
                ]}
            />

            <ScrollView style={s.scrollView} showsVerticalScrollIndicator={false}>
                {/* Basic Info */}
                <View style={s.section}>
                    <SectionHeader title="Basic Information" />

                    <View style={s.field}>
                        <Input
                            label="Rule Name *"
                            value={name}
                            onChangeText={setName}
                            placeholder="e.g., Mark AI articles as read"
                        />
                    </View>

                    <View style={s.field}>
                        <Input
                            label="Description (Optional)"
                            value={description}
                            onChangeText={setDescription}
                            placeholder="Briefly describe what this rule does"
                            multiline
                            numberOfLines={3}
                        />
                    </View>

                    <View style={s.field}>
                        <Text style={s.fieldLabel}>Priority</Text>
                        <View style={s.priorityButtons}>
                            {[
                                { label: 'Low', value: 0 },
                                { label: 'Normal', value: 25 },
                                { label: 'Medium', value: 50 },
                                { label: 'High', value: 75 },
                            ].map((p) => (
                                <Pressable
                                    key={p.value}
                                    style={[s.priorityButton, priority === p.value && s.priorityButtonActive]}
                                    onPress={() => setPriority(p.value)}
                                >
                                    <Text
                                        style={[
                                            s.priorityButtonText,
                                            priority === p.value && s.priorityButtonTextActive,
                                        ]}
                                    >
                                        {p.label}
                                    </Text>
                                </Pressable>
                            ))}
                        </View>
                        <Text style={s.fieldHint}>Higher priority rules execute first</Text>
                    </View>
                </View>

                {/* Rule Builder */}
                <View style={s.section}>
                    <RuleBuilder
                        triggerType={triggerType}
                        conditions={conditions}
                        actions={actions}
                        onTriggerTypeChange={setTriggerType}
                        onConditionsChange={setConditions}
                        onActionsChange={setActions}
                    />
                </View>

                {/* Test Button */}
                <View style={s.section}>
                    <Pressable
                        style={[s.testButton, testing && s.testButtonDisabled]}
                        onPress={handleTest}
                        disabled={testing}
                    >
                        <TestTube size={20} color={colors.text.primary} />
                        <Text style={s.testButtonText}>
                            {testing ? 'Testing…' : 'Test Rule on Recent Articles'}
                        </Text>
                    </Pressable>
                </View>
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
        section: {
            padding: spacing.lg,
            gap: spacing.md,
            borderBottomWidth: 1,
            borderBottomColor: colors.border.light,
        },
        field: {
            gap: spacing.xs,
        },
        fieldHint: {
            ...typography.caption,
            color: colors.text.tertiary,
        },
        priorityButtons: {
            flexDirection: 'row',
            gap: spacing.sm,
        },
        priorityButton: {
            flex: 1,
            paddingVertical: spacing.sm,
            paddingHorizontal: spacing.md,
            borderRadius: borderRadius.md,
            backgroundColor: colors.background.elevated,
            borderWidth: 1,
            borderColor: colors.border.DEFAULT,
            alignItems: 'center',
        },
        priorityButtonActive: {
            backgroundColor: colors.primary.DEFAULT,
            borderColor: colors.primary.DEFAULT,
        },
        priorityButtonText: {
            ...typography.small,
            color: colors.text.secondary,
        },
        priorityButtonTextActive: {
            color: colors.background.DEFAULT,
            fontWeight: '600',
        },
        testButton: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: spacing.sm,
            paddingVertical: spacing.md,
            borderRadius: borderRadius.md,
            backgroundColor: colors.background.elevated,
            borderWidth: 1,
            borderColor: colors.border.DEFAULT,
        },
        testButtonDisabled: {
            opacity: 0.5,
        },
        testButtonText: {
            ...typography.button,
            color: colors.text.primary,
        },
    });
