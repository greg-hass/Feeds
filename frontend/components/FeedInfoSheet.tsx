import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Modal,
    ScrollView,
    ActivityIndicator,
    Linking,
    Alert,
} from 'react-native';
import {
    X,
    Rss,
    Youtube,
    Radio,
    MessageSquare,
    Clock,
    RefreshCw,
    AlertCircle,
    Pause,
    Play,
    ExternalLink,
    Calendar,
    FileText,
    Trash2,
    Pencil,
} from 'lucide-react-native';
import { useColors, spacing, borderRadius, shadows } from '@/theme';
import { api, Feed, FeedInfo } from '@/services/api';
import { useFeedStore } from '@/stores/feedStore';

interface FeedInfoSheetProps {
    feedId: number | null;
    visible: boolean;
    onClose: () => void;
    onEdit?: (feed: Feed) => void;
    onDelete?: (feed: Feed) => void;
}

const FEED_TYPE_ICONS = {
    rss: Rss,
    youtube: Youtube,
    podcast: Radio,
    reddit: MessageSquare,
};

const FEED_TYPE_LABELS = {
    rss: 'RSS Feed',
    youtube: 'YouTube Channel',
    podcast: 'Podcast',
    reddit: 'Reddit',
};

function formatRelativeTime(dateString: string | null): string {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins === 1 ? '' : 's'} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
    return date.toLocaleDateString();
}

function formatFutureTime(dateString: string | null): string {
    if (!dateString) return 'Not scheduled';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);

    if (diffMins <= 0) return 'Now';
    if (diffMins < 60) return `in ${diffMins} minute${diffMins === 1 ? '' : 's'}`;
    if (diffHours < 24) return `in ${diffHours} hour${diffHours === 1 ? '' : 's'}`;
    return date.toLocaleDateString();
}

function formatDate(dateString: string | null): string {
    if (!dateString) return 'Unknown';
    return new Date(dateString).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    });
}

export const FeedInfoSheet = ({ feedId, visible, onClose, onEdit, onDelete }: FeedInfoSheetProps) => {
    const colors = useColors();
    const s = styles(colors);
    const [feedInfo, setFeedInfo] = useState<FeedInfo | null>(null);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const { updateFeed } = useFeedStore();

    useEffect(() => {
        if (visible && feedId) {
            loadFeedInfo();
        } else {
            setFeedInfo(null);
            setLoading(true);
        }
    }, [visible, feedId]);

    const loadFeedInfo = async () => {
        if (!feedId) return;
        setLoading(true);
        try {
            const info = await api.getFeedInfo(feedId);
            setFeedInfo(info);
        } catch (err) {
            console.error('Failed to load feed info:', err);
        } finally {
            setLoading(false);
        }
    };

    const handlePauseResume = async () => {
        if (!feedInfo) return;
        setActionLoading(true);
        try {
            if (feedInfo.feed.paused_at) {
                const result = await api.resumeFeed(feedInfo.feed.id);
                setFeedInfo({ ...feedInfo, feed: result.feed, status: 'healthy' });
                updateFeed(result.feed.id, result.feed);
            } else {
                const result = await api.pauseFeed(feedInfo.feed.id);
                setFeedInfo({ ...feedInfo, feed: result.feed, status: 'paused' });
                updateFeed(result.feed.id, result.feed);
            }
        } catch (err) {
            console.error('Failed to pause/resume feed:', err);
            Alert.alert('Error', 'Failed to update feed status');
        } finally {
            setActionLoading(false);
        }
    };

    const handleOpenUrl = (url: string | null) => {
        if (url) {
            Linking.openURL(url);
        }
    };

    const handleDelete = () => {
        if (!feedInfo) return;
        Alert.alert(
            'Delete Feed',
            `Are you sure you want to delete "${feedInfo.feed.title}"? This will also remove all articles.`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: () => {
                        onDelete?.(feedInfo.feed);
                        onClose();
                    },
                },
            ]
        );
    };

    if (!visible) return null;

    const feed = feedInfo?.feed;
    const TypeIcon = feed ? FEED_TYPE_ICONS[feed.type] : Rss;

    const getStatusColor = () => {
        switch (feedInfo?.status) {
            case 'healthy':
                return colors.success;
            case 'paused':
                return colors.warning;
            case 'error':
                return colors.error;
            default:
                return colors.text.tertiary;
        }
    };

    const getStatusLabel = () => {
        switch (feedInfo?.status) {
            case 'healthy':
                return 'Healthy';
            case 'paused':
                return 'Paused';
            case 'error':
                return 'Error';
            default:
                return 'Unknown';
        }
    };

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <View style={s.overlay}>
                <View style={s.sheet}>
                    {/* Header */}
                    <View style={s.header}>
                        <Text style={s.headerTitle}>Feed Info</Text>
                        <TouchableOpacity onPress={onClose} style={s.closeButton} accessibilityLabel="Close feed info">
                            <X size={24} color={colors.text.primary} />
                        </TouchableOpacity>
                    </View>

                    {loading ? (
                        <View style={s.loadingContainer}>
                            <ActivityIndicator size="large" color={colors.primary.DEFAULT} />
                        </View>
                    ) : feedInfo && feed ? (
                        <ScrollView style={s.content} showsVerticalScrollIndicator={false}>
                            {/* Feed Title & Type */}
                            <View style={s.titleSection}>
                                <View style={s.iconContainer}>
                                    <TypeIcon size={32} color={colors.primary.DEFAULT} />
                                </View>
                                <View style={s.titleInfo}>
                                    <Text style={s.feedTitle} numberOfLines={2}>
                                        {feed.title}
                                    </Text>
                                    <Text style={s.feedType}>
                                        {FEED_TYPE_LABELS[feed.type]} • Added {formatDate(feed.created_at)}
                                    </Text>
                                </View>
                            </View>

                            {/* Description */}
                            {feed.description && (
                                <View style={s.section}>
                                    <Text style={s.description}>{feed.description}</Text>
                                </View>
                            )}

                            {/* Status Section */}
                            <View style={s.section}>
                                <View style={s.statusRow}>
                                    <Text style={s.label}>Status</Text>
                                    <View style={[s.statusBadge, { backgroundColor: getStatusColor() + '20' }]}>
                                        <View style={[s.statusDot, { backgroundColor: getStatusColor() }]} />
                                        <Text style={[s.statusText, { color: getStatusColor() }]}>
                                            {getStatusLabel()}
                                        </Text>
                                    </View>
                                </View>

                                {feedInfo.status === 'error' && feed.last_error && (
                                    <View style={s.errorBox}>
                                        <AlertCircle size={16} color={colors.error} />
                                        <Text style={s.errorText}>{feed.last_error}</Text>
                                    </View>
                                )}
                            </View>

                            {/* Refresh Info */}
                            <View style={s.section}>
                                <Text style={s.sectionTitle}>Refresh Schedule</Text>
                                <View style={s.infoRow}>
                                    <Clock size={16} color={colors.text.tertiary} />
                                    <Text style={s.infoLabel}>Last fetched</Text>
                                    <Text style={s.infoValue}>{formatRelativeTime(feed.last_fetched_at)}</Text>
                                </View>
                                <View style={s.infoRow}>
                                    <RefreshCw size={16} color={colors.text.tertiary} />
                                    <Text style={s.infoLabel}>Next fetch</Text>
                                    <Text style={s.infoValue}>
                                        {feed.paused_at ? 'Paused' : formatFutureTime(feed.next_fetch_at)}
                                    </Text>
                                </View>
                                <View style={s.infoRow}>
                                    <Calendar size={16} color={colors.text.tertiary} />
                                    <Text style={s.infoLabel}>Interval</Text>
                                    <Text style={s.infoValue}>{feed.refresh_interval_minutes} minutes</Text>
                                </View>
                            </View>

                            {/* Article Stats */}
                            <View style={s.section}>
                                <Text style={s.sectionTitle}>Articles</Text>
                                <View style={s.statsRow}>
                                    <View style={s.statBox}>
                                        <Text style={s.statValue}>{feedInfo.total_articles}</Text>
                                        <Text style={s.statLabel}>Total</Text>
                                    </View>
                                    <View style={s.statBox}>
                                        <Text style={[s.statValue, { color: colors.primary.DEFAULT }]}>
                                            {feedInfo.unread_count}
                                        </Text>
                                        <Text style={s.statLabel}>Unread</Text>
                                    </View>
                                </View>
                            </View>

                            {/* URLs */}
                            <View style={s.section}>
                                <Text style={s.sectionTitle}>Links</Text>
                                <TouchableOpacity
                                    style={s.urlRow}
                                    onPress={() => handleOpenUrl(feed.url)}
                                >
                                    <Rss size={16} color={colors.text.tertiary} />
                                    <Text style={s.urlLabel}>Feed URL</Text>
                                    <Text style={s.urlValue} numberOfLines={1}>
                                        {feed.url}
                                    </Text>
                                    <ExternalLink size={14} color={colors.text.tertiary} />
                                </TouchableOpacity>
                                {feed.site_url && (
                                    <TouchableOpacity
                                        style={s.urlRow}
                                        onPress={() => handleOpenUrl(feed.site_url)}
                                    >
                                        <ExternalLink size={16} color={colors.text.tertiary} />
                                        <Text style={s.urlLabel}>Website</Text>
                                        <Text style={s.urlValue} numberOfLines={1}>
                                            {feed.site_url}
                                        </Text>
                                        <ExternalLink size={14} color={colors.text.tertiary} />
                                    </TouchableOpacity>
                                )}
                            </View>

                            {/* Actions */}
                            <View style={s.actionsSection}>
                                <TouchableOpacity
                                    style={[s.actionButton, s.actionButtonPrimary]}
                                    onPress={handlePauseResume}
                                    disabled={actionLoading}
                                >
                                    {actionLoading ? (
                                        <ActivityIndicator size="small" color={colors.background.primary} />
                                    ) : feed.paused_at ? (
                                        <>
                                            <Play size={18} color={colors.background.primary} />
                                            <Text style={s.actionButtonTextPrimary}>Resume Feed</Text>
                                        </>
                                    ) : (
                                        <>
                                            <Pause size={18} color={colors.background.primary} />
                                            <Text style={s.actionButtonTextPrimary}>Pause Feed</Text>
                                        </>
                                    )}
                                </TouchableOpacity>

                                <View style={s.actionRow}>
                                    <TouchableOpacity
                                        style={s.actionButton}
                                        onPress={() => {
                                            onEdit?.(feed);
                                            onClose();
                                        }}
                                    >
                                        <Pencil size={18} color={colors.text.primary} />
                                        <Text style={s.actionButtonText}>Edit</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[s.actionButton, s.actionButtonDanger]}
                                        onPress={handleDelete}
                                    >
                                        <Trash2 size={18} color={colors.error} />
                                        <Text style={[s.actionButtonText, { color: colors.error }]}>
                                            Delete
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </ScrollView>
                    ) : (
                        <View style={s.loadingContainer}>
                            <Text style={s.errorText}>Failed to load feed info</Text>
                        </View>
                    )}
                </View>
            </View>
        </Modal>
    );
};

const styles = (colors: any) =>
    StyleSheet.create({
        overlay: {
            flex: 1,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            justifyContent: 'center',
            alignItems: 'center',
            padding: spacing.lg,
        },
        sheet: {
            backgroundColor: colors.background.secondary,
            borderRadius: borderRadius.xl,
            width: '100%',
            maxWidth: 480,
            maxHeight: '90%',
            ...shadows.xl,
        },
        header: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: spacing.lg,
            borderBottomWidth: 1,
            borderBottomColor: colors.border.DEFAULT,
        },
        headerTitle: {
            fontSize: 18,
            fontWeight: '600',
            color: colors.text.primary,
        },
        closeButton: {
            padding: spacing.xs,
        },
        loadingContainer: {
            padding: spacing.xxl,
            alignItems: 'center',
            justifyContent: 'center',
        },
        content: {
            padding: spacing.lg,
        },
        titleSection: {
            flexDirection: 'row',
            marginBottom: spacing.lg,
        },
        iconContainer: {
            width: 56,
            height: 56,
            borderRadius: borderRadius.lg,
            backgroundColor: colors.background.tertiary,
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: spacing.md,
        },
        titleInfo: {
            flex: 1,
            justifyContent: 'center',
        },
        feedTitle: {
            fontSize: 18,
            fontWeight: '700',
            color: colors.text.primary,
            marginBottom: spacing.xs,
        },
        feedType: {
            fontSize: 13,
            color: colors.text.tertiary,
        },
        section: {
            marginBottom: spacing.lg,
        },
        sectionTitle: {
            fontSize: 13,
            fontWeight: '600',
            color: colors.text.tertiary,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
            marginBottom: spacing.sm,
        },
        description: {
            fontSize: 14,
            color: colors.text.secondary,
            lineHeight: 20,
        },
        statusRow: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
        },
        label: {
            fontSize: 14,
            color: colors.text.secondary,
        },
        statusBadge: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: spacing.sm,
            paddingVertical: spacing.xs,
            borderRadius: borderRadius.full,
        },
        statusDot: {
            width: 8,
            height: 8,
            borderRadius: 4,
            marginRight: spacing.xs,
        },
        statusText: {
            fontSize: 13,
            fontWeight: '600',
        },
        errorBox: {
            flexDirection: 'row',
            alignItems: 'flex-start',
            backgroundColor: colors.error + '10',
            padding: spacing.sm,
            borderRadius: borderRadius.md,
            marginTop: spacing.sm,
        },
        errorText: {
            fontSize: 13,
            color: colors.error,
            marginLeft: spacing.xs,
            flex: 1,
        },
        infoRow: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingVertical: spacing.sm,
            borderBottomWidth: 1,
            borderBottomColor: colors.border.light,
        },
        infoLabel: {
            fontSize: 14,
            color: colors.text.secondary,
            marginLeft: spacing.sm,
            flex: 1,
        },
        infoValue: {
            fontSize: 14,
            color: colors.text.primary,
            fontWeight: '500',
        },
        statsRow: {
            flexDirection: 'row',
            gap: spacing.md,
        },
        statBox: {
            flex: 1,
            backgroundColor: colors.background.tertiary,
            borderRadius: borderRadius.md,
            padding: spacing.md,
            alignItems: 'center',
        },
        statValue: {
            fontSize: 24,
            fontWeight: '700',
            color: colors.text.primary,
        },
        statLabel: {
            fontSize: 12,
            color: colors.text.tertiary,
            marginTop: spacing.xs,
        },
        urlRow: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingVertical: spacing.sm,
            borderBottomWidth: 1,
            borderBottomColor: colors.border.light,
        },
        urlLabel: {
            fontSize: 14,
            color: colors.text.secondary,
            marginLeft: spacing.sm,
            width: 70,
        },
        urlValue: {
            fontSize: 13,
            color: colors.text.tertiary,
            flex: 1,
            marginRight: spacing.sm,
        },
        actionsSection: {
            marginTop: spacing.md,
            paddingTop: spacing.lg,
            borderTopWidth: 1,
            borderTopColor: colors.border.DEFAULT,
        },
        actionRow: {
            flexDirection: 'row',
            gap: spacing.sm,
            marginTop: spacing.sm,
        },
        actionButton: {
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            padding: spacing.md,
            borderRadius: borderRadius.md,
            backgroundColor: colors.background.tertiary,
            gap: spacing.sm,
        },
        actionButtonPrimary: {
            backgroundColor: colors.primary.DEFAULT,
        },
        actionButtonDanger: {
            backgroundColor: colors.error + '10',
        },
        actionButtonText: {
            fontSize: 14,
            fontWeight: '600',
            color: colors.text.primary,
        },
        actionButtonTextPrimary: {
            fontSize: 14,
            fontWeight: '600',
            color: colors.background.primary,
        },
    });
