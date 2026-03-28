import React from 'react';
import { View, Text, TouchableOpacity, Animated, Platform } from 'react-native';
import { Bookmark, Clock } from 'lucide-react-native';
import { formatDistanceToNow } from 'date-fns';
import { Article } from '@/services/api';
import { useColors } from '@/theme';

interface ArticleFooterProps {
    item: Article;
    onBookmarkToggle: (id: number) => void;
    getBookmarkScale: (id: number) => Animated.Value;
    getBookmarkRotation: (id: number) => Animated.Value;
}

/**
 * ArticleFooter - Memoized component for article metadata and actions
 * Displays publication time and bookmark button
 */
const ArticleFooter = React.memo<ArticleFooterProps>(({
    item,
    onBookmarkToggle,
    getBookmarkScale,
    getBookmarkRotation,
}) => {
    const colors = useColors();
    const useNativeDriver = Platform.OS !== 'web';

    const handleBookmarkPress = () => {
        const scale = getBookmarkScale(item.id);
        const rotation = getBookmarkRotation(item.id);

        // Animate bookmark button
        Animated.parallel([
            Animated.sequence([
                Animated.timing(scale, {
                    toValue: 1.3,
                    duration: 150,
                    useNativeDriver,
                }),
                Animated.spring(scale, {
                    toValue: 1,
                    friction: 3,
                    tension: 40,
                    useNativeDriver,
                }),
            ]),
            Animated.timing(rotation, {
                toValue: 1,
                duration: 300,
                useNativeDriver,
            }),
        ]).start();

        onBookmarkToggle(item.id);
    };

    return (
        <View style={styles.articleFooter}>
            <View style={styles.metaRow}>
                {/* Time */}
                <Clock size={11} color={colors.primary.DEFAULT} />
                <Text style={[styles.articleMeta, { color: colors.primary.DEFAULT }]}>
                    {item.published_at ? formatDistanceToNow(new Date(item.published_at), { addSuffix: true }) : ''}
                </Text>
            </View>

            <View style={styles.actionsRow}>
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
                            size={18}
                            color={item.is_bookmarked ? colors.primary.DEFAULT : colors.text.tertiary}
                            fill={item.is_bookmarked ? colors.primary.DEFAULT : 'transparent'}
                        />
                    </Animated.View>
                </TouchableOpacity>
            </View>
        </View>
    );
    }, (prevProps, nextProps) => {
    return (
        prevProps.item.id === nextProps.item.id &&
        prevProps.item.is_bookmarked === nextProps.item.is_bookmarked &&
        prevProps.item.published_at === nextProps.item.published_at
    );
});

ArticleFooter.displayName = 'ArticleFooter';

export default ArticleFooter;

const styles = {
    articleFooter: {
        flexDirection: 'row' as const,
        alignItems: 'center' as const,
        justifyContent: 'space-between' as const,
        paddingTop: 5,
    },
    metaRow: {
        flexDirection: 'row' as const,
        alignItems: 'center' as const,
        gap: 5,
    },
    articleMeta: {
        fontSize: 10,
        color: '#6b7280',
    },
    actionsRow: {
        flexDirection: 'row' as const,
        alignItems: 'center' as const,
        gap: 0,
    },
    cardAction: {
        paddingHorizontal: 5,
        paddingVertical: 3,
    },
};
