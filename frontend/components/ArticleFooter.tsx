import React from 'react';
import { View, Text, TouchableOpacity, Animated } from 'react-native';
import { Bookmark, Clock, Flame } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { formatDistanceToNow } from 'date-fns';
import { Article } from '@/services/api';
import { useColors } from '@/theme';

interface ArticleFooterProps {
    item: Article;
    isHot: boolean;
    hotPulseAnim: Animated.Value;
    onBookmarkToggle: (id: number) => void;
    getBookmarkScale: (id: number) => Animated.Value;
    getBookmarkRotation: (id: number) => Animated.Value;
}

/**
 * ArticleFooter - Memoized component for article metadata and actions
 * Displays HOT badge, publication time, and bookmark button
 */
const ArticleFooter = React.memo<ArticleFooterProps>(({
    item,
    isHot,
    hotPulseAnim,
    onBookmarkToggle,
    getBookmarkScale,
    getBookmarkRotation,
}) => {
    const colors = useColors();

    const handleBookmarkPress = () => {
        const scale = getBookmarkScale(item.id);
        const rotation = getBookmarkRotation(item.id);

        // Animate bookmark button
        Animated.parallel([
            Animated.sequence([
                Animated.timing(scale, {
                    toValue: 1.3,
                    duration: 150,
                    useNativeDriver: true,
                }),
                Animated.spring(scale, {
                    toValue: 1,
                    friction: 3,
                    tension: 40,
                    useNativeDriver: true,
                }),
            ]),
            Animated.timing(rotation, {
                toValue: 1,
                duration: 300,
                useNativeDriver: true,
            }),
        ]).start();

        onBookmarkToggle(item.id);
    };

    return (
        <View style={styles.articleFooter}>
            <View style={styles.metaRow}>
                {/* HOT Badge */}
                {isHot && (
                    <Animated.View style={{ transform: [{ scale: hotPulseAnim }] }}>
                        <LinearGradient
                            colors={['#f97316', '#ef4444']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.hotBadge}
                        >
                            <Flame size={10} color="#fff" fill="#fff" />
                            <Text style={styles.hotText}>HOT</Text>
                        </LinearGradient>
                    </Animated.View>
                )}
                
                {/* Time */}
                <Clock size={12} color={colors.text.tertiary} />
                <Text style={styles.articleMeta}>
                    {item.published_at ? formatDistanceToNow(new Date(item.published_at), { addSuffix: true }) : ''}
                </Text>
            </View>

            {/* Bookmark Button */}
            <TouchableOpacity
                onPress={handleBookmarkPress}
                style={styles.cardAction}
                accessibilityRole="button"
                accessibilityLabel={item.is_bookmarked ? "Remove bookmark" : "Bookmark article"}
                accessibilityHint="Double tap to save for later"
                accessibilityState={{ selected: item.is_bookmarked }}
            >
                <Animated.View style={{
                    transform: [
                        { scale: getBookmarkScale(item.id) },
                        { rotate: getBookmarkRotation(item.id).interpolate({
                            inputRange: [0, 1],
                            outputRange: ['0deg', '360deg'],
                        })}
                    ]
                }}>
                    <Bookmark
                        size={20}
                        color={item.is_bookmarked ? colors.primary.DEFAULT : colors.text.tertiary}
                        fill={item.is_bookmarked ? colors.primary.DEFAULT : 'transparent'}
                    />
                </Animated.View>
            </TouchableOpacity>
        </View>
    );
}, (prevProps, nextProps) => {
    // Custom comparison - only re-render if these props change
    return (
        prevProps.item.id === nextProps.item.id &&
        prevProps.item.is_bookmarked === nextProps.item.is_bookmarked &&
        prevProps.item.published_at === nextProps.item.published_at &&
        prevProps.isHot === nextProps.isHot
    );
});

ArticleFooter.displayName = 'ArticleFooter';

export default ArticleFooter;

const styles = {
    articleFooter: {
        flexDirection: 'row' as const,
        alignItems: 'center' as const,
        justifyContent: 'space-between' as const,
        paddingTop: 12,
    },
    metaRow: {
        flexDirection: 'row' as const,
        alignItems: 'center' as const,
        gap: 6,
    },
    articleMeta: {
        fontSize: 12,
        color: '#6b7280',
    },
    hotBadge: {
        flexDirection: 'row' as const,
        alignItems: 'center' as const,
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
    },
    hotText: {
        fontSize: 10,
        fontWeight: '700' as const,
        color: '#fff',
        letterSpacing: 0.5,
    },
    cardAction: {
        padding: 8,
        marginRight: -8,
    },
};
