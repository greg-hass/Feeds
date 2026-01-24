import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal } from 'react-native';
import { X } from 'lucide-react-native';
import { useColors, spacing, borderRadius, shadows } from '@/theme';
import { SHORTCUTS } from '@/hooks/useKeyboardShortcuts';

interface ShortcutsModalProps {
  visible: boolean;
  onClose: () => void;
}

export const ShortcutsModal = ({ visible, onClose }: ShortcutsModalProps) => {
  const colors = useColors();
  const s = styles(colors);

  const shortcuts = [
    { ...SHORTCUTS.REFRESH, key: 'R' },
    { ...SHORTCUTS.SEARCH, key: '/' },
    { ...SHORTCUTS.BOOKMARK, key: 'B' },
    { ...SHORTCUTS.MARK_READ, key: 'M' },
    { ...SHORTCUTS.NEXT, key: 'J' },
    { ...SHORTCUTS.PREV, key: 'K' },
    { ...SHORTCUTS.OPEN, key: 'O' },
  ];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={s.overlay}>
        <View style={s.modal}>
          <View style={s.header}>
            <Text style={s.title}>Keyboard Shortcuts</Text>
            <TouchableOpacity onPress={onClose} style={s.closeButton} accessibilityLabel="Close keyboard shortcuts">
              <X size={24} color={colors.text.primary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={s.content}>
            {shortcuts.map((shortcut, index) => (
              <View key={index} style={s.shortcutRow}>
                <View style={s.keyBadge}>
                  <Text style={s.keyText}>{shortcut.key}</Text>
                </View>
                <Text style={s.description}>{shortcut.description}</Text>
              </View>
            ))}
          </ScrollView>

          <View style={s.footer}>
            <Text style={s.footerText}>Press ? to show this dialog</Text>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = (colors: any) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  modal: {
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.xl,
    width: '100%',
    maxWidth: 500,
    maxHeight: '80%',
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
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text.primary,
  },
  closeButton: {
    padding: spacing.sm,
  },
  content: {
    padding: spacing.lg,
  },
  shortcutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  keyBadge: {
    backgroundColor: colors.background.tertiary,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minWidth: 40,
    alignItems: 'center',
    marginRight: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border.DEFAULT,
  },
  keyText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text.primary,
    fontFamily: 'monospace',
  },
  description: {
    fontSize: 15,
    color: colors.text.secondary,
    flex: 1,
  },
  footer: {
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border.DEFAULT,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 13,
    color: colors.text.tertiary,
  },
});
