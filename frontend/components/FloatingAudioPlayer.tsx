import React, { useRef, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, Animated, Image, Platform, useWindowDimensions } from 'react-native';
import { useAudioStore } from '@/stores/audioStore';
import { useColors, borderRadius, spacing } from '@/theme';
import { Play, Pause, X } from 'lucide-react-native';

interface FloatingAudioPlayerProps {
    onRestore: () => void;
}

export const FloatingAudioPlayer = ({ onRestore }: FloatingAudioPlayerProps) => {
    const { isPlaying, title, author, coverArt, isMinimized, restore, stop, pause, resume } = useAudioStore();
    const colors = useColors();
    const { width } = useWindowDimensions();
    const isMobile = width < 1024;
    const isMobileWeb = Platform.OS === 'web' && width < 768;

    const opacity = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(100)).current;

    useEffect(() => {
        if (title && isMinimized) {
            Animated.parallel([
                Animated.timing(opacity, {
                    toValue: 1,
                    duration: 300,
                    useNativeDriver: true,
                }),
                Animated.spring(slideAnim, {
                    toValue: 0,
                    tension: 50,
                    friction: 8,
                    useNativeDriver: true,
                })
            ]).start();
        } else {
            Animated.parallel([
                Animated.timing(opacity, {
                    toValue: 0,
                    duration: 200,
                    useNativeDriver: true,
                }),
                Animated.timing(slideAnim, {
                    toValue: 100,
                    duration: 200,
                    useNativeDriver: true,
                })
            ]).start();
        }
    }, [title, isMinimized]);

    if (!title || !isMinimized) return null;

    const handleRestore = () => {
        restore();
        onRestore();
    };

    const handleStop = (e: any) => {
        e.stopPropagation();
        stop();
    };

    const handleTogglePlay = (e: any) => {
        e.stopPropagation();
        if (isPlaying) pause();
        else resume();
    };

    return (
        <Animated.View
            style={[
                s.container,
                {
                    opacity,
                    transform: [{ translateY: slideAnim }],
                    width: isMobile ? width - spacing.xl * 2 : 400,
                    right: isMobile ? spacing.xl : 40,
                    bottom: isMobile ? (Platform.OS === 'ios' ? 130 : (isMobileWeb ? 115 : 110)) : 40,
                },
            ]}
        >
            <TouchableOpacity
                style={[s.content, { backgroundColor: colors.background.elevated, borderColor: colors.border.DEFAULT }]}
                activeOpacity={0.9}
                onPress={handleRestore}
            >
                <Image source={{ uri: coverArt || '' }} style={s.coverArt} accessibilityLabel={`${title} cover art`} />
                <View style={s.info}>
                    <Text style={[s.title, { color: colors.text.primary }]} numberOfLines={1}>{title}</Text>
                    <Text style={[s.author, { color: colors.text.secondary }]} numberOfLines={1}>{author}</Text>
                </View>
                <View style={s.controls}>
                    <TouchableOpacity onPress={handleTogglePlay} style={[s.playButton, { backgroundColor: colors.primary.DEFAULT }]} accessibilityLabel={isPlaying ? 'Pause audio' : 'Play audio'}>
                        {isPlaying ? (
                            <Pause size={20} color="#fff" fill="#fff" />
                        ) : (
                            <Play size={20} color="#fff" fill="#fff" style={{ marginLeft: 2 }} />
                        )}
                    </TouchableOpacity>
                    <TouchableOpacity onPress={handleStop} style={s.closeButton} accessibilityLabel="Close audio player">
                        <X size={20} color={colors.text.tertiary} />
                    </TouchableOpacity>
                </View>
            </TouchableOpacity>
        </Animated.View>
    );
};

const s = StyleSheet.create({
    container: {
        position: 'absolute',
        zIndex: 10000,
    },
    content: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 20,
        padding: 8,
        borderWidth: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.2,
        shadowRadius: 16,
        elevation: 10,
    },
    coverArt: {
        width: 44,
        height: 44,
        borderRadius: 12,
        backgroundColor: '#333',
    },
    info: {
        flex: 1,
        marginLeft: 12,
        marginRight: 8,
    },
    title: {
        fontSize: 14,
        fontWeight: '800',
        letterSpacing: -0.2,
    },
    author: {
        fontSize: 12,
        fontWeight: '600',
        marginTop: 1,
    },
    controls: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        marginRight: 4,
    },
    playButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
    },
    closeButton: {
        padding: 6,
    }
});
