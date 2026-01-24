import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, Modal, Platform, useWindowDimensions } from 'react-native';
import { Trash2, Edit3, Check, X } from 'lucide-react-native';
import { useColors, spacing, borderRadius, typography } from '@/theme';
import {
    Highlight,
    useHighlightsStore,
    getHighlightColor,
    getHighlightAccentColor,
} from '@/stores/highlightsStore';
import { useToastStore } from '@/stores/toastStore';

interface HighlightPopoverProps {
    highlight: Highlight | null;
    visible: boolean;
    onClose: () => void;
}

const COLORS: Highlight['color'][] = ['yellow', 'green', 'blue', 'pink', 'purple'];

/**
 * Popover menu for editing highlight color and note
 * Shows when a highlight is tapped
 */
export function HighlightPopover({ highlight, visible, onClose }: HighlightPopoverProps) {
    const colors = useColors();
    const { updateHighlight, deleteHighlight } = useHighlightsStore();
    const { showToast } = useToastStore();
    const { width } = useWindowDimensions();
    const isDesktop = Platform.OS === 'web' && width >= 1024;

    const [note, setNote] = useState(highlight?.note || '');
    const [isEditingNote, setIsEditingNote] = useState(false);

    const s = styles(colors);

    if (!highlight) return null;

    const handleColorChange = async (color: Highlight['color']) => {
        try {
            await updateHighlight(highlight.id, { color });
            showToast('Highlight color updated', 'success');
        } catch (error) {
            showToast('Failed to update color', 'error');
        }
    };

    const handleSaveNote = async () => {
        try {
            await updateHighlight(highlight.id, { note: note.trim() || null });
            setIsEditingNote(false);
            showToast('Note saved', 'success');
        } catch (error) {
            showToast('Failed to save note', 'error');
        }
    };

    const handleDelete = async () => {
        try {
            await deleteHighlight(highlight.id);
            onClose();
            showToast('Highlight deleted', 'success');
        } catch (error) {
            showToast('Failed to delete highlight', 'error');
        }
    };

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <Pressable style={s.overlay} onPress={onClose}>
                <View style={s.popover} onStartShouldSetResponder={() => true}>
                    {/* Header with highlighted text preview */}
                    <View style={s.header}>
                        <Text style={s.previewText} numberOfLines={2}>
                            "{highlight.text}"
                        </Text>
                    </View>

                    {/* Color palette */}
                    <View style={s.section}>
                        <Text style={s.sectionTitle}>Color</Text>
                        <View style={s.colorRow}>
                            {COLORS.map((color) => {
                                const bgColor = getHighlightColor(color);
                                const accentColor = getHighlightAccentColor(color);
                                const isSelected = highlight.color === color;

                                return (
                                    <Pressable
                                        key={color}
                                        style={[
                                            s.colorButton,
                                            { backgroundColor: bgColor },
                                            isSelected && {
                                                borderWidth: 3,
                                                borderColor: accentColor,
                                            },
                                        ]}
                                        onPress={() => handleColorChange(color)}
                                    >
                                        {isSelected && <Check size={16} color={accentColor} />}
                                    </Pressable>
                                );
                            })}
                        </View>
                    </View>

                    {/* Note section */}
                    <View style={s.section}>
                        <View style={s.sectionHeader}>
                            <Text style={s.sectionTitle}>Note</Text>
                            {!isEditingNote && (
                                <Pressable onPress={() => setIsEditingNote(true)} accessibilityLabel="Edit note">
                                    <Edit3 size={16} color={colors.text.tertiary} />
                                </Pressable>
                            )}
                        </View>

                        {isEditingNote ? (
                            <View>
                                <TextInput
                                    style={s.noteInput}
                                    value={note}
                                    onChangeText={setNote}
                                    placeholder="Add a note…"
                                    placeholderTextColor={colors.text.tertiary}
                                    multiline
                                    numberOfLines={3}
                                    autoFocus={isDesktop}
                                    accessibilityLabel="Note"
                                />
                                <View style={s.noteActions}>
                                    <Pressable
                                        style={s.noteButton}
                                        onPress={() => {
                                            setNote(highlight.note || '');
                                            setIsEditingNote(false);
                                        }}
                                    >
                                        <X size={16} color={colors.text.tertiary} />
                                        <Text style={s.noteButtonText}>Cancel</Text>
                                    </Pressable>
                                    <Pressable
                                        style={[s.noteButton, s.noteButtonPrimary]}
                                        onPress={handleSaveNote}
                                    >
                                        <Check size={16} color={colors.text.inverse} />
                                        <Text style={[s.noteButtonText, s.noteButtonTextPrimary]}>
                                            Save
                                        </Text>
                                    </Pressable>
                                </View>
                            </View>
                        ) : (
                            <Text style={s.notePreview}>{highlight.note || 'No note added'}</Text>
                        )}
                    </View>

                    {/* Actions */}
                    <View style={s.actions}>
                        <Pressable style={s.deleteButton} onPress={handleDelete}>
                            <Trash2 size={18} color={colors.error.DEFAULT} />
                            <Text style={s.deleteButtonText}>Delete Highlight</Text>
                        </Pressable>
                    </View>
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
            justifyContent: 'center',
            alignItems: 'center',
            padding: spacing.xl,
        },
        popover: {
            backgroundColor: colors.background.elevated,
            borderRadius: borderRadius.xl,
            width: '100%',
            maxWidth: 400,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.15,
            shadowRadius: 16,
            elevation: 8,
        },
        header: {
            padding: spacing.lg,
            borderBottomWidth: 1,
            borderBottomColor: colors.border.DEFAULT,
        },
        previewText: {
            ...typography.body,
            color: colors.text.primary,
            fontStyle: 'italic',
        },
        section: {
            padding: spacing.lg,
            borderBottomWidth: 1,
            borderBottomColor: colors.border.DEFAULT,
        },
        sectionHeader: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: spacing.md,
        },
        sectionTitle: {
            ...typography.h4,
            color: colors.text.primary,
        },
        colorRow: {
            flexDirection: 'row',
            gap: spacing.md,
        },
        colorButton: {
            width: 48,
            height: 48,
            borderRadius: borderRadius.md,
            justifyContent: 'center',
            alignItems: 'center',
        },
        noteInput: {
            ...typography.body,
            color: colors.text.primary,
            backgroundColor: colors.background.secondary,
            borderWidth: 1,
            borderColor: colors.border.DEFAULT,
            borderRadius: borderRadius.md,
            padding: spacing.md,
            minHeight: 80,
            textAlignVertical: 'top',
        },
        noteActions: {
            flexDirection: 'row',
            gap: spacing.md,
            marginTop: spacing.md,
        },
        noteButton: {
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: spacing.xs,
            paddingVertical: spacing.md,
            borderRadius: borderRadius.md,
            backgroundColor: colors.background.secondary,
            borderWidth: 1,
            borderColor: colors.border.DEFAULT,
        },
        noteButtonPrimary: {
            backgroundColor: colors.primary.DEFAULT,
            borderColor: colors.primary.DEFAULT,
        },
        noteButtonText: {
            ...typography.button,
            color: colors.text.primary,
        },
        noteButtonTextPrimary: {
            color: colors.text.inverse,
        },
        notePreview: {
            ...typography.body,
            color: colors.text.secondary,
            fontStyle: highlight?.note ? 'normal' : 'italic',
        },
        actions: {
            padding: spacing.lg,
        },
        deleteButton: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: spacing.sm,
            paddingVertical: spacing.md,
            borderRadius: borderRadius.md,
            backgroundColor: colors.error.DEFAULT + '15',
        },
        deleteButtonText: {
            ...typography.button,
            color: colors.error.DEFAULT,
        },
    });
