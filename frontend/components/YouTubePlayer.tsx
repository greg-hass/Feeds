import React from 'react';
import { View, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { Play } from 'lucide-react-native';

interface YouTubePlayerProps {
    videoId: string;
    thumbnail: string | null;
    isPlaying: boolean;
    onPress: () => void;
}

/**
 * YouTubePlayer - Memoized component for YouTube video display
 * Shows thumbnail with play button overlay or WebView placeholder when playing
 */
const YouTubePlayer = React.memo<YouTubePlayerProps>(({
    videoId,
    thumbnail,
    isPlaying,
    onPress,
}) => {
    return (
        <View style={styles.videoContainer}>
            {isPlaying ? (
                <View style={styles.webview}>
                    {/* WebView placeholder - actual implementation in parent */}
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
                        resizeMode="contain"
                    />
                    <View style={styles.playButtonOverlay}>
                        <View style={styles.playButtonCircle}>
                            <Play size={24} color="#fff" fill="#fff" style={{ marginLeft: 4 }} />
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
        prevProps.isPlaying === nextProps.isPlaying
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
    webview: {
        width: '100%',
        height: '100%',
    },
});
