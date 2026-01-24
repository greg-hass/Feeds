import React, { useState } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, Modal, useWindowDimensions, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAudioStore } from '@/stores/audioStore';
import { useColors, borderRadius, spacing } from '@/theme';
import {
    Play, Pause, RotateCcw, RotateCw,
    X, ChevronDown, Timer, Gauge,
    Volume2, VolumeX, MoreVertical
} from 'lucide-react-native';
import Slider from '@react-native-community/slider';

interface PodcastPlayerProps {
    // No props needed now, uses store
}

export const PodcastPlayer = () => {
    const colors = useColors();
    const { width, height } = useWindowDimensions();
    const insets = useSafeAreaInsets();
    const isMobile = width < 1024;

    const {
        isPlaying, title, author, coverArt,
        position, duration, playbackSpeed,
        pause, resume, seek, skipForward, skipBackward,
        setSpeed, sleepTimer, setSleepTimer,
        minimize, stop, isPlayerVisible, hidePlayer
    } = useAudioStore();

    if (!title || !isPlayerVisible) return null;

    const handleMinimize = () => {
        minimize();
    };

    const handleStop = () => {
        stop();
        hidePlayer();
    };

    const formatTime = (millis: number) => {
        const totalSeconds = millis / 1000;
        const seconds = Math.floor(totalSeconds % 60);
        const minutes = Math.floor(totalSeconds / 60);
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    };

    const s = styles(colors, isMobile, width, height, insets);

    return (
        <Modal visible={isPlayerVisible} animationType="slide" presentationStyle="fullScreen" onRequestClose={handleMinimize}>
            <View style={s.container}>
                {/* Header */}
                <View style={s.header}>
                    <TouchableOpacity onPress={handleMinimize} style={s.iconButton} accessibilityLabel="Minimize player">
                        <ChevronDown size={28} color={colors.text.primary} />
                    </TouchableOpacity>
                    <Text style={s.headerTitle}>Now Playing</Text>
                    <TouchableOpacity onPress={handleStop} style={s.iconButton} accessibilityLabel="Close player">
                        <X size={24} color={colors.error || '#ff4444'} />
                    </TouchableOpacity>
                </View>

                {/* Immersive Cover Art */}
                <View style={s.coverWrapper}>
                <Image source={{ uri: coverArt || '' }} style={s.coverArt} resizeMode="cover" accessibilityLabel={`${title} cover art`} />
                </View>

                {/* Info */}
                <View style={s.infoSection}>
                    <Text style={s.title} numberOfLines={2}>{title}</Text>
                    <Text style={s.author}>{author}</Text>
                </View>

                {/* Progress */}
                <View style={s.progressSection}>
                    <Slider
                        style={s.slider}
                        minimumValue={0}
                        maximumValue={duration}
                        value={position}
                        onSlidingComplete={seek}
                        minimumTrackTintColor={colors.primary.DEFAULT}
                        maximumTrackTintColor={colors.background.tertiary}
                        thumbTintColor={colors.primary.DEFAULT}
                    />
                    <View style={s.timeRow}>
                        <Text style={s.timeText}>{formatTime(position)}</Text>
                        <Text style={s.timeText}>{formatTime(duration)}</Text>
                    </View>
                </View>

                {/* Controls */}
                <View style={s.controlsSection}>
                    <TouchableOpacity onPress={skipBackward} style={s.skipButton} accessibilityLabel="Skip back 15 seconds">
                        <RotateCcw size={32} color={colors.text.primary} />
                        <Text style={s.skipText}>15s</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={isPlaying ? pause : resume}
                        style={s.playButton}
                        accessibilityLabel={isPlaying ? 'Pause playback' : 'Play'}
                    >
                        {isPlaying ? (
                            <Pause size={48} color="#fff" fill="#fff" />
                        ) : (
                            <Play size={48} color="#fff" fill="#fff" style={{ marginLeft: 6 }} />
                        )}
                    </TouchableOpacity>

                    <TouchableOpacity onPress={skipForward} style={s.skipButton} accessibilityLabel="Skip forward 30 seconds">
                        <RotateCw size={32} color={colors.text.primary} />
                        <Text style={s.skipText}>30s</Text>
                    </TouchableOpacity>
                </View>

                {/* Secondary Actions */}
                <View style={s.footerActions}>
                    <TouchableOpacity
                        style={[s.footerPill, playbackSpeed !== 1 && s.footerPillActive]}
                        onPress={() => setSpeed(playbackSpeed === 2 ? 1 : playbackSpeed + 0.25)}
                        accessibilityLabel="Change playback speed"
                    >
                        <Gauge size={16} color={playbackSpeed !== 1 ? '#fff' : colors.text.primary} />
                        <Text style={[s.footerText, playbackSpeed !== 1 && s.footerTextActive]}>{playbackSpeed}x</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[s.footerPill, !!sleepTimer && s.footerPillActive]}
                        onPress={() => setSleepTimer(sleepTimer ? null : 30)}
                        accessibilityLabel="Set sleep timer"
                    >
                        <Timer size={16} color={!!sleepTimer ? '#fff' : colors.text.primary} />
                        <Text style={[s.footerText, !!sleepTimer && s.footerTextActive]}>
                            {sleepTimer ? `${sleepTimer}m` : 'Sleep'}
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
};

const styles = (colors: any, isMobile: boolean, width: number, height: number, insets: any) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background.primary,
        paddingTop: Platform.OS === 'ios' ? insets.top + spacing.xl : spacing.lg,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: spacing.xl,
        marginBottom: spacing.xl,
    },
    headerTitle: {
        fontSize: 14,
        fontWeight: '800',
        textTransform: 'uppercase',
        letterSpacing: 1,
        color: colors.text.tertiary,
    },
    iconButton: {
        padding: spacing.sm,
    },
    coverWrapper: {
        width: width * 0.8,
        aspectRatio: 1,
        alignSelf: 'center',
        borderRadius: borderRadius.xxl,
        overflow: 'hidden',
        backgroundColor: colors.background.tertiary,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 20 },
        shadowOpacity: 0.3,
        shadowRadius: 30,
        elevation: 20,
        marginBottom: spacing.xxl,
    },
    coverArt: {
        width: '100%',
        height: '100%',
    },
    infoSection: {
        alignItems: 'center',
        paddingHorizontal: spacing.xxl,
        marginBottom: spacing.xl,
    },
    title: {
        fontSize: isMobile ? 24 : 32,
        fontWeight: '900',
        color: colors.text.primary,
        textAlign: 'center',
        lineHeight: isMobile ? 32 : 40,
        marginBottom: spacing.sm,
        letterSpacing: -0.5,
    },
    author: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.primary.DEFAULT,
        textAlign: 'center',
    },
    progressSection: {
        paddingHorizontal: spacing.xxl,
        marginBottom: spacing.xl,
    },
    slider: {
        width: '100%',
        height: 40,
    },
    timeRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: 10,
    },
    timeText: {
        fontSize: 12,
        fontWeight: '700',
        color: colors.text.tertiary,
        fontFamily: Platform.OS === 'web' ? 'monospace' : undefined,
    },
    controlsSection: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: spacing.xxl,
        marginBottom: spacing.xxl,
    },
    playButton: {
        width: 96,
        height: 96,
        borderRadius: 48,
        backgroundColor: colors.primary.DEFAULT,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: colors.primary.DEFAULT,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.4,
        shadowRadius: 16,
        elevation: 10,
    },
    skipButton: {
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
    },
    skipText: {
        fontSize: 11,
        fontWeight: '800',
        color: colors.text.secondary,
    },
    footerActions: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: spacing.md,
        paddingBottom: spacing.xxl,
    },
    footerPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: spacing.xl,
        paddingVertical: spacing.md,
        borderRadius: borderRadius.full,
        backgroundColor: colors.background.secondary,
        borderWidth: 1,
        borderColor: colors.border.DEFAULT,
    },
    footerPillActive: {
        backgroundColor: colors.primary.DEFAULT,
        borderColor: colors.primary.DEFAULT,
    },
    footerText: {
        fontSize: 14,
        fontWeight: '800',
        color: colors.text.secondary,
    },
    footerTextActive: {
        color: '#fff',
    }
});
