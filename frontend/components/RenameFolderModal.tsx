import { View, Text, TextInput, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import { useColors, borderRadius, spacing } from '@/theme';
import { Folder } from '@/services/api';

interface RenameFolderModalProps {
    visible: boolean;
    folder: Folder | null;
    onSave: (name: string) => void;
    onCancel: () => void;
}

export default function RenameFolderModal({ visible, folder, onSave, onCancel }: RenameFolderModalProps) {
    const colors = useColors();
    const s = styles(colors);
    const [name, setName] = React.useState(folder?.name || '');

    React.useEffect(() => {
        if (visible) {
            setName(folder?.name || '');
        }
    }, [visible, folder]);

    const handleSave = () => {
        if (name.trim()) {
            onSave(name);
        }
    };

    return (
        <Modal visible={visible} transparent animationType="fade">
            <View style={s.modalOverlay}>
                <View style={s.modal}>
                    <Text style={s.modalTitle}>Rename Folder</Text>
                    <Text style={s.modalLabel}>Name</Text>
                    <TextInput
                        style={s.modalInput}
                        value={name}
                        onChangeText={setName}
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
