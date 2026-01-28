import { useCallback, useState } from 'react';
import { View, ScrollView, StyleSheet, useWindowDimensions, Animated, TouchableOpacity, Alert } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useColors, spacing } from '@/theme';
import { useAnalyticsStore } from '@/stores/analyticsStore';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import Sidebar from '@/components/Sidebar';
import { RefreshCw, Download, X } from 'lucide-react-native';
import { shareContent } from '@/utils/share';

import { AnalyticsSummary } from '@/components/analytics/AnalyticsSummary';
import { ReadingTimeChart } from '@/components/analytics/ReadingTimeChart';
import { FeedEngagementList } from '@/components/analytics/FeedEngagementList';
import { TopArticlesList } from '@/components/analytics/TopArticlesList';
import { TimeOfDayHeatmap } from '@/components/analytics/TimeOfDayHeatmap';
import { DayOfWeekChart } from '@/components/analytics/DayOfWeekChart';
import { TopicDistributionChart } from '@/components/analytics/TopicDistributionChart';

export default function AnalyticsScreen() {
    const colors = useColors();
    const { width } = useWindowDimensions();
    const isMobile = width < 1024;
    const [showMenu, setShowMenu] = useState(false);
    const [sidebarAnim] = useState(new Animated.Value(-300));

    const { fetchAll, isLoading, exportData } = useAnalyticsStore();

    // Refetch analytics data whenever the screen is focused
    useFocusEffect(
        useCallback(() => {
            fetchAll();
        }, [fetchAll])
    );

    const toggleMenu = () => {
        setShowMenu(!showMenu);
        Animated.timing(sidebarAnim, {
            toValue: showMenu ? -300 : 0,
            duration: 250,
            useNativeDriver: true,
        }).start();
    };

    const handleExport = async () => {
        try {
            const data = await exportData();
            const jsonString = JSON.stringify(data, null, 2);
            await shareContent({
                title: 'Analytics Export',
                message: jsonString,
            });
        } catch (error) {
            Alert.alert('Export Failed', 'Could not export analytics data');
        }
    };

    const s = styles(colors, isMobile);

    return (
        <View style={s.container}>
            <ScreenHeader
                title="Analytics"
                showBackButton={false}
                showMenuButton={isMobile}
                onMenuPress={toggleMenu}
                rightActions={[
                    {
                        icon: <RefreshCw size={20} color={colors.text.secondary} />,
                        onPress: fetchAll,
                        loading: isLoading,
                        accessibilityLabel: 'Refresh analytics',
                    },
                    {
                        icon: <Download size={20} color={colors.text.secondary} />,
                        onPress: handleExport,
                        accessibilityLabel: 'Export analytics',
                    },
                ]}
            />

            <ScrollView
                style={s.scrollView}
                contentContainerStyle={s.content}
                showsVerticalScrollIndicator={false}
            >
                {/* Summary Cards */}
                <AnalyticsSummary />

                {/* Charts Grid */}
                <View style={s.chartsGrid}>
                    {/* Reading Time Trend */}
                    <View style={isMobile ? s.fullWidth : s.halfWidth}>
                        <ReadingTimeChart />
                    </View>

                    {/* Time of Day Heatmap */}
                    <View style={isMobile ? s.fullWidth : s.halfWidth}>
                        <TimeOfDayHeatmap />
                    </View>

                    {/* Day of Week */}
                    <View style={isMobile ? s.fullWidth : s.halfWidth}>
                        <DayOfWeekChart />
                    </View>

                    {/* Topic Distribution */}
                    <View style={isMobile ? s.fullWidth : s.halfWidth}>
                        <TopicDistributionChart />
                    </View>
                </View>

                {/* Lists Grid */}
                <View style={s.listsGrid}>
                    {/* Top Feeds */}
                    <View style={isMobile ? s.fullWidth : s.halfWidth}>
                        <FeedEngagementList />
                    </View>

                    {/* Top Articles */}
                    <View style={isMobile ? s.fullWidth : s.halfWidth}>
                        <TopArticlesList />
                    </View>
                </View>
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

const styles = (colors: any, isMobile: boolean) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background.primary,
    },
    scrollView: {
        flex: 1,
    },
    content: {
        padding: isMobile ? spacing.md : spacing.lg,
        paddingBottom: spacing.xl * 2,
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
    chartsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginTop: spacing.lg,
        gap: spacing.md,
    },
    listsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginTop: spacing.lg,
        gap: spacing.md,
    },
    fullWidth: {
        width: '100%',
    },
    halfWidth: {
        width: `calc(50% - ${spacing.md / 2}px)`,
        minWidth: 400,
    },
});
