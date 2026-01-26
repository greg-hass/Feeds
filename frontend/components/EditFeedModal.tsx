import { View, Text, TextInput, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import { useColors, borderRadius, spacing } from '@/theme';
import { Feed } from '@/services/api';

interface EditFeedModalProps {
    visible: boolean;
    feed: Feed | null;
    onSave: (title: string) => void;
    onCancel: () => void;
}

export default function EditFeedModal({ visible, feed, onSave, onCancel }: EditFeedModalProps) {
    const colors = useColors();
    const s = styles(colors);
    const [title, setTitle] = React.useState(feed?.title || '');

    React.useEffect(() => {
        if (visible) {
            setTitle(feed?.title || '');
        }
    }, [visible, feed]);

    const handleSave = () => {
        if (title.trim()) {
            onSave(title);
        }
    };

    return (
        <Modal visible={visible} transparent animationType="fade">
            <View style={s.modalOverlay}>
                <View style={s.modal}>
                    <Text style={s.modalTitle}>Edit Feed</Text>
                    <Text style={s.modalLabel}>Name</Text>
                    <TextInput
                        style={s.modalInput}
                        value={title}
                        onChangeText={setTitle}
                        placeholder="Enter name…"
                        placeholderTextColor={colors.text.tertiary}
                        autoFocus
                        accessibilityLabel="Name"
                    />
                    <View style={s.modalActions}>
                        <TouchableOpacity style={s.modalCancel} onPress={onCancel}>
                            <Text style={s.modalCancelText}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={s.modalConfirm} onPress={handleSave}>
                            <Text style={s.modalConfirmText}>Save</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

const styles = (colors: any) => StyleSheet.create({
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: spacing.xl,
    },
    modal: {
        backgroundColor: colors.background.primary,
        borderRadius: borderRadius.lg,
        padding: spacing.xl,
        width: '100%',
        maxWidth: 400,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '600',
        color: colors.text.primary,
        marginBottom: spacing.lg,
    },
    modalLabel: {
        fontSize: 14,
        color: colors.text.secondary,
        marginBottom: spacing.sm,
    },
    modalInput: {
        backgroundColor: colors.background.secondary,
        borderRadius: borderRadius.md,
        padding: spacing.lg,
        fontSize: 16,
        color: colors.text.primary,
        borderWidth: 1,
        borderColor: colors.border.DEFAULT,
        marginBottom: spacing.xl,
    },
    modalActions: {
        flexDirection: 'row',
        gap: spacing.md,
    },
    modalCancel: {
        flex: 1,
        padding: spacing.md,
        alignItems: 'center',
        backgroundColor: colors.background.secondary,
        borderRadius: borderRadius.md,
    },
    modalCancelText: {
        fontSize: 16,
        color: colors.text.primary,
    },
    modalConfirm: {
        flex: 1,
        padding: spacing.md,
        alignItems: 'center',
        backgroundColor: colors.primary.DEFAULT,
        borderRadius: borderRadius.md,
    },
    modalConfirmText: {
        fontSize: 16,
        color: colors.text.inverse,
        fontWeight: '600',
    },
});
