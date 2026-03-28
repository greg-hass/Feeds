import React from 'react';
import { View, StyleSheet, Modal, TouchableOpacity, useWindowDimensions, Pressable, Platform, Text } from 'react-native';
import { X, Minimize2 } from 'lucide-react-native';
import { useColors, borderRadius, spacing } from '@/theme';
import { getEmbedUrl } from '@/utils/youtube';

interface VideoModalProps {
    videoId: string | null;
    visible: boolean;
    onClose: () => void;
    onMinimize?: () => void;
    title?: string;
}

// Lazy load WebView only on native platforms
const NativeWebView = Platform.OS !== 'web'
    ? require('react-native-webview').WebView
    : null;

export function VideoModal({ videoId, visible, onClose, onMinimize, title }: VideoModalProps) {
    const colors = useColors();
    const { width, height } = useWindowDimensions();

    if (!videoId) return null;

    // Calculate video dimensions (max 80% width/height, 16:9 aspect ratio)
    const maxWidth = width * 0.8;
    const maxHeight = height * 0.8;

    let videoWidth = maxWidth;
    let videoHeight = videoWidth * (9 / 16);

    if (videoHeight > maxHeight) {
        videoHeight = maxHeight;
        videoWidth = videoHeight * (16 / 9);
    }

    const s = styles(colors);

    return (
        <Modal
            transparent
            visible={visible}
            animationType="fade"
            onRequestClose={onClose}
        >
            <View style={s.overlay}>
                <Pressable style={s.backdrop} onPress={onClose} />

                <View style={[s.content, { width: videoWidth, height: videoHeight }]}>
                    <View style={s.header}>
                        <View style={s.headerTitleContainer}>
                            <Text style={s.headerEyebrow}>Video Preview</Text>
                            <Text style={s.headerTitle} numberOfLines={1}>{title}</Text>
                        </View>
                        <View style={s.headerActions}>
                            {onMinimize && (
                                <TouchableOpacity onPress={onMinimize} style={s.headerButton} accessibilityLabel="Minimize video">
                                    <Minimize2 size={18} color={colors.text.primary} />
                                </TouchableOpacity>
                            )}
                            <TouchableOpacity onPress={onClose} style={s.headerButton} accessibilityLabel="Close video">
                                <X size={18} color={colors.text.primary} />
                            </TouchableOpacity>
                        </View>
                    </View>

                    {Platform.OS === 'web' ? (
                        <iframe
                            width="100%"
                            height="100%"
                            src={getEmbedUrl(videoId, true, true)}
                            frameBorder="0"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                            allowFullScreen
                            style={{ borderBottomLeftRadius: borderRadius.lg, borderBottomRightRadius: borderRadius.lg }}
                            title="YouTube video player"
                            // iOS PWA: inline playback support
                            {...({ webkitplaysinline: 'true' } as any)}
                            playsInline
                        />
                    ) : NativeWebView ? (
                        <NativeWebView
                            source={{ uri: getEmbedUrl(videoId, true, true) }}
                            style={{ flex: 1, borderBottomLeftRadius: borderRadius.lg, borderBottomRightRadius: borderRadius.lg }}
                            allowsFullscreenVideo
                            mediaPlaybackRequiresUserAction={false}
                            javaScriptEnabled
                            domStorageEnabled
                            allowsInlineMediaPlayback
                        />
                    ) : null}
                </View>
            </View>
        </Modal>
    );
}

const styles = (colors: any) => StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.55)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: spacing.xl,
    },
    backdrop: {
        ...StyleSheet.absoluteFillObject,
    },
    content: {
        backgroundColor: colors.background.primary,
        borderRadius: borderRadius.xl,
        borderWidth: 1,
        borderColor: colors.border.DEFAULT,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.2,
        shadowRadius: 16,
        elevation: 8,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: spacing.md,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderBottomWidth: 1,
        borderBottomColor: colors.border.DEFAULT,
        backgroundColor: colors.background.secondary,
    },
    headerTitleContainer: {
        flex: 1,
        gap: 2,
    },
    headerEyebrow: {
        fontSize: 10,
        fontWeight: '800',
        color: colors.text.tertiary,
        textTransform: 'uppercase',
        letterSpacing: 0.8,
    },
    headerTitle: {
        color: colors.text.primary,
        fontSize: 13,
        fontWeight: '700',
    },
    headerActions: {
        flexDirection: 'row',
        gap: spacing.xs,
    },
    headerButton: {
        padding: 7,
        borderRadius: borderRadius.md,
        backgroundColor: colors.background.primary,
        borderWidth: 1,
        borderColor: colors.border.DEFAULT,
    },
});
