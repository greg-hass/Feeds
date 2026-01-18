import React from 'react';
import { View, Text, StyleSheet, Modal, ActivityIndicator } from 'react-native';
import { useColors, borderRadius, spacing } from '@/theme';

interface RefreshProgressDialogProps {
    visible: boolean;
    total: number;
    completed: number;
    currentTitle: string;
}

export function RefreshProgressDialog({ visible, total, completed, currentTitle }: RefreshProgressDialogProps) {
    const colors = useColors();
    const progress = total > 0 ? completed / total : 0;
    const percentage = Math.round(progress * 100);

    if (!visible) return null;

    return (
        <Modal transparent visible={visible} animationType="fade">
            <View style={styles.overlay}>
                <View style={[styles.container, { backgroundColor: colors.background.elevated }]}>
                    <Text style={[styles.title, { color: colors.text.primary }]}>Refreshing Feeds</Text>

                    <View style={styles.progressContainer}>
                        <View style={[styles.progressBar, { backgroundColor: colors.background.tertiary }]}>
                            <View
                                style={[
                                    styles.progressFill,
                                    { backgroundColor: colors.primary.DEFAULT, width: `${percentage}%` }
                                ]}
                            />
                        </View>
                        <Text style={[styles.progressText, { color: colors.text.secondary }]}>
                            {completed} of {total} ({percentage}%)
                        </Text>
                    </View>

                    {currentTitle ? (
                        <Text style={[styles.currentFeed, { color: colors.text.tertiary }]} numberOfLines={1}>
                            Currently: {currentTitle}
                        </Text>
                    ) : null}

                    <ActivityIndicator size="small" color={colors.primary.DEFAULT} style={{ marginTop: spacing.md }} />
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: spacing.xl,
    },
    container: {
        width: '100%',
        maxWidth: 400,
        padding: spacing.xl,
        borderRadius: borderRadius.lg,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
        elevation: 10,
    },
    title: {
        fontSize: 18,
        fontWeight: '700',
        marginBottom: spacing.lg,
    },
    progressContainer: {
        width: '100%',
        marginBottom: spacing.md,
    },
    progressBar: {
        height: 8,
        borderRadius: 4,
        overflow: 'hidden',
        marginBottom: spacing.sm,
    },
    progressFill: {
        height: '100%',
    },
    progressText: {
        fontSize: 12,
        textAlign: 'center',
        fontWeight: '600',
    },
    currentFeed: {
        fontSize: 13,
        fontStyle: 'italic',
        marginTop: spacing.sm,
    },
});
