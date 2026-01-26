import { View, Text, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import { useColors, borderRadius, spacing } from '@/theme';
import { Folder, FolderIcon } from 'lucide-react-native';

interface MoveFeedModalProps {
    visible: boolean;
    folders: Folder[];
    selectedFolderId: number | null;
    onSelect: (folderId: number | null) => void;
    onCancel: () => void;
}

export default function MoveFeedModal({ visible, folders, selectedFolderId, onSelect, onCancel }: MoveFeedModalProps) {
    const colors = useColors();
    const s = styles(colors);

    return (
        <Modal visible={visible} transparent animationType="fade">
            <View style={s.modalOverlay}>
                <View style={s.modal}>
                    <Text style={s.modalTitle}>Move to Folder</Text>
                    
                    <TouchableOpacity
                        style={[s.folderOption, selectedFolderId === null && s.folderOptionSelected]}
                        onPress={() => onSelect(null)}
                    >
                        <Text style={s.folderOptionText}>No Folder</Text>
                        {selectedFolderId === null && <FolderIcon size={18} color={colors.primary.DEFAULT} />}
                    </TouchableOpacity>
                    
                    {folders.map((folder) => (
                        <TouchableOpacity
                            key={folder.id}
                            style={[s.folderOption, selectedFolderId === folder.id && s.folderOptionSelected]}
                            onPress={() => onSelect(folder.id)}
                        >
                            <FolderIcon size={18} color={colors.secondary.DEFAULT} />
                            <Text style={s.folderOptionText}>{folder.name}</Text>
                            {selectedFolderId === folder.id && <FolderIcon size={18} color={colors.primary.DEFAULT} />}
                        </TouchableOpacity>
                    ))}
                    
                    <View style={s.modalActions}>
                        <TouchableOpacity style={s.modalCancel} onPress={onCancel}>
                            <Text style={s.modalCancelText}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={s.modalConfirm} onPress={() => onSelect(selectedFolderId)}>
                            <Text style={s.modalConfirmText}>Move</Text>
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
    folderOption: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: spacing.md,
        backgroundColor: colors.background.secondary,
        borderRadius: borderRadius.md,
        marginBottom: spacing.sm,
    },
    folderOptionSelected: {
        backgroundColor: colors.primary.DEFAULT + '11',
        borderColor: colors.primary.DEFAULT + '44',
        borderWidth: 1,
    },
    folderOptionText: {
        fontSize: 15,
        color: colors.text.primary,
        flex: 1,
    },
    modalActions: {
        flexDirection: 'row',
        gap: spacing.md,
        marginTop: spacing.lg,
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
