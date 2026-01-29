import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, ScrollView, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import {
    Check, CheckCircle, Bookmark, ExternalLink, Share2,
    Copy, BookmarkCheck, BookmarkX, Circle, CircleDot
} from 'lucide-react-native';
import { useArticleStore } from '@/stores';
import { Article } from '@/services/api';
import { shareContent } from '@/utils/share';
import { useColors, spacing, borderRadius } from '@/theme';
import { openExternalLink } from '@/utils/externalLink';
import { extractVideoId, isYouTubeUrl } from '@/utils/youtube';

interface ArticleContextMenuProps {
    visible: boolean;
    article: Article | null;
    onClose: () => void;
    onArticlePress: (article: Article) => void;
}

interface MenuAction {
    id: string;
    icon: any; // Lucide icon component
    label: string;
    labelSecondary?: string;
    onPress: () => void;
    destructive?: boolean;
    iconFill?: string;
}

/**
 * ArticleContextMenu - Context menu for quick article actions
 * Shows on long-press with options like mark read/unread, bookmark, share, copy link
 */
export const ArticleContextMenu: React.FC<ArticleContextMenuProps> = ({
    visible,
    article,
    onClose,
    onArticlePress,
}) => {
    const colors = useColors();
    const { markRead, markUnread, toggleBookmark } = useArticleStore();
    const s = styles(colors);

    if (!article) return null;

    const handleMarkRead = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        markRead(article.id);
        onClose();
    };

    const handleMarkUnread = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        markUnread(article.id);
        onClose();
    };

    const handleToggleBookmark = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        toggleBookmark(article.id);
        onClose();
    };

    const handleShare = async () => {
        try {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            await shareContent({
                title: article.title,
                message: article.title,
                url: article.url || undefined,
            });
        } catch (error) {
            console.error('Share error:', error);
        }
        onClose();
    };

    const handleCopyLink = async () => {
        try {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            if (Platform.OS === 'web' && article.url) {
                await navigator.clipboard.writeText(article.url);
            } else if (article.url) {
                // For native platforms, clipboard would need expo-clipboard
                // For now, just log - can be enhanced later
                console.log('Copy link (native):', article.url);
            }
        } catch (error) {
            console.error('Copy error:', error);
        }
        onClose();
    };

    const handleOpenArticle = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onArticlePress(article);
        onClose();
    };

    const handleOpenExternal = async () => {
        if (!article?.url) return;
        try {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            
            // For YouTube videos, ensure we use a proper watch URL
            let urlToOpen = article.url;
            const videoId = extractVideoId(article.url || article.thumbnail_url || '');
            if (videoId) {
                urlToOpen = `https://www.youtube.com/watch?v=${videoId}`;
            }
            
            await openExternalLink(urlToOpen);
        } catch (error) {
            console.error('Open external error:', error);
        }
        onClose();
    };

    const actions: MenuAction[] = [
        {
            id: 'open',
            icon: CircleDot,
            label: 'Open Article',
            onPress: handleOpenArticle,
        },
        {
            id: 'external',
            icon: ExternalLink,
            label: 'Open in Browser',
            onPress: handleOpenExternal,
        },
        {
            id: article.is_read ? 'unread' : 'read',
            icon: article.is_read ? Circle : CheckCircle,
            label: article.is_read ? 'Mark as Unread' : 'Mark as Read',
            onPress: article.is_read ? handleMarkUnread : handleMarkRead,
        },
        {
            id: 'bookmark',
            icon: article.is_bookmarked ? BookmarkCheck : Bookmark,
            label: article.is_bookmarked ? 'Remove Bookmark' : 'Bookmark',
            onPress: handleToggleBookmark,
            iconFill: article.is_bookmarked ? colors.primary.DEFAULT : 'none',
        },
        {
            id: 'share',
            icon: Share2,
            label: 'Share',
            onPress: handleShare,
        },
        {
            id: 'copy',
            icon: Copy,
            label: 'Copy Link',
            onPress: handleCopyLink,
        },
    ];

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onClose}
        >
            <TouchableOpacity
                style={s.overlay}
                activeOpacity={1}
                onPress={onClose}
            >
                <View style={s.container}>
                    <View style={s.header}>
                        <View style={s.articleInfo}>
                            <Text style={s.articleTitle} numberOfLines={2}>
                                {article.title}
                            </Text>
                            <Text style={s.articleSource}>{article.feed_title}</Text>
                        </View>
                    </View>

                    <ScrollView style={s.actionsList} showsVerticalScrollIndicator={false}>
                        {actions.map((action) => (
                            <TouchableOpacity
                                key={action.id}
                                style={s.actionItem}
                                onPress={action.onPress}
                                activeOpacity={0.7}
                            >
                                <View style={[
                                    s.actionIcon,
                                    action.destructive && s.actionIconDestructive
                                ]}>
                                    <action.icon
                                        size={20}
                                        color={action.destructive ? '#ef4444' : colors.primary.DEFAULT}
                                        fill={action.iconFill}
                                    />
                                </View>
                                <Text style={[
                                    s.actionLabel,
                                    action.destructive && s.actionLabelDestructive
                                ]}>
                                    {action.label}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>

                    <TouchableOpacity
                        style={s.cancelButton}
                        onPress={onClose}
                    >
                        <Text style={s.cancelButtonText}>Cancel</Text>
                    </TouchableOpacity>
                </View>
            </TouchableOpacity>
        </Modal>
    );
};

const styles = (colors: any) => StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    container: {
        backgroundColor: colors.background.secondary,
        borderTopLeftRadius: borderRadius.xl,
        borderTopRightRadius: borderRadius.xl,
        paddingBottom: Platform.OS === 'ios' ? 34 : spacing.md,
        ...Platform.select({
            web: {
                boxShadow: '0 -4px 20px rgba(0, 0, 0, 0.15)',
            },
        }),
    },
    header: {
        padding: spacing.lg,
        borderBottomWidth: 1,
        borderBottomColor: colors.border.DEFAULT,
    },
    articleInfo: {
        paddingRight: spacing.xl,
    },
    articleTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.text.primary,
        marginBottom: spacing.xs,
    },
    articleSource: {
        fontSize: 13,
        color: colors.text.secondary,
    },
    actionsList: {
        paddingVertical: spacing.sm,
    },
    actionItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.lg,
        gap: spacing.lg,
        borderBottomWidth: 1,
        borderBottomColor: colors.border.light,
    },
    actionIcon: {
        width: 36,
        height: 36,
        borderRadius: borderRadius.md,
        backgroundColor: colors.background.tertiary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    actionIconDestructive: {
        backgroundColor: '#ef444422',
    },
    actionLabel: {
        fontSize: 16,
        fontWeight: '500',
        color: colors.text.primary,
        flex: 1,
    },
    actionLabelDestructive: {
        color: '#ef4444',
    },
    cancelButton: {
        paddingVertical: spacing.lg,
        alignItems: 'center',
        borderTopWidth: 1,
        borderTopColor: colors.border.DEFAULT,
    },
    cancelButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.primary.DEFAULT,
    },
});
