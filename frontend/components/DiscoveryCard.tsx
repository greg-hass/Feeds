import React from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet, ScrollView } from 'react-native';
import { DiscoveredFeed, FeedPreview } from '@/services/api';
import { useColors, borderRadius, spacing } from '@/theme';
import { Youtube, Rss, MessageSquare, Headphones, Globe, Plus, Check, AlertCircle, ChevronRight, Clock, Zap, ExternalLink } from 'lucide-react-native';

interface DiscoveryCardProps {
    discovery: DiscoveredFeed;
    previewArticles?: FeedPreview[];
    isAdding?: boolean;
    isDuplicate?: boolean;
    onPreview: () => void;
    onAdd: () => void;
    onOpenSite: () => void;
    expanded?: boolean;
    onToggleExpand?: () => void;
}

const getTypeConfig = (colors: any) => ({
    youtube: { icon: Youtube, color: colors.feedTypes.youtube, label: 'YouTube', bgColor: '#FF0000' },
    reddit: { icon: MessageSquare, color: colors.feedTypes.reddit, label: 'Reddit', bgColor: '#FF4500' },
    podcast: { icon: Headphones, color: colors.feedTypes.podcast, label: 'Podcast', bgColor: '#8B5CF6' },
    rss: { icon: Rss, color: colors.feedTypes.rss, label: 'RSS', bgColor: '#F59E0B' },
});

const getConfidenceLabel = (confidence: number): string => {
    if (confidence >= 0.95) return 'Verified';
    if (confidence >= 0.85) return 'High';
    if (confidence >= 0.7) return 'Good';
    return 'Fair';
};

const getActivityLabel = (lastPostDate?: string): string => {
    if (!lastPostDate) return '';
    const date = new Date(lastPostDate);
    const now = new Date();
    const diffHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
    
    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${Math.floor(diffHours)}h ago`;
    if (diffHours < 168) return `${Math.floor(diffHours / 24)}d ago`;
    return `${Math.floor(diffHours / 168)}w ago`;
};

export const DiscoveryCard = ({
    discovery,
    previewArticles = [],
    isAdding = false,
    isDuplicate = false,
    onPreview,
    onAdd,
    onOpenSite,
    expanded = false,
    onToggleExpand,
}: DiscoveryCardProps) => {
    const colors = useColors();
    const s = styles(colors);

    const typeConfig = getTypeConfig(colors);
    const typeInfo = typeConfig[discovery.type] || typeConfig.rss;
    const TypeIcon = typeInfo.icon;

    const confidence = discovery.confidence || 0;
    const activityLabel = getActivityLabel(discovery.lastPostDate);

    return (
        <View style={s.card}>
            {/* Main Content */}
            <TouchableOpacity 
                style={s.mainContent} 
                onPress={onToggleExpand}
                activeOpacity={0.7}
            >
                {/* Type Icon */}
                {discovery.icon_url ? (
                    <Image source={{ uri: discovery.icon_url }} style={s.icon} />
                ) : (
                    <View style={[s.iconPlaceholder, { backgroundColor: typeInfo.color + '15' }]}>
                        <TypeIcon size={24} color={typeInfo.color} />
                    </View>
                )}

                {/* Title and Meta */}
                <View style={s.infoContainer}>
                    <Text style={s.title} numberOfLines={1}>
                        {discovery.title}
                    </Text>
                    
                    {/* Meta badges */}
                    <View style={s.metaRow}>
                        <View style={[s.typeBadge, { backgroundColor: typeInfo.color + '15' }]}>
                            <TypeIcon size={12} color={typeInfo.color} />
                            <Text style={[s.typeLabel, { color: typeInfo.color }]}>
                                {typeInfo.label}
                            </Text>
                        </View>
                        
                        {confidence >= 0.7 && (
                            <View style={[s.confidenceBadge, { backgroundColor: colors.status.success + '15' }]}>
                                <Zap size={10} color={colors.status.success} />
                                <Text style={[s.confidenceText, { color: colors.status.success }]}>
                                    {getConfidenceLabel(confidence)}
                                </Text>
                            </View>
                        )}
                        
                        {activityLabel && (
                            <View style={s.activityBadge}>
                                <Clock size={10} color={colors.text.tertiary} />
                                <Text style={s.activityText}>{activityLabel}</Text>
                            </View>
                        )}
                    </View>
                </View>

                {/* Expand/Collapse Chevron */}
                <View style={s.chevronContainer}>
                    <ChevronRight 
                        size={20} 
                        color={colors.text.tertiary} 
                        style={{ transform: expanded ? [{ rotate: '90deg' }] : [{ rotate: '0deg' }] }}
                    />
                </View>
            </TouchableOpacity>

            {/* Expanded Content - Preview Articles */}
            {expanded && (
                <View style={s.expandedContent}>
                    {/* Site URL */}
                    <TouchableOpacity 
                        style={s.siteUrlRow} 
                        onPress={onOpenSite}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                        <Globe size={14} color={colors.text.tertiary} />
                        <Text style={s.siteUrl} numberOfLines={1}>
                            {(() => {
                                try {
                                    const url = discovery.site_url || discovery.feed_url;
                                    return new URL(url).hostname + new URL(url).pathname;
                                } catch {
                                    return discovery.feed_url;
                                }
                            })()}
                        </Text>
                        <ExternalLink size={12} color={colors.text.tertiary} />
                    </TouchableOpacity>

                    {/* Description */}
                    {discovery.description && (
                        <Text style={s.description} numberOfLines={2}>
                            {discovery.description}
                        </Text>
                    )}

                    {/* Preview Articles */}
                    {previewArticles.length > 0 && (
                        <View style={s.previewSection}>
                            <Text style={s.previewSectionTitle}>Latest articles</Text>
                            <ScrollView 
                                horizontal 
                                showsHorizontalScrollIndicator={false}
                                contentContainerStyle={s.previewList}
                            >
                                {previewArticles.slice(0, 5).map((article, index) => (
                                    <TouchableOpacity 
                                        key={`${article.url}-${index}`}
                                        style={s.previewArticle}
                                        onPress={() => onOpenSite()}
                                    >
                                        {article.thumbnail && (
                                            <Image 
                                                source={{ uri: article.thumbnail }} 
                                                style={s.previewThumbnail}
                                            />
                                        )}
                                        <Text style={s.previewTitle} numberOfLines={2}>
                                            {article.title}
                                        </Text>
                                        {article.published_at && (
                                            <Text style={s.previewDate}>
                                                {new Date(article.published_at).toLocaleDateString()}
                                            </Text>
                                        )}
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        </View>
                    )}

                    {/* Duplicate Warning */}
                    {isDuplicate && (
                        <View style={s.duplicateWarning}>
                            <AlertCircle size={14} color={colors.status.warning} />
                            <Text style={s.duplicateText}>
                                You're already subscribed
                            </Text>
                        </View>
                    )}

                    {/* Actions */}
                    <View style={s.actions}>
                        <TouchableOpacity
                            style={[s.button, s.previewButton, { borderColor: colors.border.DEFAULT }]}
                            onPress={onPreview}
                            disabled={isAdding}
                        >
                            <Text style={[s.buttonText, { color: colors.text.secondary }]}>
                                Preview
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[
                                s.button,
                                s.addButton,
                                { 
                                    backgroundColor: isDuplicate ? colors.background.tertiary : typeInfo.color,
                                    opacity: isDuplicate ? 0.6 : 1,
                                },
                            ]}
                            onPress={onAdd}
                            disabled={isAdding || isDuplicate}
                        >
                            {isAdding ? (
                                <Text style={[s.buttonText, s.addButtonText]}>Adding...</Text>
                            ) : isDuplicate ? (
                                <>
                                    <Check size={16} color={colors.text.tertiary} />
                                    <Text style={[s.buttonText, { color: colors.text.tertiary }]}>
                                        Added
                                    </Text>
                                </>
                            ) : (
                                <>
                                    <Plus size={16} color={colors.text.inverse} />
                                    <Text style={[s.buttonText, s.addButtonText]}>
                                        Add {typeInfo.label}
                                    </Text>
                                </>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            )}
        </View>
    );
};

const styles = (colors: any) => StyleSheet.create({
    card: {
        backgroundColor: colors.background.elevated,
        borderRadius: borderRadius.xl,
        marginBottom: spacing.md,
        borderWidth: 1,
        borderColor: colors.border.DEFAULT,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
        elevation: 2,
        overflow: 'hidden',
    },
    mainContent: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: spacing.md,
    },
    icon: {
        width: 52,
        height: 52,
        borderRadius: borderRadius.lg,
        marginRight: spacing.md,
    },
    iconPlaceholder: {
        width: 52,
        height: 52,
        borderRadius: borderRadius.lg,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: spacing.md,
    },
    infoContainer: {
        flex: 1,
    },
    title: {
        fontSize: 16,
        fontWeight: '700',
        color: colors.text.primary,
        marginBottom: 6,
    },
    metaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        flexWrap: 'wrap',
    },
    typeBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: borderRadius.full,
    },
    typeLabel: {
        fontSize: 11,
        fontWeight: '700',
    },
    confidenceBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 6,
        paddingVertical: 3,
        borderRadius: borderRadius.full,
    },
    confidenceText: {
        fontSize: 10,
        fontWeight: '700',
        textTransform: 'uppercase',
    },
    activityBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    activityText: {
        fontSize: 11,
        color: colors.text.tertiary,
    },
    chevronContainer: {
        padding: spacing.xs,
    },
    expandedContent: {
        borderTopWidth: 1,
        borderTopColor: colors.border.DEFAULT,
        padding: spacing.md,
        backgroundColor: colors.background.secondary,
    },
    siteUrlRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        marginBottom: spacing.sm,
        paddingHorizontal: spacing.xs,
    },
    siteUrl: {
        fontSize: 12,
        color: colors.text.tertiary,
        flex: 1,
        fontStyle: 'italic',
    },
    description: {
        fontSize: 13,
        color: colors.text.secondary,
        marginBottom: spacing.md,
        lineHeight: 18,
    },
    previewSection: {
        marginBottom: spacing.md,
    },
    previewSectionTitle: {
        fontSize: 12,
        fontWeight: '600',
        color: colors.text.tertiary,
        marginBottom: spacing.sm,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    previewList: {
        gap: spacing.sm,
    },
    previewArticle: {
        width: 140,
        padding: spacing.sm,
        backgroundColor: colors.background.elevated,
        borderRadius: borderRadius.md,
        borderWidth: 1,
        borderColor: colors.border.DEFAULT,
    },
    previewThumbnail: {
        width: '100%',
        height: 80,
        borderRadius: borderRadius.sm,
        marginBottom: spacing.xs,
        backgroundColor: colors.background.tertiary,
    },
    previewTitle: {
        fontSize: 12,
        fontWeight: '600',
        color: colors.text.primary,
        lineHeight: 16,
        marginBottom: 4,
    },
    previewDate: {
        fontSize: 10,
        color: colors.text.tertiary,
    },
    duplicateWarning: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        backgroundColor: colors.status.warning + '15',
        padding: spacing.sm,
        borderRadius: borderRadius.md,
        marginBottom: spacing.md,
    },
    duplicateText: {
        fontSize: 12,
        color: colors.status.warning,
        fontWeight: '600',
    },
    actions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: spacing.sm,
        marginTop: spacing.sm,
    },
    button: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: borderRadius.md,
        minHeight: 36,
    },
    previewButton: {
        backgroundColor: 'transparent',
        borderWidth: 1,
    },
    addButton: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 4,
        elevation: 2,
    },
    buttonText: {
        fontSize: 13,
        fontWeight: '700',
    },
    addButtonText: {
        color: '#fff',
    },
});