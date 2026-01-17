import React from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity } from 'react-native';
import { useToastStore } from '@/stores';
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react-native';
import { colors, borderRadius, spacing } from '@/theme';

const ToastItem = ({ id, message, type }: { id: string; message: string; type: 'success' | 'error' | 'info' }) => {
    const { hide } = useToastStore();
    const opacity = React.useRef(new Animated.Value(0)).current;

    React.useEffect(() => {
        Animated.timing(opacity, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
        }).start();
    }, []);

    const getIcon = () => {
        switch (type) {
            case 'success': return <CheckCircle size={18} color={colors.primary.DEFAULT} />;
            case 'error': return <AlertCircle size={18} color={colors.error} />;
            default: return <Info size={18} color={colors.secondary.DEFAULT} />;
        }
    };

    return (
        <Animated.View style={[styles.toast, { opacity }]}>
            {getIcon()}
            <Text style={styles.message}>{message}</Text>
            <TouchableOpacity onPress={() => hide(id)} style={styles.closeButton}>
                <X size={16} color={colors.text.tertiary} />
            </TouchableOpacity>
        </Animated.View>
    );
};

export default function ToastContainer() {
    const { toasts } = useToastStore();

    if (toasts.length === 0) return null;

    return (
        <View style={styles.container}>
            {toasts.map((toast) => (
                <ToastItem key={toast.id} {...toast} />
            ))}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        top: 60,
        right: 20,
        zIndex: 1000,
        gap: spacing.sm,
    },
    toast: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.background.elevated,
        padding: spacing.md,
        borderRadius: borderRadius.md,
        borderWidth: 1,
        borderColor: colors.border.DEFAULT,
        minWidth: 200,
        maxWidth: 400,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 5,
    },
    message: {
        flex: 1,
        fontSize: 14,
        color: colors.text.primary,
        marginLeft: spacing.sm,
    },
    closeButton: {
        padding: spacing.xs,
        marginLeft: spacing.sm,
    },
});
