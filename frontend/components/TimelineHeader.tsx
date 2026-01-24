import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { RefreshCw, CircleCheck } from 'lucide-react-native';
import { formatDistanceToNow } from 'date-fns';
import { useColors } from '@/theme';
import { timelineStyles } from './Timeline.styles';

interface TimelineHeaderProps {
    title: string;
    contextLabel: string;
    timeLeft: string | null;
    lastRefreshAt: string | null;
    isFeedLoading: boolean;
    isRefreshing: boolean;
    isMobile: boolean;
    onRefresh: () => void;
    onMarkAllRead: () => void;
}

const TimelineHeader: React.FC<TimelineHeaderProps> = ({
    title,
    contextLabel,
    timeLeft,
    lastRefreshAt,
    isFeedLoading,
    isRefreshing,
    isMobile,
    onRefresh,
    onMarkAllRead,
}) => {
    const colors = useColors();
    const s = timelineStyles(colors, isMobile);
    const lastRefreshLabel = lastRefreshAt
        ? `Last refreshed ${formatDistanceToNow(new Date(lastRefreshAt), { addSuffix: true })}`
        : 'Last refreshed —';
    const contextLine = contextLabel ? `${contextLabel} · ${lastRefreshLabel}` : lastRefreshLabel;

    return (
        <View style={s.header}>
            <View style={s.headerLeft}>
                <View style={s.headerTitleStack}>
                    <View style={s.headerTopRow}>
                        <Text style={s.headerTitle} numberOfLines={1}>{title}</Text>
                        {isRefreshing && (
                            <View style={s.refreshPill}>
                                <ActivityIndicator size={10} color={colors.primary.DEFAULT} />
                                <Text style={s.refreshText}>Refreshing…</Text>
                            </View>
                        )}
                    </View>
                    <Text style={s.lastRefreshText}>{contextLine}</Text>
                </View>
            </View>
            <View style={s.headerActions}>
                {timeLeft && (
                    <View style={s.timerPill}>
                        <Text style={s.timerText}>{timeLeft}</Text>
                    </View>
                )}
                <TouchableOpacity
                    onPress={onRefresh}
                    style={s.iconButton}
                    disabled={isFeedLoading}
                    accessibilityLabel="Refresh feeds"
                    accessibilityRole="button"
                >
                    {isFeedLoading ? (
                        <ActivityIndicator size={18} color={colors.primary.DEFAULT} />
                    ) : (
                        <RefreshCw size={20} color={colors.text.secondary} />
                    )}
                </TouchableOpacity>
                <TouchableOpacity
                    onPress={onMarkAllRead}
                    style={s.iconButton}
                    accessibilityLabel="Mark all as read"
                    accessibilityRole="button"
                >
                    <CircleCheck size={20} color={colors.text.secondary} />
                </TouchableOpacity>
            </View>
        </View>
    );
};

export default React.memo(TimelineHeader);
