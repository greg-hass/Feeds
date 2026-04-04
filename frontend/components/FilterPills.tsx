import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useColors, spacing } from '@/theme';
import { EqualWidthPills, EqualWidthPillItem } from '@/components/ui/EqualWidthPills';

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

    const filterData: EqualWidthPillItem[] = [
        { id: 'unread', label: 'Unread', active: unreadOnly, onPress: () => onFilterChange('unread') },
        { id: 'all', label: 'All', active: !activeType, onPress: () => onFilterChange('all') },
        { id: 'rss', label: 'RSS', active: activeType === 'rss', onPress: () => onFilterChange('rss') },
        { id: 'youtube', label: 'Videos', active: activeType === 'youtube', onPress: () => onFilterChange('youtube') },
        { id: 'reddit', label: 'Reddit', active: activeType === 'reddit', onPress: () => onFilterChange('reddit') },
        { id: 'podcast', label: 'Podcasts', active: activeType === 'podcast', onPress: () => onFilterChange('podcast') },
    ].map((item) => ({
        id: item.id,
        label: item.label ?? item.id,
        active: item.active,
        onPress: item.onPress,
        accessibilityLabel: item.label,
        leading: item.id === 'unread' ? (
            <View style={[s.unreadDot, item.active ? s.unreadDotActive : null]} />
        ) : undefined,
    }));

    return (
        <View style={s.filterWrapper}>
            <EqualWidthPills
                items={filterData}
                rowStyle={s.filterRow}
                pillStyle={s.filterPill}
                activePillStyle={s.filterPillActive}
                textStyle={s.filterText}
                activeTextStyle={s.filterTextActive}
                inactiveBackgroundColor="transparent"
                activeBackgroundColor={colors.primary.DEFAULT}
                inactiveBorderColor="transparent"
                activeBorderColor="transparent"
                inactiveTextColor={colors.text.secondary}
                activeTextColor={colors.text.inverse}
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
        backgroundColor: colors.background.primary,
        paddingTop: spacing.xs,
        paddingBottom: spacing.sm,
        width: '100%',
    },
    filterRow: {
        paddingHorizontal: spacing.lg,
    },
    filterPill: {
        paddingVertical: 6,
    },
    filterPillActive: {
        backgroundColor: colors.primary?.DEFAULT ?? colors.primary,
    },
    filterText: {
        fontSize: 10,
        fontWeight: '700' as const,
        color: colors.text.secondary,
        textAlign: 'center' as const,
        minWidth: 0,
        flexShrink: 1,
    },
    filterTextActive: {
        color: colors.text.inverse,
    },
    unreadDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: colors.text.tertiary,
    },
    unreadDotActive: {
        backgroundColor: colors.primary.DEFAULT,
    },
});
