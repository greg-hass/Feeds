import React, { useRef, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Modal,
    Platform,
    Dimensions,
    useWindowDimensions,
} from 'react-native';
import { X, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react-native';
import { useColors, borderRadius, spacing } from '@/theme';
import { ProgressBar } from './ProgressBar';
import { ProgressItem, ProgressItemData, ItemStatus } from './ProgressItem';

export interface ProgressStats {
    success: number;
    skipped: number;
    errors: number;
}

export interface FailedFeed {
    id: number;
    title: string;
    error: string;
}

export interface ProgressState {
    isActive: boolean;
    operation: 'import' | 'refresh';
    items: ProgressItemData[];
    current: ProgressItemData | null;
    total: number;
    stats: ProgressStats;
    complete: boolean;
    failedFeeds: FailedFeed[];
}

interface ProgressDialogProps {
    state: ProgressState;
    onClose: () => void;
    onRetryFailed: (feedIds: number[]) => void;
}

export function ProgressDialog({ state, onClose, onRetryFailed }: ProgressDialogProps) {
    const colors = useColors();
    const { width } = useWindowDimensions();
    const scrollViewRef = useRef<ScrollView>(null);
    const [showFailedDetails, setShowFailedDetails] = React.useState(false);

    const isMobile = width < 768;

    // Auto-scroll to keep current item visible
    useEffect(() => {
        if (state.current && scrollViewRef.current) {
            // Find index of current item
            const index = state.items.findIndex(item => item.id === state.current?.id);
            if (index >= 0) {
                // Scroll to approximate position (each item ~50px)
                scrollViewRef.current.scrollTo({ y: index * 50, animated: true });
            }
        }
    }, [state.current]);

    const completedCount = state.stats.success + state.stats.skipped + state.stats.errors;
    const progressText = state.complete
        ? 'Complete'
        : `${completedCount} of ${state.total} feeds`;

    const title = state.operation === 'import' ? 'Importing OPML…' : 'Refreshing Feeds…';

    const handleRetry = () => {
        const failedIds = state.failedFeeds.map(f => f.id).filter(id => id > 0);
        if (failedIds.length > 0) {
            onRetryFailed(failedIds);
        }
    };

    const dialogStyles = isMobile
        ? {
            position: 'absolute' as const,
            bottom: 80, // Above navigation bar
            left: 16,
            right: 16,
            maxWidth: 400,
            alignSelf: 'center' as const,
        }
        : {
            position: 'absolute' as const,
            bottom: 20,
            right: 20,
            width: 400,
        };

    if (!state.isActive) return null;

    return (
        <Modal visible={state.isActive} transparent animationType="fade">
            <View style={styles.overlay}>
                <View
                    style={[
                        styles.dialog,
                        dialogStyles,
                        {
                            backgroundColor: colors.background.elevated,
                            borderColor: colors.border.DEFAULT,
                            shadowColor: '#000',
                        },
                    ]}
                >
                    {/* Header */}
                    <View style={[styles.header, { borderBottomColor: colors.border.DEFAULT }]}>
                        <Text style={[styles.title, { color: colors.text.primary }]}>{title}</Text>
                        <TouchableOpacity onPress={onClose} style={styles.closeButton} accessibilityLabel="Close progress dialog">
                            <X size={20} color={colors.text.secondary} />
                        </TouchableOpacity>
                    </View>

                    {/* Progress Bar */}
                    <View style={styles.progressContainer}>
                        <ProgressBar current={completedCount} total={state.total} />
                        <Text style={[styles.progressText, { color: colors.text.secondary }]}>
                            {progressText}
                            {state.stats.errors > 0 && !state.complete && ` (${state.stats.errors} errors)`}
                        </Text>
                    </View>

                    {/* Items List */}
                    <ScrollView
                        ref={scrollViewRef}
                        style={styles.itemsList}
                        contentContainerStyle={styles.itemsListContent}
                        showsVerticalScrollIndicator={true}
                    >
                        {state.items.map(item => (
                            <ProgressItem key={item.id} item={item} />
                        ))}
                    </ScrollView>

                    {/* Summary (when complete) */}
                    {state.complete && (
                        <View style={[styles.summary, { borderTopColor: colors.border.DEFAULT }]}>
                            <View style={styles.summaryStats}>
                                {state.stats.success > 0 && (
                                    <Text style={[styles.statText, { color: colors.primary.DEFAULT }]}>
                                        ✓ {state.stats.success} successful
                                    </Text>
                                )}
                                {state.stats.skipped > 0 && (
                                    <Text style={[styles.statText, { color: colors.text.tertiary }]}>
                                        ⊘ {state.stats.skipped} skipped
                                    </Text>
                                )}
                                {state.stats.errors > 0 && (
                                    <Text style={[styles.statText, { color: colors.error }]}>
                                        ✗ {state.stats.errors} failed
                                    </Text>
                                )}
                            </View>

                            {/* Failed feeds details */}
                            {state.failedFeeds.length > 0 && (
                                <View style={styles.failedSection}>
                                    <TouchableOpacity
                                        style={styles.failedToggle}
                                        onPress={() => setShowFailedDetails(!showFailedDetails)}
                                    >
                                        <Text style={[styles.failedToggleText, { color: colors.text.secondary }]}>
                                            View Failed Feeds
                                        </Text>
                                        {showFailedDetails ? (
                                            <ChevronUp size={16} color={colors.text.secondary} />
                                        ) : (
                                            <ChevronDown size={16} color={colors.text.secondary} />
                                        )}
                                    </TouchableOpacity>

                                    {showFailedDetails && (
                                        <View style={styles.failedList}>
                                            {state.failedFeeds.map((feed, index) => (
                                                <Text
                                                    key={index}
                                                    style={[styles.failedItem, { color: colors.text.tertiary }]}
                                                    numberOfLines={2}
                                                >
                                                    • {feed.title} - {feed.error}
                                                </Text>
                                            ))}
                                        </View>
                                    )}

                                    <TouchableOpacity
                                        style={[styles.retryButton, { backgroundColor: colors.primary.DEFAULT }]}
                                        onPress={handleRetry}
                                    >
                                        <RefreshCw size={16} color={colors.text.inverse} />
                                        <Text style={[styles.retryButtonText, { color: colors.text.inverse }]}>
                                            Retry Failed Feeds
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            )}
                        </View>
                    )}
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.3)',
    },
    dialog: {
        borderRadius: borderRadius.lg, // 14px
        borderWidth: 1,
        overflow: 'hidden',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 12,
        elevation: 8,
        maxHeight: 500,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        borderBottomWidth: 1,
    },
    title: {
        fontSize: 16,
        fontWeight: '600',
    },
    closeButton: {
        padding: spacing.xs,
    },
    progressContainer: {
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        gap: spacing.sm,
    },
    progressText: {
        fontSize: 12,
        textAlign: 'center',
    },
    itemsList: {
        maxHeight: 300,
    },
    itemsListContent: {
        paddingBottom: spacing.sm,
    },
    summary: {
        padding: spacing.lg,
        borderTopWidth: 1,
        gap: spacing.md,
    },
    summaryStats: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.md,
    },
    statText: {
        fontSize: 13,
        fontWeight: '500',
    },
    failedSection: {
        gap: spacing.sm,
    },
    failedToggle: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
    },
    failedToggleText: {
        fontSize: 13,
    },
    failedList: {
        gap: spacing.xs,
        paddingLeft: spacing.sm,
    },
    failedItem: {
        fontSize: 12,
    },
    retryButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.sm,
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.lg,
        borderRadius: borderRadius.md,
        marginTop: spacing.sm,
    },
    retryButtonText: {
        fontSize: 14,
        fontWeight: '500',
    },
});
