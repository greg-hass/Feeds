import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { RefreshCw, CircleCheck } from 'lucide-react-native';
import { useColors } from '@/theme';
import { timelineStyles } from './Timeline.styles';

interface TimelineHeaderProps {
    title: string;
    lastRefreshed: Date | null;
    isFeedLoading: boolean;
    isRefreshing: boolean;
    isMobile: boolean;
    onRefresh: () => void;
    onMarkAllRead: () => void;
}

const TimelineHeader: React.FC<TimelineHeaderProps> = ({
    title,
    lastRefreshed,
    isFeedLoading,
    isRefreshing,
    isMobile,
    onRefresh,
    onMarkAllRead,
}) => {
    const colors = useColors();
    const s = timelineStyles(colors, isMobile);

    const formatLastRefreshed = (date: Date | null): string => {
        if (!date) return '';
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const minutes = Math.floor(diff / 60000);
        if (minutes < 1) return 'Just now';
        if (minutes < 60) return `${minutes}m ago`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours}h ago`;
        return date.toLocaleDateString();
    };

    return (
        <View style={s.header}>
            <View style={s.headerLeft}>
                <Text style={s.headerTitle} numberOfLines={1}>{title}</Text>
                {isRefreshing && (
                    <View style={s.refreshPill}>
                        <ActivityIndicator size={10} color={colors.primary?.DEFAULT ?? colors.primary} />
                        <Text style={s.refreshText}>Refreshing…</Text>
                    </View>
                )}
            </View>
            <View style={s.headerActions}>
                {lastRefreshed && !isRefreshing && (
                    <Text style={s.timerText}>{formatLastRefreshed(lastRefreshed)}</Text>
                )}
                <TouchableOpacity
                    onPress={onRefresh}
                    style={s.iconButton}
                    disabled={isFeedLoading}
                    accessibilityLabel="Refresh feeds"
                    accessibilityRole="button"
                >
                    {isFeedLoading ? (
                        <ActivityIndicator size={18} color={colors.primary?.DEFAULT ?? colors.primary} />
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
