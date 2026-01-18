import React from 'react';
import { View, StyleSheet, Modal, TouchableOpacity, useWindowDimensions, Pressable, Platform } from 'react-native';
import { X } from 'lucide-react-native';
import { useColors, borderRadius, spacing } from '@/theme';
import { getEmbedUrl } from '@/utils/youtube';

interface VideoModalProps {
    videoId: string | null;
    visible: boolean;
    onClose: () => void;
}

// Lazy load WebView only on native platforms
const NativeWebView = Platform.OS !== 'web'
    ? require('react-native-webview').WebView
    : null;

export function VideoModal({ videoId, visible, onClose }: VideoModalProps) {
    const colors = useColors();
    const { width, height } = useWindowDimensions();
    const isMobile = width < 768;

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
                        <TouchableOpacity onPress={onClose} style={s.closeButton}>
                            <X size={24} color="#fff" />
                        </TouchableOpacity>
                    </View>

                    {Platform.OS === 'web' ? (
                        <iframe
                            width="100%"
                            height="100%"
                            src={getEmbedUrl(videoId, true, true)}
                            frameBorder="0"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                            style={{ borderBottomLeftRadius: borderRadius.lg, borderBottomRightRadius: borderRadius.lg }}
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
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    backdrop: {
        ...StyleSheet.absoluteFillObject,
    },
    content: {
        backgroundColor: '#000',
        borderRadius: borderRadius.lg,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.5,
        shadowRadius: 20,
        elevation: 10,
    },
    header: {
        position: 'absolute',
        top: -40,
        right: 0,
        zIndex: 10,
    },
    closeButton: {
        padding: spacing.sm,
    },
});
