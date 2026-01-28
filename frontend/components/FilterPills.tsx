import React from 'react';
import { View, Text, TouchableOpacity, FlatList, StyleSheet } from 'react-native';
import { useColors, spacing, borderRadius, shadows } from '@/theme';

interface FilterItem {
    id: string;
    label?: string;
    type: 'toggle' | 'separator' | 'filter';
    active: boolean;
}

interface FilterPillsProps {
    unreadOnly: boolean;
    activeType?: string;
    onFilterChange: (filterId: string) => void;
}

/**
 * FilterPills - Memoized component for filter pills
 * Prevents unnecessary re-renders when parent state changes
 */
const FilterPills = React.memo<FilterPillsProps>(({ unreadOnly, activeType, onFilterChange }) => {
    const colors = useColors();
    const s = styles(colors);

    const filterData: FilterItem[] = [
        { id: 'unread', label: 'Unread Only', type: 'toggle', active: unreadOnly },
        { id: 'sep', type: 'separator', active: false },
        { id: 'all', label: 'All', type: 'filter', active: !activeType },
        { id: 'youtube', label: 'Videos', type: 'filter', active: activeType === 'youtube' },
        { id: 'podcast', label: 'Podcasts', type: 'filter', active: activeType === 'podcast' },
        { id: 'reddit', label: 'Reddit', type: 'filter', active: activeType === 'reddit' },
        { id: 'rss', label: 'Articles', type: 'filter', active: activeType === 'rss' },
    ];

    const renderFilterItem = ({ item }: { item: FilterItem }) => {
        if (item.type === 'separator') {
            return <View style={s.filterDivider} />;
        }

        return (
            <TouchableOpacity
                style={[
                    s.filterPill,
                    item.active ? s.filterPillActive : null,
                    item.id === 'unread' && item.active ? s.unreadPillActive : null
                ]}
                onPress={() => onFilterChange(item.id)}
                accessibilityRole="button"
                accessibilityLabel={item.label}
                accessibilityState={{ selected: item.active }}
            >
                {item.id === 'unread' && (
                    <View style={[s.unreadDot, item.active ? s.unreadDotActive : null]} />
                )}
                <Text style={[
                    s.filterText,
                    item.active ? s.filterTextActive : null
                ]}>
                    {item.label}
                </Text>
            </TouchableOpacity>
        );
    };

    return (
        <View style={s.filterWrapper}>
            <FlatList
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={s.filterScroll}
                data={filterData}
                keyExtractor={item => item.id}
                renderItem={renderFilterItem}
            />
        </View>
    );
}, (prevProps, nextProps) => {
    // Only re-render if filter state changes
    return (
        prevProps.unreadOnly === nextProps.unreadOnly &&
        prevProps.activeType === nextProps.activeType
    );
});

FilterPills.displayName = 'FilterPills';

export default FilterPills;

const styles = (colors: any) => StyleSheet.create({
    filterWrapper: {
        borderBottomWidth: 1,
        borderBottomColor: colors.border.DEFAULT,
        paddingTop: spacing.md,
        paddingBottom: spacing.md,
    },
    filterScroll: {
        paddingHorizontal: spacing.lg,
        gap: 8,
        alignItems: 'center' as const,
    },
    filterPill: {
        flexDirection: 'row' as const,
        alignItems: 'center' as const,
        gap: 6,
        paddingHorizontal: spacing.md,
        paddingVertical: 6,
        borderRadius: borderRadius.full,
        backgroundColor: colors.background.secondary,
        borderWidth: 1,
        borderColor: colors.border.DEFAULT,
    },
    filterPillActive: {
        backgroundColor: colors.primary?.DEFAULT ?? colors.primary,
        borderColor: colors.primary?.DEFAULT ?? colors.primary,
        ...shadows.colored(colors.primary?.DEFAULT ?? colors.primary),
    },
    unreadPillActive: {
        backgroundColor: colors.primary?.DEFAULT ?? colors.primary,
        borderColor: colors.primary?.DEFAULT ?? colors.primary,
    },
    filterText: {
        fontSize: 12,
        fontWeight: '700' as const,
        color: colors.text.secondary,
    },
    filterTextActive: {
        color: colors.background.primary,
    },
    filterDivider: {
        width: 1,
        height: 16,
        backgroundColor: colors.border.DEFAULT,
        marginHorizontal: 4,
    },
    unreadDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: colors.text.tertiary,
    },
    unreadDotActive: {
        backgroundColor: '#fff',
    },
});
