import { View, Text, StyleSheet, Modal } from 'react-native';
import { useColors, borderRadius, spacing } from '@/theme';
import { Feed } from '@/services/api';
import { Input } from './ui/Input';
import { Button } from './ui/Button';

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
    const [error, setError] = React.useState('');

    React.useEffect(() => {
        if (visible) {
            setTitle(feed?.title || '');
            setError('');
        }
    }, [visible, feed]);

    const handleSave = () => {
        if (!title.trim()) {
            setError('Name cannot be empty');
            return;
        }
        onSave(title);
    };

    const handleChangeText = (text: string) => {
        setTitle(text);
        if (error) setError('');
    };

    return (
        <Modal visible={visible} transparent animationType="fade">
            <View style={s.modalOverlay}>
                <View style={s.modal}>
                    <Text style={s.modalTitle}>Edit Feed</Text>
                    <Text style={s.modalLabel}>Name</Text>
                    <Input
                        value={title}
                        onChangeText={handleChangeText}
                        placeholder="Enter name…"
                        autoFocus
                        accessibilityLabel="Name"
                        error={error}
                        style={{ marginBottom: spacing.xl }}
                    />
                    <View style={s.modalActions}>
                        <Button
                            title="Cancel"
                            variant="secondary"
                            onPress={onCancel}
                            style={{ flex: 1 }}
                        />
                        <Button
                            title="Save"
                            onPress={handleSave}
                            style={{ flex: 1 }}
                        />
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
    modalActions: {
        flexDirection: 'row',
        gap: spacing.md,
    },
});
