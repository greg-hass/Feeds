import React from 'react';
import { View, Text, TouchableOpacity, FlatList, StyleSheet } from 'react-native';
import { useColors, spacing, borderRadius } from '@/theme';

interface FilterItem {
    id: string;
    label?: string;
    type: 'toggle' | 'filter';
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
        { id: 'unread', label: 'Unread', type: 'toggle', active: unreadOnly },
        { id: 'all', label: 'All', type: 'filter', active: !activeType },
        { id: 'rss', label: 'RSS', type: 'filter', active: activeType === 'rss' },
        { id: 'youtube', label: 'Videos', type: 'filter', active: activeType === 'youtube' },
        { id: 'reddit', label: 'Reddit', type: 'filter', active: activeType === 'reddit' },
        { id: 'podcast', label: 'Podcasts', type: 'filter', active: activeType === 'podcast' },
    ];

    const renderFilterItem = ({ item }: { item: FilterItem }) => {
        return (
            <TouchableOpacity
                style={[
                    s.filterPill,
                    item.active ? s.filterPillActive : null,
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
        paddingTop: spacing.xs,
        paddingBottom: spacing.sm,
    },
    filterScroll: {
        paddingHorizontal: spacing.lg,
        gap: 4,
        alignItems: 'center' as const,
    },
    filterPill: {
        flexDirection: 'row' as const,
        alignItems: 'center' as const,
        justifyContent: 'center' as const,
        gap: 4,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: borderRadius.full,
        backgroundColor: colors.background.secondary,
        borderWidth: 1,
        borderColor: colors.border.DEFAULT,
        minWidth: 0,
    },
    filterPillActive: {
        backgroundColor: colors.primary?.soft ?? `${colors.primary?.DEFAULT ?? colors.primary}22`,
        borderColor: colors.primary?.DEFAULT ?? colors.primary,
    },
    filterText: {
        fontSize: 10,
        fontWeight: '700' as const,
        color: colors.text.secondary,
    },
    filterTextActive: {
        color: colors.primary?.DEFAULT ?? colors.primary,
    },
    unreadDot: {
        width: 5,
        height: 5,
        borderRadius: 2.5,
        backgroundColor: colors.text.tertiary,
    },
    unreadDotActive: {
        backgroundColor: colors.primary?.DEFAULT ?? colors.primary,
    },
});
