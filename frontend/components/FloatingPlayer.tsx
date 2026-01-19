import React, { useRef, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, Animated, PanResponder, Platform, useWindowDimensions } from 'react-native';
import { useVideoStore } from '@/stores';
import { useColors, borderRadius, spacing } from '@/theme';
import { getEmbedUrl } from '@/utils/youtube';
import { X, Maximize2, Minimize2, GripHorizontal } from 'lucide-react-native';

export const FloatingPlayer = () => {
    const { activeVideoId, activeVideoTitle, isMinimized, restore, close } = useVideoStore();
    const colors = useColors();
    const { width, height } = useWindowDimensions();
    const isMobile = width < 1024;

    const pan = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
    const opacity = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (activeVideoId && isMinimized) {
            Animated.timing(opacity, {
                toValue: 1,
                duration: 300,
                useNativeDriver: true,
            }).start();
        } else {
            Animated.timing(opacity, {
                toValue: 0,
                duration: 200,
                useNativeDriver: true,
            }).start();
        }
    }, [activeVideoId, isMinimized]);

    const panResponder = useRef(
        PanResponder.create({
            onMoveShouldSetPanResponder: () => true,
            onPanResponderGrant: () => {
                pan.setOffset({
                    x: (pan.x as any)._value,
                    y: (pan.y as any)._value,
                });
            },
            onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], {
                useNativeDriver: false,
            }),
            onPanResponderRelease: () => {
                pan.flattenOffset();
            },
        })
    ).current;

    if (!activeVideoId || !isMinimized) return null;

    const playerWidth = isMobile ? width * 0.45 : 320;
    const playerHeight = playerWidth * (9 / 16);

    return (
        <Animated.View
            style={[
                s.container,
                {
                    opacity,
                    transform: [{ translateX: pan.x }, { translateY: pan.y }],
                },
            ]}
            {...panResponder.panHandlers}
        >
            <View style={[s.content, { width: playerWidth }]}>
                <View style={s.dragHandle}>
                    <GripHorizontal size={16} color={colors.text.tertiary} />
                    <Text style={s.title} numberOfLines={1}>{activeVideoTitle || 'Video'}</Text>
                </View>

                <View style={[s.playerWrapper, { height: playerHeight }]}>
                    {Platform.OS === 'web' ? (
                        <iframe
                            width="100%"
                            height="100%"
                            src={getEmbedUrl(activeVideoId, true, true)}
                            frameBorder="0"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                            allowFullScreen
                            style={{ borderBottomLeftRadius: borderRadius.md, borderBottomRightRadius: borderRadius.md }}
                            title="YouTube player"
                        />
                    ) : (
                        <View style={s.nativePlaceholder}>
                            <Text style={s.placeholderText}>Native PIP coming soon</Text>
                        </View>
                    )}
                </View>

                <View style={s.footer}>
                    <TouchableOpacity onPress={restore} style={s.actionButton}>
                        <Maximize2 size={16} color={colors.text.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={close} style={s.actionButton}>
                        <X size={16} color={colors.error} />
                    </TouchableOpacity>
                </View>
            </View>
        </Animated.View>
    );
};

const s = StyleSheet.create({
    container: {
        position: 'absolute',
        bottom: 80, // Above mobile nav
        right: 20,
        zIndex: 10000,
    },
    content: {
        backgroundColor: '#000',
        borderRadius: borderRadius.md,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
        elevation: 8,
        borderWidth: 1,
        borderColor: '#333',
    },
    dragHandle: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.sm,
        paddingVertical: 4,
        backgroundColor: '#1a1a1a',
        gap: spacing.xs,
    },
    title: {
        flex: 1,
        fontSize: 10,
        color: '#fff',
        fontWeight: '600',
    },
    playerWrapper: {
        backgroundColor: '#000',
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        padding: 4,
        backgroundColor: '#1a1a1a',
        gap: spacing.sm,
    },
    actionButton: {
        padding: 4,
    },
    nativePlaceholder: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#222',
    },
    placeholderText: {
        color: '#888',
        fontSize: 12,
    }
});
