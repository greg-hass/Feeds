import React from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { DiscoveredFeed } from '@/services/api';
import { useColors, borderRadius, spacing } from '@/theme';
import { Youtube, Rss, MessageSquare, Headphones, ExternalLink, Plus, Check, AlertCircle } from 'lucide-react-native';

interface DiscoveryCardProps {
    discovery: DiscoveredFeed;
    isAdding?: boolean;
    isDuplicate?: boolean;
    onPreview?: () => void;
    onAdd: () => void;
}

const typeConfig = {
    youtube: { icon: Youtube, color: '#ef4444', label: 'YouTube' },
    reddit: { icon: MessageSquare, color: '#f97316', label: 'Reddit' },
    podcast: { icon: Headphones, color: '#8b5cf6', label: 'Podcast' },
    rss: { icon: Rss, color: '#3b82f6', label: 'RSS' },
};

export const DiscoveryCard = ({
    discovery,
    isAdding = false,
    isDuplicate = false,
    onPreview,
    onAdd,
}: DiscoveryCardProps) => {
    const colors = useColors();
    const s = styles(colors);

    const typeInfo = typeConfig[discovery.type] || typeConfig.rss;
    const TypeIcon = typeInfo.icon;

    return (
        <View style={s.card}>
            {/* Header with icon and title */}
            <View style={s.header}>
                {discovery.icon_url ? (
                    <Image source={{ uri: discovery.icon_url }} style={s.icon} />
                ) : (
                    <View style={[s.iconPlaceholder, { backgroundColor: typeInfo.color + '22' }]}>
                        <TypeIcon size={24} color={typeInfo.color} />
                    </View>
                )}
                <View style={s.titleContainer}>
                    <Text style={s.title} numberOfLines={1}>
                        {discovery.title}
                    </Text>
                    <View style={s.metaRow}>
                        <View style={[s.typeBadge, { backgroundColor: typeInfo.color + '22' }]}>
                            <TypeIcon size={12} color={typeInfo.color} />
                            <Text style={[s.typeLabel, { color: typeInfo.color }]}>
                                {typeInfo.label}
                            </Text>
                        </View>
                        {discovery.confidence > 0.9 && (
                            <View style={s.confidenceBadge}>
                                <Check size={10} color={colors.status.success} />
                                <Text style={s.confidenceText}>Verified</Text>
                            </View>
                        )}
                    </View>
                </View>
            </View>

            {/* URL hint */}
            <View style={s.urlContainer}>
                <ExternalLink size={12} color={colors.text.tertiary} />
                <Text style={s.url} numberOfLines={1}>
                    {new URL(discovery.site_url || discovery.feed_url).hostname}
                </Text>
            </View>

            {/* Duplicate warning */}
            {isDuplicate && (
                <View style={s.duplicateWarning}>
                    <AlertCircle size={14} color={colors.status.warning} />
                    <Text style={s.duplicateText}>
                        You&apos;re already subscribed to this feed
                    </Text>
                </View>
            )}

            {/* Actions */}
            <View style={s.actions}>
                {onPreview && (
                    <TouchableOpacity
                        style={[s.button, s.previewButton, { borderColor: colors.border.DEFAULT }]}
                        onPress={onPreview}
                        disabled={isAdding}
                    >
                        <Text style={[s.buttonText, { color: colors.text.secondary }]}>
                            Preview
                        </Text>
                    </TouchableOpacity>
                )}
                <TouchableOpacity
                    style={[
                        s.button,
                        s.addButton,
                        { backgroundColor: isDuplicate ? colors.background.tertiary : colors.primary?.DEFAULT ?? colors.primary },
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
                            <Text style={[s.buttonText, s.addButtonText]}>Add Feed</Text>
                        </>
                    )}
                </TouchableOpacity>
            </View>
        </View>
    );
};

const styles = (colors: any) => StyleSheet.create({
    card: {
        backgroundColor: colors.background.elevated,
        borderRadius: borderRadius.xl,
        padding: spacing.lg,
        marginBottom: spacing.md,
        borderWidth: 1,
        borderColor: colors.border.DEFAULT,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
        elevation: 2,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: spacing.md,
    },
    icon: {
        width: 48,
        height: 48,
        borderRadius: borderRadius.lg,
        marginRight: spacing.md,
    },
    iconPlaceholder: {
        width: 48,
        height: 48,
        borderRadius: borderRadius.lg,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: spacing.md,
    },
    titleContainer: {
        flex: 1,
    },
    title: {
        fontSize: 17,
        fontWeight: '700',
        color: colors.text.primary,
        marginBottom: 4,
    },
    metaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
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
        gap: 3,
    },
    confidenceText: {
        fontSize: 11,
        color: colors.status.success,
        fontWeight: '600',
    },
    urlContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: spacing.md,
        paddingHorizontal: spacing.sm,
    },
    url: {
        fontSize: 12,
        color: colors.text.tertiary,
        flex: 1,
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
        shadowColor: colors.primary?.DEFAULT ?? colors.primary,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 2,
    },
    buttonText: {
        fontSize: 13,
        fontWeight: '700',
    },
    addButtonText: {
        color: colors.text.inverse,
    },
});
