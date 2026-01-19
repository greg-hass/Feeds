import { useState, useCallback, useEffect, useRef } from 'react';
import { View, Text, TextInput, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Animated, Platform, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { formatDistanceToNow } from 'date-fns';
import { api, SearchResult } from '@/services/api';
import { Search as SearchIcon, ArrowLeft, X, Clock, Trash2, Filter } from 'lucide-react-native';
import { useColors, borderRadius, spacing } from '@/theme';
import AsyncStorage from '@react-native-async-storage/async-storage';

const RECENT_SEARCHES_KEY = 'recent_searches_v1';
const FILTERS = [
    { label: 'All', value: undefined },
    { label: 'YouTube', value: 'youtube' },
    { label: 'RSS', value: 'rss' },
    { label: 'Podcasts', value: 'podcast' },
    { label: 'Reddit', value: 'reddit' },
];

export default function SearchScreen() {
    const router = useRouter();
    const colors = useColors();
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<SearchResult[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [hasSearched, setHasSearched] = useState(false);
    const [recentSearches, setRecentSearches] = useState<string[]>([]);
    const [isFocused, setIsFocused] = useState(false);

    // Filters
    const [selectedType, setSelectedType] = useState<string | undefined>(undefined);
    const [unreadOnly, setUnreadOnly] = useState(false);

    const fadeAnim = useRef(new Animated.Value(0)).current;

    const s = styles(colors);

    useEffect(() => {
        loadRecentSearches();
    }, []);

    const loadRecentSearches = async () => {
        try {
            const stored = await AsyncStorage.getItem(RECENT_SEARCHES_KEY);
            if (stored) setRecentSearches(JSON.parse(stored));
        } catch (e) {
            console.error('Failed to load recent searches', e);
        }
    };

    const saveSearch = async (term: string) => {
        if (!term.trim()) return;
        const filtered = recentSearches.filter(s => s !== term);
        const updated = [term, ...filtered].slice(0, 10);
        setRecentSearches(updated);
        try {
            await AsyncStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
        } catch (e) {
            console.error('Failed to save search', e);
        }
    };

    const removeRecentSearch = async (term: string) => {
        const updated = recentSearches.filter(s => s !== term);
        setRecentSearches(updated);
        try {
            await AsyncStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
        } catch (e) {
            console.error('Failed to remove recent search', e);
        }
    };

    const clearRecentSearches = async () => {
        setRecentSearches([]);
        try {
            await AsyncStorage.removeItem(RECENT_SEARCHES_KEY);
        } catch (e) {
            console.error('Failed to clear recent searches', e);
        }
    };

    const handleSearch = useCallback(async (searchTerm: string, type?: string, unread?: boolean) => {
        const t = searchTerm.trim();
        if (!t) {
            setResults([]);
            setHasSearched(false);
            return;
        }

        setIsLoading(true);
        setHasSearched(true);
        saveSearch(t);

        try {
            const response = await api.search(t, {
                type: type || undefined,
                unread_only: unread
            });
            setResults(response.results);
            fadeAnim.setValue(0);
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 400,
                useNativeDriver: true,
            }).start();
        } catch (err) {
            console.error('Search failed:', err);
            setResults([]);
        } finally {
            setIsLoading(false);
        }
    }, [recentSearches]);

    // Debounce effect for query, type, and unreadOnly changes
    useEffect(() => {
        const timer = setTimeout(() => {
            if (query.trim() !== '') {
                handleSearch(query, selectedType, unreadOnly);
            } else {
                setResults([]);
                setHasSearched(false);
            }
        }, 400);

        return () => clearTimeout(timer);
    }, [query, selectedType, unreadOnly]);

    const handleResultPress = (id: number) => {
        router.push(`/(app)/article/${id}`);
    };

    const HighlightedText = ({ text }: { text: string }) => {
        const parts = text.split(/(<mark>.*?<\/mark>)/g);
        return (
            <Text style={s.snippet}>
                {parts.map((part, i) => {
                    if (part.startsWith('<mark>') && part.endsWith('</mark>')) {
                        const word = part.replace(/<\/?mark>/g, '');
                        return (
                            <Text key={i} style={s.highlight}>
                                {word}
                            </Text>
                        );
                    }
                    return part;
                })}
            </Text>
        );
    };

    const renderResult = ({ item }: { item: SearchResult }) => (
        <TouchableOpacity
            style={s.result}
            onPress={() => handleResultPress(item.id)}
            activeOpacity={0.7}
        >
            <View style={s.resultHeader}>
                <View style={s.badgeRow}>
                    <Text style={s.feedTitle}>{item.feed_title}</Text>
                    {!item.is_read && <View style={s.unreadIndicator} />}
                </View>
                {item.published_at && (
                    <Text style={s.timestamp}>
                        {formatDistanceToNow(new Date(item.published_at), { addSuffix: true })}
                    </Text>
                )}
            </View>
            <Text style={s.resultTitle} numberOfLines={2}>{item.title}</Text>
            <HighlightedText text={item.snippet} />
        </TouchableOpacity>
    );

    return (
        <View style={s.container}>
            {/* Header */}
            <View style={s.header}>
                <TouchableOpacity
                    onPress={() => router.back()}
                    style={s.backButton}
                    accessibilityLabel="Go back"
                >
                    <ArrowLeft size={24} color={colors.text.primary} />
                </TouchableOpacity>

                <View style={[s.searchInputContainer, isFocused && s.searchFocused]}>
                    <SearchIcon size={18} color={isFocused ? colors.primary.DEFAULT : colors.text.tertiary} />
                    <TextInput
                        style={s.searchInput}
                        placeholder="Search articles..."
                        placeholderTextColor={colors.text.tertiary}
                        value={query}
                        onChangeText={setQuery}
                        onFocus={() => setIsFocused(true)}
                        onBlur={() => setIsFocused(false)}
                        returnKeyType="search"
                        autoFocus
                    />
                    {query.length > 0 && (
                        <TouchableOpacity onPress={() => setQuery('')}>
                            <X size={18} color={colors.text.tertiary} />
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            {/* Filters Bar */}
            <View style={s.filterBar}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filterScroll}>
                    <TouchableOpacity
                        style={[s.filterPill, unreadOnly && s.filterPillActive]}
                        onPress={() => setUnreadOnly(!unreadOnly)}
                    >
                        <Text style={[s.filterText, unreadOnly && s.filterTextActive]}>Unread Only</Text>
                    </TouchableOpacity>
                    <View style={s.filterDivider} />
                    {FILTERS.map((f) => (
                        <TouchableOpacity
                            key={f.label}
                            style={[s.filterPill, selectedType === f.value && s.filterPillActive]}
                            onPress={() => setSelectedType(f.value)}
                        >
                            <Text style={[s.filterText, selectedType === f.value && s.filterTextActive]}>{f.label}</Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            {/* Content */}
            {query.length === 0 && recentSearches.length > 0 ? (
                <View style={s.recentContainer}>
                    <View style={s.recentHeader}>
                        <Text style={s.recentTitle}>Recent Searches</Text>
                        <TouchableOpacity onPress={clearRecentSearches}>
                            <Trash2 size={16} color={colors.text.tertiary} />
                        </TouchableOpacity>
                    </View>
                    {recentSearches.map((term, i) => (
                        <TouchableOpacity
                            key={i}
                            style={s.recentItem}
                            onPress={() => setQuery(term)}
                        >
                            <Clock size={16} color={colors.text.tertiary} />
                            <Text style={s.recentText}>{term}</Text>
                            <TouchableOpacity onPress={() => removeRecentSearch(term)}>
                                <X size={16} color={colors.text.tertiary} />
                            </TouchableOpacity>
                        </TouchableOpacity>
                    ))}
                </View>
            ) : isLoading ? (
                <View style={s.loading}>
                    <ActivityIndicator size="large" color={colors.primary.DEFAULT} />
                    <Text style={s.loadingText}>Searching through your knowledge...</Text>
                </View>
            ) : (
                <Animated.View style={[s.listContainer, { opacity: fadeAnim }]}>
                    <FlatList
                        data={results}
                        keyExtractor={(item: SearchResult) => String(item.id)}
                        renderItem={renderResult}
                        contentContainerStyle={s.list}
                        ItemSeparatorComponent={() => <View style={s.separator} />}
                        ListEmptyComponent={
                            hasSearched ? (
                                <View style={s.empty}>
                                    <View style={s.emptyIconCircle}>
                                        <Filter size={32} color={colors.text.tertiary} />
                                    </View>
                                    <Text style={s.emptyTitle}>No matches found</Text>
                                    <Text style={s.emptyText}>Try adjusting your filters or search term</Text>
                                </View>
                            ) : (
                                <View style={s.empty}>
                                    <SearchIcon size={48} color={colors.background.tertiary} />
                                    <View style={s.emptyContent}>
                                        <Text style={s.emptyTitleLarge}>Deep Search</Text>
                                        <Text style={s.emptyText}>Find any article, video, or podcast transcript across all your feeds instantly.</Text>
                                    </View>
                                </View>
                            )
                        }
                    />
                </Animated.View>
            )}
        </View>
    );
}

const styles = (colors: any) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background.primary,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: spacing.lg,
        gap: spacing.md,
        backgroundColor: colors.background.primary,
        ...Platform.select({
            web: {
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)',
            },
        }),
    },
    backButton: {
        padding: spacing.sm,
        marginLeft: -spacing.sm,
    },
    searchInputContainer: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.background.secondary,
        borderRadius: borderRadius.lg,
        paddingHorizontal: spacing.md,
        gap: spacing.sm,
        borderWidth: 1,
        borderColor: colors.border.DEFAULT,
    },
    searchFocused: {
        borderColor: colors.primary.DEFAULT,
        backgroundColor: colors.background.primary,
    },
    searchInput: {
        flex: 1,
        paddingVertical: spacing.md,
        fontSize: 16,
        fontWeight: '600',
        color: colors.text.primary,
    },
    filterBar: {
        borderBottomWidth: 1,
        borderBottomColor: colors.border.DEFAULT,
        backgroundColor: colors.background.primary,
    },
    filterScroll: {
        padding: spacing.md,
        gap: spacing.sm,
        alignItems: 'center',
    },
    filterPill: {
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.sm,
        borderRadius: borderRadius.full,
        backgroundColor: colors.background.secondary,
        borderWidth: 1,
        borderColor: colors.border.DEFAULT,
    },
    filterPillActive: {
        backgroundColor: colors.primary.DEFAULT,
        borderColor: colors.primary.DEFAULT,
    },
    filterText: {
        fontSize: 13,
        fontWeight: '600',
        color: colors.text.secondary,
    },
    filterTextActive: {
        color: colors.text.inverse,
    },
    filterDivider: {
        width: 1,
        height: 20,
        backgroundColor: colors.border.DEFAULT,
        marginHorizontal: spacing.xs,
    },
    loading: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        gap: spacing.md,
    },
    loadingText: {
        color: colors.text.secondary,
        fontWeight: '600',
        fontSize: 14,
    },
    listContainer: {
        flex: 1,
    },
    list: {
        padding: spacing.lg,
        maxWidth: 800,
        alignSelf: 'center',
        width: '100%',
    },
    result: {
        backgroundColor: colors.background.elevated,
        borderRadius: borderRadius.xl,
        padding: spacing.xl,
        borderWidth: 1,
        borderColor: colors.border.DEFAULT,
        ...Platform.select({
            web: {
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.04)',
            },
        }),
    },
    resultHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.sm,
    },
    badgeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
    },
    unreadIndicator: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: colors.primary.DEFAULT,
    },
    feedTitle: {
        fontSize: 12,
        color: colors.primary.DEFAULT,
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    resultTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: colors.text.primary,
        lineHeight: 24,
        marginBottom: spacing.sm,
        letterSpacing: -0.3,
    },
    snippet: {
        fontSize: 14,
        color: colors.text.secondary,
        lineHeight: 20,
    },
    highlight: {
        backgroundColor: colors.primary.DEFAULT + '33',
        color: colors.primary.DEFAULT,
        fontWeight: '700',
    },
    timestamp: {
        fontSize: 12,
        color: colors.text.tertiary,
        fontWeight: '600',
    },
    separator: {
        height: spacing.lg,
    },
    recentContainer: {
        padding: spacing.xl,
        maxWidth: 600,
        alignSelf: 'center',
        width: '100%',
    },
    recentHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.xl,
    },
    recentTitle: {
        fontSize: 13,
        fontWeight: '800',
        color: colors.text.tertiary,
        textTransform: 'uppercase',
        letterSpacing: 1.5,
    },
    recentItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        paddingVertical: spacing.lg,
        borderBottomWidth: 1,
        borderBottomColor: colors.border.DEFAULT,
    },
    recentText: {
        flex: 1,
        fontSize: 16,
        color: colors.text.primary,
        fontWeight: '600',
    },
    empty: {
        alignItems: 'center',
        paddingVertical: 100,
        paddingHorizontal: spacing.xxl,
    },
    emptyContent: {
        alignItems: 'center',
        marginTop: spacing.xl,
    },
    emptyIconCircle: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: colors.background.tertiary,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: spacing.xl,
    },
    emptyTitle: {
        fontSize: 22,
        fontWeight: '800',
        color: colors.text.primary,
        marginBottom: spacing.sm,
        letterSpacing: -0.5,
    },
    emptyTitleLarge: {
        fontSize: 32,
        fontWeight: '900',
        color: colors.text.primary,
        marginBottom: spacing.md,
        letterSpacing: -1,
    },
    emptyText: {
        fontSize: 15,
        color: colors.text.tertiary,
        textAlign: 'center',
        lineHeight: 24,
        fontWeight: '500',
        maxWidth: 320,
    },
});
