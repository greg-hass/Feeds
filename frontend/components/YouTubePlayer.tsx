import React from 'react';
import { View, Image, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Play } from 'lucide-react-native';
import { WebView } from 'react-native-webview';
import { getEmbedUrl } from '@/utils/youtube';
import { useColors } from '@/theme';

interface YouTubePlayerProps {
    videoId: string;
    thumbnail: string | null;
    isPlaying: boolean;
    isShort?: boolean;
    onPress: () => void;
}

/**
 * YouTubePlayer - Memoized component for YouTube video display
 * Shows thumbnail with play button overlay or WebView when playing
 */
const YouTubePlayer = React.memo<YouTubePlayerProps>(({
    videoId,
    thumbnail,
    isPlaying,
    isShort = false,
    onPress,
}) => {
    const colors = useColors();
    const embedUrl = getEmbedUrl(videoId);

    return (
        <View style={styles.videoContainer}>
            {isPlaying ? (
                <View style={styles.webviewContainer}>
                    {Platform.OS === 'web' ? (
                        <iframe
                            src={embedUrl}
                            style={{ border: 'none', width: '100%', height: '100%' }}
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                        />
                    ) : (
                        <WebView
                            source={{ uri: embedUrl }}
                            style={styles.webview}
                            allowsFullscreenVideo
                            allowsInlineMediaPlayback
                            mediaPlaybackRequiresUserAction={false}
                        />
                    )}
                </View>
            ) : (
                <TouchableOpacity 
                    style={styles.videoThumbnailWrapper}
                    onPress={onPress}
                    activeOpacity={0.9}
                    accessibilityRole="button"
                    accessibilityLabel="Play YouTube video"
                    accessibilityHint="Double tap to play video"
                >
                    <Image 
                        source={{ uri: thumbnail || `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg` }} 
                        style={styles.thumbnail} 
                        resizeMode={isShort ? "contain" : "cover"}
                    />
                    <View style={styles.playButtonOverlay}>
                        <View style={styles.playButtonCircle}>
                            <Play size={24} color={colors.text.inverse} fill={colors.text.inverse} style={{ marginLeft: 4 }} />
                        </View>
                    </View>
                </TouchableOpacity>
            )}
        </View>
    );
}, (prevProps, nextProps) => {
    // Custom comparison - only re-render if these props change
    return (
        prevProps.videoId === nextProps.videoId &&
        prevProps.isPlaying === nextProps.isPlaying &&
        prevProps.isShort === nextProps.isShort
    );
});

YouTubePlayer.displayName = 'YouTubePlayer';

export default YouTubePlayer;

const styles = StyleSheet.create({
    videoContainer: {
        width: '100%',
        aspectRatio: 16 / 9,
        backgroundColor: '#000',
        borderRadius: 12,
        overflow: 'hidden',
        marginTop: 12,
    },
    videoThumbnailWrapper: {
        width: '100%',
        height: '100%',
        position: 'relative',
    },
    thumbnail: {
        width: '100%',
        height: '100%',
    },
    playButtonOverlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
    },
    playButtonCircle: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 3,
        borderColor: '#fff',
    },
    webviewContainer: {
        flex: 1,
        backgroundColor: '#000',
    },
    webview: {
        flex: 1,
        backgroundColor: 'transparent',
    },
});
