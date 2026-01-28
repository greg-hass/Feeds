import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useColors, borderRadius, spacing } from '@/theme';
import { Youtube, MessageSquare, Rss, Newspaper, TrendingUp, Zap, Code, Coffee } from 'lucide-react-native';

interface QuickFeed {
    id: string;
    name: string;
    icon: React.ReactNode;
    color: string;
    url: string;
    type: 'youtube' | 'reddit' | 'rss';
}

const quickFeeds: QuickFeed[] = [
    {
        id: 'hackernews',
        name: 'Hacker News',
        icon: <TrendingUp size={20} color="#ff6600" />,
        color: '#ff6600',
        url: 'https://news.ycombinator.com/rss',
        type: 'rss',
    },
    {
        id: 'youtube-trending',
        name: 'YouTube Trending',
        icon: <Youtube size={20} color="#ef4444" />,
        color: '#ef4444',
        url: 'https://www.youtube.com/feed/trending',
        type: 'youtube',
    },
    {
        id: 'reddit-frontpage',
        name: 'Reddit Front Page',
        icon: <MessageSquare size={20} color="#f97316" />,
        color: '#f97316',
        url: 'https://www.reddit.com/.rss',
        type: 'reddit',
    },
    {
        id: 'techcrunch',
        name: 'TechCrunch',
        icon: <Zap size={20} color="#0af" />,
        color: '#0af',
        url: 'https://techcrunch.com/feed/',
        type: 'rss',
    },
    {
        id: 'devto',
        name: 'Dev.to',
        icon: <Code size={20} color="#3b49df" />,
        color: '#3b49df',
        url: 'https://dev.to/feed',
        type: 'rss',
    },
    {
        id: 'morning-brew',
        name: 'Morning Brew',
        icon: <Coffee size={20} color="#7c3aed" />,
        color: '#7c3aed',
        url: 'https://morningbrew.com/daily/rss',
        type: 'rss',
    },
];

interface QuickAddGridProps {
    onSelect: (url: string, type: string) => void;
}

export const QuickAddGrid = ({ onSelect }: QuickAddGridProps) => {
    const colors = useColors();
    const s = styles(colors);

    return (
        <View style={s.container}>
            <Text style={s.sectionTitle}>Popular Feeds</Text>
            <View style={s.grid}>
                {quickFeeds.map((feed) => (
                    <TouchableOpacity
                        key={feed.id}
                        style={s.item}
                        onPress={() => onSelect(feed.url, feed.type)}
                        activeOpacity={0.7}
                    >
                        <View style={[s.iconContainer, { backgroundColor: feed.color + '15' }]}>
                            {feed.icon}
                        </View>
                        <Text style={s.name} numberOfLines={1}>
                            {feed.name}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>
        </View>
    );
};

const styles = (colors: any) => StyleSheet.create({
    container: {
        marginTop: spacing.lg,
    },
    sectionTitle: {
        fontSize: 13,
        fontWeight: '800',
        color: colors.text.tertiary,
        letterSpacing: 0.5,
        marginBottom: spacing.md,
        textTransform: 'uppercase',
    },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.sm,
    },
    item: {
        width: '30%',
        flexGrow: 1,
        alignItems: 'center',
        padding: spacing.md,
        backgroundColor: colors.background.elevated,
        borderRadius: borderRadius.lg,
        borderWidth: 1,
        borderColor: colors.border.DEFAULT,
    },
    iconContainer: {
        width: 44,
        height: 44,
        borderRadius: borderRadius.full,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: spacing.sm,
    },
    name: {
        fontSize: 12,
        fontWeight: '600',
        color: colors.text.secondary,
        textAlign: 'center',
    },
});
