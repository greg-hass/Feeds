import React from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, Modal } from 'react-native';
import { List, X } from 'lucide-react-native';
import { useColors, spacing, borderRadius, typography } from '@/theme';
import { TocItem, getTocIndent } from '@/stores/highlightsStore';

interface TableOfContentsProps {
    items: TocItem[];
    visible: boolean;
    onClose: () => void;
    onNavigate: (id: string) => void;
}

/**
 * Table of contents sidebar for article navigation
 * Shows heading hierarchy and allows jumping to sections
 */
export function TableOfContents({ items, visible, onClose, onNavigate }: TableOfContentsProps) {
    const colors = useColors();
    const s = styles(colors);

    const handleNavigate = (id: string) => {
        onNavigate(id);
        onClose();
    };

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <Pressable style={s.overlay} onPress={onClose}>
                <View style={s.sidebar} onStartShouldSetResponder={() => true}>
                    {/* Header */}
                    <View style={s.header}>
                        <View style={s.headerLeft}>
                            <List size={20} color={colors.primary.DEFAULT} />
                            <Text style={s.title}>Table of Contents</Text>
                        </View>
                        <Pressable style={s.closeButton} onPress={onClose}>
                            <X size={24} color={colors.text.primary} />
                        </Pressable>
                    </View>

                    {/* TOC items */}
                    <ScrollView style={s.content} showsVerticalScrollIndicator={false}>
                        {items.length === 0 ? (
                            <View style={s.empty}>
                                <List size={48} color={colors.background.tertiary} />
                                <Text style={s.emptyText}>No headings found in this article</Text>
                            </View>
                        ) : (
                            items.map((item, index) => (
                                <Pressable
                                    key={index}
                                    style={[
                                        s.item,
                                        {
                                            paddingLeft: spacing.lg + getTocIndent(item.level),
                                        },
                                    ]}
                                    onPress={() => handleNavigate(item.id)}
                                >
                                    <View style={[s.bullet, item.level === 1 && s.bulletPrimary]} />
                                    <Text
                                        style={[
                                            s.itemText,
                                            item.level === 1 && s.itemTextPrimary,
                                            item.level === 2 && s.itemTextSecondary,
                                        ]}
                                        numberOfLines={2}
                                    >
                                        {item.text}
                                    </Text>
                                </Pressable>
                            ))
                        )}
                    </ScrollView>

                    {/* Footer info */}
                    {items.length > 0 && (
                        <View style={s.footer}>
                            <Text style={s.footerText}>
                                {items.length} {items.length === 1 ? 'section' : 'sections'}
                            </Text>
                        </View>
                    )}
                </View>
            </Pressable>
        </Modal>
    );
}

const styles = (colors: any) =>
    StyleSheet.create({
        overlay: {
            flex: 1,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            justifyContent: 'flex-end',
        },
        sidebar: {
            backgroundColor: colors.background.elevated,
            borderTopLeftRadius: borderRadius.xl,
            borderTopRightRadius: borderRadius.xl,
            maxHeight: '80%',
        },
        header: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: spacing.lg,
            borderBottomWidth: 1,
            borderBottomColor: colors.border.DEFAULT,
        },
        headerLeft: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.sm,
        },
        title: {
            ...typography.h3,
            color: colors.text.primary,
        },
        closeButton: {
            padding: spacing.sm,
        },
        content: {
            flex: 1,
        },
        item: {
            flexDirection: 'row',
            alignItems: 'flex-start',
            gap: spacing.md,
            paddingRight: spacing.lg,
            paddingVertical: spacing.md,
            borderBottomWidth: 1,
            borderBottomColor: colors.border.light,
        },
        bullet: {
            width: 6,
            height: 6,
            borderRadius: 3,
            backgroundColor: colors.text.tertiary,
            marginTop: 8,
        },
        bulletPrimary: {
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: colors.primary.DEFAULT,
        },
        itemText: {
            ...typography.body,
            color: colors.text.secondary,
            flex: 1,
        },
        itemTextPrimary: {
            ...typography.h4,
            color: colors.text.primary,
            fontWeight: '700',
        },
        itemTextSecondary: {
            fontWeight: '600',
            color: colors.text.primary,
        },
        empty: {
            alignItems: 'center',
            justifyContent: 'center',
            paddingVertical: spacing.xxl * 2,
            paddingHorizontal: spacing.xl,
        },
        emptyText: {
            ...typography.body,
            color: colors.text.tertiary,
            marginTop: spacing.lg,
            textAlign: 'center',
        },
        footer: {
            padding: spacing.lg,
            borderTopWidth: 1,
            borderTopColor: colors.border.DEFAULT,
            alignItems: 'center',
        },
        footerText: {
            ...typography.caption,
            color: colors.text.tertiary,
        },
    });
