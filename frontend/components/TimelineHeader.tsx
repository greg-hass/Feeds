import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { RefreshCw, CircleCheck } from 'lucide-react-native';
import { useColors } from '@/theme';
import { timelineStyles } from './Timeline.styles';

interface TimelineHeaderProps {
    title: string;
    timeLeft: string | null;
    isFeedLoading: boolean;
    isRefreshing: boolean;
    isMobile: boolean;
    onRefresh: () => void;
    onMarkAllRead: () => void;
}

const TimelineHeader: React.FC<TimelineHeaderProps> = ({
    title,
    timeLeft,
    isFeedLoading,
    isRefreshing,
    isMobile,
    onRefresh,
    onMarkAllRead,
}) => {
    const colors = useColors();
    const s = timelineStyles(colors, isMobile);

    return (
        <View style={s.header}>
            <View style={s.headerLeft}>
                <Text style={s.headerTitle} numberOfLines={1}>{title}</Text>
                {timeLeft && (
                    <View style={s.timerPill}>
                        {isRefreshing && <ActivityIndicator size={12} color={colors.primary.DEFAULT} />}
                        <Text style={s.timerText}>{timeLeft}</Text>
                    </View>
                )}
            </View>
            <View style={s.headerActions}>
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
