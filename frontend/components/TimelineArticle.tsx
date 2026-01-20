import React from 'react';
import { Text, TouchableOpacity, Animated } from 'react-native';
import Swipeable from 'react-native-gesture-handler/Swipeable';
import * as Haptics from 'expo-haptics';
import { Check, Bookmark } from 'lucide-react-native';
import { useArticleStore } from '@/stores';
import { Article } from '@/services/api';
import ArticleCard from './ArticleCard';
import { timelineStyles } from './Timeline.styles';

interface TimelineArticleProps {
    item: Article;
    index: number;
    isActive: boolean;
    isMobile: boolean;
    activeVideoId: string | null;
    playingArticleId: number | null;
    isPlaying: boolean;
    colors: any;
    hotPulseAnim: Animated.Value;
    onArticlePress: (item: Article) => void;
    onVideoPress: (item: Article) => void;
    onPlayPress: (item: Article) => void;
    getBookmarkScale: (id: number) => Animated.Value;
    getBookmarkRotation: (id: number) => Animated.Value;
}

const TimelineArticle: React.FC<TimelineArticleProps> = ({
    item, index, isActive, isMobile, activeVideoId, playingArticleId, isPlaying,
    colors, hotPulseAnim, onArticlePress, onVideoPress, onPlayPress,
    getBookmarkScale, getBookmarkRotation
}) => {
    const s = timelineStyles(colors, isMobile);

    const renderRightActions = (progress: any, dragX: any) => {
        const trans = dragX.interpolate({
            inputRange: [-100, 0],
            outputRange: [1, 0],
            extrapolate: 'clamp',
        });
        return (
            <Animated.View style={[s.swipeActionRight, { transform: [{ translateX: trans }] }]}>
                <TouchableOpacity onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    useArticleStore.getState().markRead(item.id);
                }} style={s.swipeActionButton}>
                    <Check size={24} color="#fff" />
                    <Text style={s.swipeActionText}>Read</Text>
                </TouchableOpacity>
            </Animated.View>
        );
    };

    const renderLeftActions = (progress: any, dragX: any) => {
        const trans = dragX.interpolate({
            inputRange: [0, 100],
            outputRange: [0, 1],
            extrapolate: 'clamp',
        });
        return (
            <Animated.View style={[s.swipeActionLeft, { transform: [{ translateX: trans }] }]}>
                <TouchableOpacity onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    useArticleStore.getState().toggleBookmark(item.id);
                }} style={s.swipeActionButton}>
                    <Bookmark size={24} color="#fff" fill="#fff" />
                    <Text style={s.swipeActionText}>Save</Text>
                </TouchableOpacity>
            </Animated.View>
        );
    };

    const Content = (
        <ArticleCard
            item={item}
            index={index}
            isActive={isActive}
            isMobile={isMobile}
            activeVideoId={activeVideoId}
            playingArticleId={playingArticleId}
            isPlaying={isPlaying}
            onArticlePress={onArticlePress}
            onVideoPress={onVideoPress}
            onPlayPress={onPlayPress}
            onBookmarkToggle={(id) => useArticleStore.getState().toggleBookmark(id)}
            getBookmarkScale={getBookmarkScale}
            getBookmarkRotation={getBookmarkRotation}
            hotPulseAnim={hotPulseAnim}
        />
    );

    if (isMobile) {
        return (
            <Swipeable
                renderRightActions={renderRightActions}
                renderLeftActions={renderLeftActions}
                containerStyle={s.swipeableContainer}
            >
                {Content}
            </Swipeable>
        );
    }

    return Content;
};

export default React.memo(TimelineArticle);
