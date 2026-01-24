import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, Pressable, ScrollView, TextInput, Switch } from 'react-native';
import { X, Calendar, Tag, User, Folder, Rss } from 'lucide-react-native';
import { useColors, spacing, typography, borderRadius } from '@/theme';
import { SearchFilters, useSearchStore } from '@/stores/searchStore';
import { useFeedStore } from '@/stores/feedStore';
import { PickerSelect } from '@/components/ui/PickerSelect';

interface AdvancedFiltersModalProps {
    visible: boolean;
    onClose: () => void;
    onApply: (filters: SearchFilters) => void;
    initialFilters?: SearchFilters;
}

/**
 * Advanced search filters modal
 * Provides UI for all 12 filter types
 */
export function AdvancedFiltersModal({
    visible,
    onClose,
    onApply,
    initialFilters = {},
}: AdvancedFiltersModalProps) {
    const colors = useColors();
    const { availableTags, availableAuthors, fetchAutocompleteData, autocompleteLoading } = useSearchStore();
    const { feeds, folders } = useFeedStore();

    const [filters, setFilters] = useState<SearchFilters>(initialFilters);

    const s = styles(colors);

    // Fetch autocomplete data on mount
    useEffect(() => {
        if (visible && availableTags.length === 0 && availableAuthors.length === 0) {
            fetchAutocompleteData();
        }
    }, [visible]);

    // Update local state when initialFilters change
    useEffect(() => {
        setFilters(initialFilters);
    }, [initialFilters]);

    const handleApply = () => {
        onApply(filters);
        onClose();
    };

    const handleReset = () => {
        setFilters({});
    };

    const handleClose = () => {
        // Reset to initial filters on cancel
        setFilters(initialFilters);
        onClose();
    };

    const updateFilter = <K extends keyof SearchFilters>(key: K, value: SearchFilters[K]) => {
        setFilters((prev) => ({
            ...prev,
            [key]: value,
        }));
    };

    // Get active filters count
    const activeCount = Object.values(filters).filter(
        (v) => v !== undefined && v !== '' && (Array.isArray(v) ? v.length > 0 : true)
    ).length;

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
            <Pressable style={s.overlay} onPress={handleClose}>
                <View style={s.modal} onStartShouldSetResponder={() => true}>
                    {/* Header */}
                    <View style={s.header}>
                        <View style={s.headerLeft}>
                            <Text style={s.title}>Advanced Filters</Text>
                            {activeCount > 0 && (
                                <View style={s.badge}>
                                    <Text style={s.badgeText}>{activeCount}</Text>
                                </View>
                            )}
                        </View>
                        <Pressable style={s.closeButton} onPress={handleClose} accessibilityLabel="Close filters">
                            <X size={24} color={colors.text.primary} />
                        </Pressable>
                    </View>

                    <ScrollView style={s.content} showsVerticalScrollIndicator={false}>
                        {/* Author Filter */}
                        <View style={s.filterSection}>
                            <View style={s.filterHeader}>
                                <User size={18} color={colors.primary.DEFAULT} />
                                <Text style={s.filterTitle}>Author</Text>
                            </View>
                            <TextInput
                                style={s.input}
                                value={filters.author || ''}
                                onChangeText={(text) => updateFilter('author', text)}
                                placeholder="Filter by author name"
                                placeholderTextColor={colors.text.tertiary}
                                accessibilityLabel="Filter by author"
                            />
                        </View>

                        {/* Tags Filter */}
                        <View style={s.filterSection}>
                            <View style={s.filterHeader}>
                                <Tag size={18} color={colors.primary.DEFAULT} />
                                <Text style={s.filterTitle}>Tags</Text>
                            </View>
                            <TextInput
                                style={s.input}
                                value={filters.tags?.join(', ') || ''}
                                onChangeText={(text) => {
                                    const tags = text
                                        .split(',')
                                        .map((t) => t.trim())
                                        .filter(Boolean);
                                    updateFilter('tags', tags.length > 0 ? tags : undefined);
                                }}
                                placeholder="Enter comma-separated tags"
                                placeholderTextColor={colors.text.tertiary}
                                accessibilityLabel="Filter by tags"
                            />
                            {availableTags.length > 0 && (
                                <Text style={s.hint}>
                                    Available: {availableTags.slice(0, 5).join(', ')}
                                    {availableTags.length > 5 && '…'}
                                </Text>
                            )}
                        </View>

                        {/* Feed Filter */}
                        {feeds.length > 0 && (
                            <View style={s.filterSection}>
                                <View style={s.filterHeader}>
                                    <Rss size={18} color={colors.primary.DEFAULT} />
                                    <Text style={s.filterTitle}>Feeds</Text>
                                </View>
                                <TextInput
                                    style={s.input}
                                    value={filters.feed_ids?.join(', ') || ''}
                                    onChangeText={(text) => {
                                        const ids = text
                                            .split(',')
                                            .map((t) => parseInt(t.trim(), 10))
                                            .filter((n) => !isNaN(n));
                                        updateFilter('feed_ids', ids.length > 0 ? ids : undefined);
                                    }}
                                    placeholder="Enter comma-separated feed IDs"
                                    placeholderTextColor={colors.text.tertiary}
                                    keyboardType="numeric"
                                    accessibilityLabel="Filter by feed IDs"
                                />
                                <Text style={s.hint}>TODO: Replace with feed picker</Text>
                            </View>
                        )}

                        {/* Folder Filter */}
                        {folders.length > 0 && (
                            <View style={s.filterSection}>
                                <View style={s.filterHeader}>
                                    <Folder size={18} color={colors.primary.DEFAULT} />
                                    <Text style={s.filterTitle}>Folders</Text>
                                </View>
                                <TextInput
                                    style={s.input}
                                    value={filters.folder_ids?.join(', ') || ''}
                                    onChangeText={(text) => {
                                        const ids = text
                                            .split(',')
                                            .map((t) => parseInt(t.trim(), 10))
                                            .filter((n) => !isNaN(n));
                                        updateFilter('folder_ids', ids.length > 0 ? ids : undefined);
                                    }}
                                    placeholder="Enter comma-separated folder IDs"
                                    placeholderTextColor={colors.text.tertiary}
                                    keyboardType="numeric"
                                    accessibilityLabel="Filter by folder IDs"
                                />
                                <Text style={s.hint}>TODO: Replace with folder picker</Text>
                            </View>
                        )}

                        {/* Date Range */}
                        <View style={s.filterSection}>
                            <View style={s.filterHeader}>
                                <Calendar size={18} color={colors.primary.DEFAULT} />
                                <Text style={s.filterTitle}>Date Range</Text>
                            </View>
                            <View style={s.row}>
                                <View style={s.halfWidth}>
                                    <Text style={s.label}>From</Text>
                                    <TextInput
                                        style={s.input}
                                        value={filters.date_from || ''}
                                        onChangeText={(text) => updateFilter('date_from', text)}
                                        placeholder="YYYY-MM-DD"
                                        placeholderTextColor={colors.text.tertiary}
                                        accessibilityLabel="Filter from date"
                                    />
                                </View>
                                <View style={s.halfWidth}>
                                    <Text style={s.label}>To</Text>
                                    <TextInput
                                        style={s.input}
                                        value={filters.date_to || ''}
                                        onChangeText={(text) => updateFilter('date_to', text)}
                                        placeholder="YYYY-MM-DD"
                                        placeholderTextColor={colors.text.tertiary}
                                        accessibilityLabel="Filter to date"
                                    />
                                </View>
                            </View>
                            <Text style={s.hint}>TODO: Replace with date picker</Text>
                        </View>

                        {/* Toggle Filters */}
                        <View style={s.filterSection}>
                            <Text style={s.filterTitle}>Content Filters</Text>

                            <View style={s.toggleRow}>
                                <Text style={s.toggleLabel}>Read Status</Text>
                                <View style={s.toggleGroup}>
                                    <Pressable
                                        style={[
                                            s.toggleButton,
                                            filters.is_read === false && s.toggleButtonActive,
                                        ]}
                                        onPress={() =>
                                            updateFilter('is_read', filters.is_read === false ? undefined : false)
                                        }
                                    >
                                        <Text
                                            style={[
                                                s.toggleButtonText,
                                                filters.is_read === false && s.toggleButtonTextActive,
                                            ]}
                                        >
                                            Unread
                                        </Text>
                                    </Pressable>
                                    <Pressable
                                        style={[s.toggleButton, filters.is_read === true && s.toggleButtonActive]}
                                        onPress={() =>
                                            updateFilter('is_read', filters.is_read === true ? undefined : true)
                                        }
                                    >
                                        <Text
                                            style={[
                                                s.toggleButtonText,
                                                filters.is_read === true && s.toggleButtonTextActive,
                                            ]}
                                        >
                                            Read
                                        </Text>
                                    </Pressable>
                                </View>
                            </View>

                            <View style={s.toggleRow}>
                                <Text style={s.toggleLabel}>Bookmarked Only</Text>
                                <Switch
                                    value={filters.is_bookmarked || false}
                                    onValueChange={(value) => updateFilter('is_bookmarked', value || undefined)}
                                    trackColor={{ false: colors.border.DEFAULT, true: colors.primary.DEFAULT }}
                                    thumbColor={colors.background.DEFAULT}
                                />
                            </View>

                            <View style={s.toggleRow}>
                                <Text style={s.toggleLabel}>Has Video</Text>
                                <Switch
                                    value={filters.has_video || false}
                                    onValueChange={(value) => updateFilter('has_video', value || undefined)}
                                    trackColor={{ false: colors.border.DEFAULT, true: colors.primary.DEFAULT }}
                                    thumbColor={colors.background.DEFAULT}
                                />
                            </View>

                            <View style={s.toggleRow}>
                                <Text style={s.toggleLabel}>Has Audio</Text>
                                <Switch
                                    value={filters.has_audio || false}
                                    onValueChange={(value) => updateFilter('has_audio', value || undefined)}
                                    trackColor={{ false: colors.border.DEFAULT, true: colors.primary.DEFAULT}}
                                    thumbColor={colors.background.DEFAULT}
                                />
                            </View>
                        </View>

                        {/* Type Filter */}
                        <View style={s.filterSection}>
                            <Text style={s.filterTitle}>Content Type</Text>
                            <View style={s.typeButtons}>
                                {['rss', 'youtube', 'reddit', 'podcast'].map((type) => (
                                    <Pressable
                                        key={type}
                                        style={[s.typeButton, filters.type === type && s.typeButtonActive]}
                                        onPress={() => updateFilter('type', filters.type === type ? undefined : type)}
                                    >
                                        <Text style={[s.typeButtonText, filters.type === type && s.typeButtonTextActive]}>
                                            {type.charAt(0).toUpperCase() + type.slice(1)}
                                        </Text>
                                    </Pressable>
                                ))}
                            </View>
                        </View>
                    </ScrollView>

                    {/* Footer */}
                    <View style={s.footer}>
                        <Pressable style={s.resetButton} onPress={handleReset}>
                            <Text style={s.resetButtonText}>Reset All</Text>
                        </Pressable>
                        <Pressable style={s.applyButton} onPress={handleApply}>
                            <Text style={s.applyButtonText}>Apply Filters</Text>
                        </Pressable>
                    </View>
                </View>
            </Pressable>
        </Modal>
    );
}

const styles = (colors: any) =>
    StyleSheet.create({
        overlay: {
            flex: 1,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            justifyContent: 'flex-end',
        },
        modal: {
            backgroundColor: colors.background.elevated,
            borderTopLeftRadius: borderRadius.xl,
            borderTopRightRadius: borderRadius.xl,
            maxHeight: '90%',
        },
        header: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: spacing.lg,
            borderBottomWidth: 1,
            borderBottomColor: colors.border.DEFAULT,
        },
        headerLeft: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.sm,
        },
        title: {
            ...typography.h2,
            color: colors.text.primary,
        },
        badge: {
            backgroundColor: colors.primary.DEFAULT,
            borderRadius: borderRadius.full,
            paddingHorizontal: spacing.sm,
            paddingVertical: 2,
            minWidth: 24,
            alignItems: 'center',
        },
        badgeText: {
            ...typography.caption,
            color: colors.text.inverse,
            fontWeight: '700',
        },
        closeButton: {
            padding: spacing.sm,
        },
        content: {
            padding: spacing.lg,
        },
        filterSection: {
            marginBottom: spacing.xl,
        },
        filterHeader: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.sm,
            marginBottom: spacing.md,
        },
        filterTitle: {
            ...typography.h4,
            color: colors.text.primary,
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
            borderColor: colors.border.DEFAULT,
            borderRadius: borderRadius.md,
            padding: spacing.md,
        },
        hint: {
            ...typography.caption,
            color: colors.text.tertiary,
            marginTop: spacing.xs,
            fontStyle: 'italic',
        },
        row: {
            flexDirection: 'row',
            gap: spacing.md,
        },
        halfWidth: {
            flex: 1,
        },
        toggleRow: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingVertical: spacing.md,
            borderBottomWidth: 1,
            borderBottomColor: colors.border.light,
        },
        toggleLabel: {
            ...typography.body,
            color: colors.text.primary,
        },
        toggleGroup: {
            flexDirection: 'row',
            gap: spacing.xs,
        },
        toggleButton: {
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
            borderRadius: borderRadius.md,
            backgroundColor: colors.background.secondary,
            borderWidth: 1,
            borderColor: colors.border.DEFAULT,
        },
        toggleButtonActive: {
            backgroundColor: colors.primary.DEFAULT,
            borderColor: colors.primary.DEFAULT,
        },
        toggleButtonText: {
            ...typography.small,
            color: colors.text.secondary,
        },
        toggleButtonTextActive: {
            color: colors.text.inverse,
            fontWeight: '600',
        },
        typeButtons: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: spacing.sm,
        },
        typeButton: {
            paddingHorizontal: spacing.lg,
            paddingVertical: spacing.md,
            borderRadius: borderRadius.md,
            backgroundColor: colors.background.secondary,
            borderWidth: 1,
            borderColor: colors.border.DEFAULT,
        },
        typeButtonActive: {
            backgroundColor: colors.primary.DEFAULT,
            borderColor: colors.primary.DEFAULT,
        },
        typeButtonText: {
            ...typography.body,
            color: colors.text.secondary,
        },
        typeButtonTextActive: {
            color: colors.text.inverse,
            fontWeight: '600',
        },
        footer: {
            flexDirection: 'row',
            gap: spacing.md,
            padding: spacing.lg,
            borderTopWidth: 1,
            borderTopColor: colors.border.DEFAULT,
        },
        resetButton: {
            flex: 1,
            paddingVertical: spacing.md,
            borderRadius: borderRadius.md,
            backgroundColor: colors.background.secondary,
            borderWidth: 1,
            borderColor: colors.border.DEFAULT,
            alignItems: 'center',
        },
        resetButtonText: {
            ...typography.button,
            color: colors.text.primary,
        },
        applyButton: {
            flex: 2,
            paddingVertical: spacing.md,
            borderRadius: borderRadius.md,
            backgroundColor: colors.primary.DEFAULT,
            alignItems: 'center',
        },
        applyButtonText: {
            ...typography.button,
            color: colors.text.inverse,
        },
    });
