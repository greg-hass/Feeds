import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, ActivityIndicator, Animated, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Plus, AlertCircle, RefreshCw, Filter, X, Menu } from 'lucide-react-native';
import { useColors, spacing, typography, borderRadius } from '@/theme';
import { useRulesStore } from '@/stores';
import { RulesList } from '@/components/rules/RulesList';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import Sidebar from '@/components/Sidebar';
import { useWindowDimensions } from 'react-native';

/**
 * Automation Rules Dashboard
 * List all rules, create new ones, manage existing ones
 */
export default function RulesScreen() {
    const colors = useColors();
    const router = useRouter();
    const { width } = useWindowDimensions();
    const isMobile = width < 1024;
    const { rules, loading, error, fetchRules, clearError } = useRulesStore();
    const [showEnabledOnly, setShowEnabledOnly] = useState(false);
    const [showMenu, setShowMenu] = useState(false);
    const [sidebarAnim] = useState(new Animated.Value(-300));

    const s = styles(colors);

    const toggleMenu = () => {
        setShowMenu(!showMenu);
        Animated.timing(sidebarAnim, {
            toValue: showMenu ? -300 : 0,
            duration: 250,
            useNativeDriver: true,
        }).start();
    };

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
            <ScreenHeader
                title="Automations"
                showBackButton={false}
                showMenuButton={isMobile}
                onMenuPress={toggleMenu}
                rightActions={[
                    {
                        icon: <Filter size={20} color={showEnabledOnly ? colors.primary.DEFAULT : colors.text.secondary} />,
                        onPress: handleToggleFilter,
                        accessibilityLabel: showEnabledOnly ? 'Show all rules' : 'Show enabled only',
                    },
                    {
                        icon: <RefreshCw size={20} color={colors.text.secondary} />,
                        onPress: handleRefresh,
                        loading: loading,
                        accessibilityLabel: 'Refresh rules',
                    },
                    {
                        icon: <Plus size={20} color={colors.background.DEFAULT} />,
                        onPress: handleCreateRule,
                        accessibilityLabel: 'Create new rule',
                        variant: 'primary',
                    },
                ]}
            />

            <ScrollView style={s.scrollView} showsVerticalScrollIndicator={false}>
                {/* Subtitle */}
                <View style={s.subtitleContainer}>
                    <Text style={s.subtitle}>Automatically organize and manage your articles</Text>
                </View>

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

            {/* Mobile Sidebar */}
            {isMobile && (
                <>
                    {/* Backdrop */}
                    {showMenu && (
                        <TouchableOpacity
                            style={s.sidebarBackdrop}
                            activeOpacity={1}
                            onPress={toggleMenu}
                        />
                    )}
                    {/* Sidebar */}
                    <Animated.View
                        style={[
                            s.sidebarContainer,
                            {
                                transform: [{ translateX: sidebarAnim }],
                                width: 280,
                            },
                        ]}
                    >
                        <View style={{ alignItems: 'flex-end', padding: spacing.md }}>
                            <TouchableOpacity onPress={toggleMenu} style={{ padding: spacing.sm }} accessibilityLabel="Close menu">
                                <X size={24} color={colors.text.primary} />
                            </TouchableOpacity>
                        </View>
                        <Sidebar onNavigate={toggleMenu} />
                    </Animated.View>
                </>
            )}
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
        subtitleContainer: {
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.lg,
            paddingBottom: spacing.md,
        },
        subtitle: {
            ...typography.body,
            color: colors.text.secondary,
        },
        sidebarBackdrop: {
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            zIndex: 900,
        },
        sidebarContainer: {
            position: 'absolute',
            top: 0,
            left: 0,
            bottom: 0,
            backgroundColor: colors.background.elevated,
            borderRightWidth: 1,
            borderRightColor: colors.border.DEFAULT,
            zIndex: 1000,
            shadowColor: '#000',
            shadowOffset: { width: 2, height: 0 },
            shadowOpacity: 0.25,
            shadowRadius: 8,
            elevation: 5,
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
