import { useState, useCallback, useEffect, useMemo } from 'react';
import { View, Text, TextInput, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Animated, Platform, ScrollView, useWindowDimensions, Modal } from 'react-native';
import { useRouter } from 'expo-router';
import { formatDistanceToNow } from 'date-fns';
import { api, SearchResult, SearchSuggestions, SavedSearch } from '@/services/api';
import { Search as SearchIcon, X, Clock, Trash2, Filter, FolderOpen, BookOpen, Star, Hash, User, Newspaper, Globe, Layers, Bookmark } from 'lucide-react-native';
import { useColors, borderRadius, spacing } from '@/theme';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
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
    const { width } = useWindowDimensions();
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<SearchResult[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [hasSearched, setHasSearched] = useState(false);
    const [suggestions, setSuggestions] = useState<SearchSuggestions | null>(null);
    const [suggestionsLoading, setSuggestionsLoading] = useState(false);
    const [isFocused, setIsFocused] = useState(false);

    // Filters
    const [selectedType, setSelectedType] = useState<string | undefined>(undefined);
    const [unreadOnly, setUnreadOnly] = useState(false);
    const [selectedFeedId, setSelectedFeedId] = useState<number | undefined>(undefined);
    const [selectedFeedTitle, setSelectedFeedTitle] = useState<string | null>(null);
    const [selectedFolderId, setSelectedFolderId] = useState<number | undefined>(undefined);
    const [selectedFolderTitle, setSelectedFolderTitle] = useState<string | null>(null);
    const [selectedAuthor, setSelectedAuthor] = useState<string | null>(null);
    const [selectedTags, setSelectedTags] = useState<string[]>([]);
    const [activePreset, setActivePreset] = useState<SavedSearch | null>(null);
    const [isSavePresetOpen, setIsSavePresetOpen] = useState(false);
    const [presetName, setPresetName] = useState('');
    const isDesktop = Platform.OS === 'web' && width >= 1024;

    const [fadeAnim] = useState(() => new Animated.Value(0));

    const s = useMemo(() => styles(colors), [colors]);

    const clearScope = useCallback(() => {
        setSelectedFeedId(undefined);
        setSelectedFeedTitle(null);
        setSelectedFolderId(undefined);
        setSelectedFolderTitle(null);
        setSelectedAuthor(null);
        setSelectedTags([]);
    }, []);

    const currentFilters = useMemo(() => ({
        query: query.trim() || undefined,
        unread_only: unreadOnly || undefined,
        type: selectedType,
        feed_id: selectedFeedId,
        folder_id: selectedFolderId,
        author: selectedAuthor || undefined,
        tags: selectedTags.length ? selectedTags : undefined,
    }), [query, unreadOnly, selectedFeedId, selectedFolderId, selectedType, selectedAuthor, selectedTags]);

    const hasSearchCriteria = useMemo(() => {
        return Boolean(query.trim() || unreadOnly || selectedType || selectedFeedId || selectedFolderId || selectedAuthor || selectedTags.length);
    }, [query, unreadOnly, selectedType, selectedFeedId, selectedFolderId, selectedAuthor, selectedTags.length]);

    const presetSuggestions = suggestions?.saved_searches ?? [];

    const buildPresetName = useCallback(() => {
        const parts: string[] = [];
        if (selectedFeedTitle) parts.push(selectedFeedTitle);
        if (selectedFolderTitle) parts.push(selectedFolderTitle);
        if (selectedType) parts.push(selectedType.toUpperCase());
        if (unreadOnly) parts.push('Unread');
        if (selectedAuthor) parts.push(selectedAuthor);
        if (selectedTags.length) parts.push(selectedTags.slice(0, 2).join(', '));
        const queryText = query.trim();
        if (queryText) parts.unshift(queryText);
        return parts.length > 0 ? parts.slice(0, 3).join(' • ') : 'New preset';
    }, [query, selectedFeedTitle, selectedFolderTitle, selectedType, unreadOnly, selectedAuthor, selectedTags]);

    const syncPresetResults = useCallback(async (saved: SavedSearch) => {
        setIsLoading(true);
        setHasSearched(true);
        try {
            const presetTags = saved.filters.tags ?? [];
            const [response, suggestionsResponse] = await Promise.all([
                api.executeSavedSearch(saved.id, { limit: 50, includeTotal: false }),
                api.searchSuggestions(saved.query || saved.name, 8),
            ]);

            setResults(response.results);
            setSuggestions(suggestionsResponse);
            setSelectedAuthor(saved.filters.author ?? null);
            setSelectedTags(presetTags);
            fadeAnim.setValue(0);
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 400,
                useNativeDriver: Platform.OS !== 'web',
            }).start();
        } catch (err) {
            console.error('Preset execution failed:', err);
            setResults([]);
        } finally {
            setIsLoading(false);
        }
    }, [fadeAnim]);

    const fetchSuggestions = useCallback(async (searchTerm: string) => {
        setSuggestionsLoading(true);
        try {
            const response = await api.searchSuggestions(searchTerm, 8);
            setSuggestions(response);
        } catch (error) {
            console.error('Failed to load search suggestions', error);
            setSuggestions(null);
        } finally {
            setSuggestionsLoading(false);
        }
    }, []);

    const handleSearch = useCallback(async (searchTerm: string) => {
        const t = searchTerm.trim();
        const hasFilterScope = Boolean(unreadOnly || selectedType || selectedFeedId || selectedFolderId || selectedAuthor || selectedTags.length);
        if (!t && !hasFilterScope) {
            setResults([]);
            setHasSearched(false);
            await fetchSuggestions('');
            return;
        }

        setIsLoading(true);
        setHasSearched(true);

        try {
            const [response, suggestionsResponse] = await Promise.all([
                api.search(t, {
                    type: selectedType || undefined,
                    unread_only: unreadOnly,
                    feedId: selectedFeedId,
                    folderId: selectedFolderId,
                    author: selectedAuthor || undefined,
                    tags: selectedTags.length ? selectedTags : undefined,
                    includeTotal: false,
                }),
                api.searchSuggestions(t, 8),
            ]);

            setResults(response.results);
            setSuggestions(suggestionsResponse);
            fadeAnim.setValue(0);
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 400,
                useNativeDriver: Platform.OS !== 'web',
            }).start();
        } catch (err) {
            console.error('Search failed:', err);
            setResults([]);
        } finally {
            setIsLoading(false);
        }
    }, [fadeAnim, fetchSuggestions, unreadOnly, selectedType, selectedFeedId, selectedFolderId, selectedAuthor, selectedTags]);

    const handleSavePreset = useCallback(async () => {
        const name = presetName.trim() || buildPresetName();
        const queryText = query.trim();
        try {
            await api.createSavedSearch(name, queryText, currentFilters);
            setIsSavePresetOpen(false);
            setPresetName('');
            await fetchSuggestions(queryText);
        } catch (error) {
            console.error('Failed to save preset', error);
        }
    }, [buildPresetName, currentFilters, fetchSuggestions, presetName, query]);

    // Debounce effect for query, type, and unreadOnly changes
    useEffect(() => {
        const timer = setTimeout(() => {
            const trimmed = query.trim();
            if (activePreset) {
                void syncPresetResults(activePreset);
            } else if (trimmed !== '' || unreadOnly || selectedType || selectedFeedId || selectedFolderId || selectedAuthor || selectedTags.length) {
                void handleSearch(trimmed);
            } else {
                setResults([]);
                setHasSearched(false);
                fetchSuggestions('');
            }
        }, 400);

        return () => clearTimeout(timer);
    }, [query, selectedType, unreadOnly, selectedFeedId, selectedFolderId, selectedAuthor, selectedTags, handleSearch, fetchSuggestions, activePreset, syncPresetResults]);

    const handleResultPress = (id: number) => {
        router.push(`/(app)/article/${id}`);
    };

    const handleSuggestionPress = (
        kind: 'recent' | 'popular' | 'saved' | 'tag' | 'author' | 'feed' | 'folder',
        value: string,
        options?: { feedId?: number; folderId?: number; type?: string; savedSearch?: SavedSearch }
    ) => {
        if (kind === 'feed') {
            setActivePreset(null);
            setSelectedFeedId(options?.feedId);
            setSelectedFeedTitle(value);
            setSelectedFolderId(undefined);
            setSelectedFolderTitle(null);
            setQuery(value);
            return;
        }

        if (kind === 'folder') {
            setActivePreset(null);
            setSelectedFolderId(options?.folderId);
            setSelectedFolderTitle(value);
            setSelectedFeedId(undefined);
            setSelectedFeedTitle(null);
            setQuery(value);
            return;
        }

        if (kind === 'author') {
            setActivePreset(null);
            setSelectedAuthor((current) => current === value ? null : value);
            return;
        }

        if (kind === 'tag') {
            setActivePreset(null);
            setSelectedTags((current) => current.includes(value)
                ? current.filter((tag) => tag !== value)
                : [...current, value]);
            return;
        }

        if (kind === 'saved' && options?.savedSearch) {
            const saved = options.savedSearch;
            setActivePreset(saved);
            setSelectedType(saved.filters.type);
            setSelectedFeedId(saved.filters.feed_ids?.[0]);
            setSelectedFeedTitle(null);
            setSelectedFolderId(saved.filters.folder_ids?.[0]);
            setSelectedFolderTitle(null);
            setSelectedAuthor(saved.filters.author ?? null);
            setSelectedTags(saved.filters.tags ?? []);
            setUnreadOnly(saved.filters.is_read === false ? true : saved.filters.is_read === true ? false : unreadOnly);
            setQuery(saved.query || saved.name);
            return;
        }

        setActivePreset(null);
        clearScope();
        setQuery(value);
    };

    const clearQuery = () => {
        setQuery('');
        setResults([]);
        setHasSearched(false);
        setActivePreset(null);
        clearScope();
        setUnreadOnly(false);
        setSelectedType(undefined);
        fetchSuggestions('');
    };

    const clearPreset = () => {
        setActivePreset(null);
        setResults([]);
        setHasSearched(false);
    };

    const clearAllFilters = useCallback(() => {
        setUnreadOnly(false);
        setSelectedType(undefined);
        setActivePreset(null);
        clearScope();
    }, [clearScope]);

    const clearSearchHistory = async () => {
        try {
            await api.delete('/search/history');
            await fetchSuggestions(query.trim());
        } catch (error) {
            console.error('Failed to clear search history', error);
        }
    };

    const renderPresetChips = () => {
        if (!presetSuggestions.length) return null;

        return (
            <View style={s.presetSection}>
                <View style={s.presetHeader}>
                    <Text style={s.recentTitle}>Presets</Text>
                    {hasSearchCriteria ? (
                        <TouchableOpacity
                            style={s.savePresetButton}
                            onPress={() => {
                                setPresetName(buildPresetName());
                                setIsSavePresetOpen(true);
                            }}
                            accessibilityLabel="Save current search as preset"
                        >
                            <Bookmark size={14} color={colors.primary.DEFAULT} />
                            <Text style={s.savePresetButtonText}>Save preset</Text>
                        </TouchableOpacity>
                    ) : null}
                </View>

                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.presetScroll}>
                    {presetSuggestions.map((preset) => (
                        <TouchableOpacity
                            key={preset.id}
                            style={[
                                s.presetChip,
                                activePreset?.id === preset.id && s.presetChipActive,
                            ]}
                            onPress={() => handleSuggestionPress('saved', preset.name, { savedSearch: preset })}
                            accessibilityRole="button"
                            accessibilityState={{ selected: activePreset?.id === preset.id }}
                        >
                            <BookOpen size={12} color={activePreset?.id === preset.id ? colors.text.inverse : colors.primary.DEFAULT} />
                            <Text style={[
                                s.presetChipText,
                                activePreset?.id === preset.id && s.presetChipTextActive,
                            ]} numberOfLines={1}>
                                {preset.name}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>
        );
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
        <View testID="search-screen" style={s.container}>
            <ScreenHeader title="Search" />

            <View style={s.searchControls}>
                <View style={[s.searchInputContainer, isFocused && s.searchFocused]}>
                    <SearchIcon size={18} color={isFocused ? colors.primary.DEFAULT : colors.text.tertiary} />
                    <TextInput
                        testID="search-input"
                        style={s.searchInput}
                        placeholder="Search articles…"
                        placeholderTextColor={colors.text.tertiary}
                        value={query}
                        onChangeText={(text) => {
                            if (activePreset) {
                                setActivePreset(null);
                            }
                            setQuery(text);
                        }}
                        onFocus={() => setIsFocused(true)}
                        onBlur={() => setIsFocused(false)}
                        returnKeyType="search"
                        autoFocus={isDesktop}
                        accessibilityLabel="Search articles"
                    />
                    {query.length > 0 && (
                        <TouchableOpacity onPress={clearQuery} accessibilityLabel="Clear search">
                            <X size={18} color={colors.text.tertiary} />
                        </TouchableOpacity>
                    )}
                </View>

                <View style={s.filterBar}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filterScroll}>
                    <TouchableOpacity
                        style={[s.filterPill, unreadOnly && s.filterPillActive]}
                        onPress={() => {
                            setActivePreset(null);
                            setUnreadOnly(!unreadOnly);
                        }}
                    >
                        <Text style={[s.filterText, unreadOnly && s.filterTextActive]}>Unread Only</Text>
                    </TouchableOpacity>
                    <View style={s.filterDivider} />
                    {FILTERS.map((f) => (
                        <TouchableOpacity
                            key={f.label}
                            style={[s.filterPill, selectedType === f.value && s.filterPillActive]}
                            onPress={() => {
                                setActivePreset(null);
                                setSelectedType(f.value);
                            }}
                        >
                            <Text style={[s.filterText, selectedType === f.value && s.filterTextActive]}>{f.label}</Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>
            </View>

            {renderPresetChips()}

            {/* Content */}
            {(selectedFeedTitle || selectedFolderTitle || selectedAuthor || selectedTags.length > 0 || unreadOnly || selectedType) && (
                <View style={s.scopeRow}>
                    {(unreadOnly || selectedType || selectedFeedTitle || selectedFolderTitle || selectedAuthor || selectedTags.length > 0) && (
                        <TouchableOpacity
                            style={s.clearFiltersButton}
                            onPress={clearAllFilters}
                            accessibilityLabel="Clear all filters"
                        >
                            <Trash2 size={13} color={colors.text.tertiary} />
                            <Text style={s.clearFiltersText}>Clear filters</Text>
                        </TouchableOpacity>
                    )}
                    {selectedFeedTitle && (
                        <View style={s.scopeChip}>
                            <Globe size={13} color={colors.primary.DEFAULT} />
                            <Text style={s.scopeChipText}>{selectedFeedTitle}</Text>
                            <TouchableOpacity onPress={() => { setSelectedFeedId(undefined); setSelectedFeedTitle(null); }} accessibilityLabel="Clear feed scope">
                                <X size={14} color={colors.text.tertiary} />
                            </TouchableOpacity>
                        </View>
                    )}
                    {selectedFolderTitle && (
                        <View style={s.scopeChip}>
                            <FolderOpen size={13} color={colors.primary.DEFAULT} />
                            <Text style={s.scopeChipText}>{selectedFolderTitle}</Text>
                            <TouchableOpacity onPress={() => { setSelectedFolderId(undefined); setSelectedFolderTitle(null); }} accessibilityLabel="Clear folder scope">
                                <X size={14} color={colors.text.tertiary} />
                            </TouchableOpacity>
                        </View>
                    )}
                    {unreadOnly && (
                        <View style={s.scopeChip}>
                            <Clock size={13} color={colors.primary.DEFAULT} />
                            <Text style={s.scopeChipText}>Unread only</Text>
                            <TouchableOpacity onPress={() => setUnreadOnly(false)} accessibilityLabel="Clear unread filter">
                                <X size={14} color={colors.text.tertiary} />
                            </TouchableOpacity>
                        </View>
                    )}
                    {selectedType && (
                        <View style={s.scopeChip}>
                            <Filter size={13} color={colors.primary.DEFAULT} />
                            <Text style={s.scopeChipText}>{selectedType.toUpperCase()}</Text>
                            <TouchableOpacity onPress={() => setSelectedType(undefined)} accessibilityLabel="Clear type filter">
                                <X size={14} color={colors.text.tertiary} />
                            </TouchableOpacity>
                        </View>
                    )}
                </View>
            )}

            {(selectedAuthor || selectedTags.length > 0) && (
                <View style={s.scopeRow}>
                    {selectedAuthor && (
                        <View style={s.scopeChip}>
                            <User size={13} color={colors.primary.DEFAULT} />
                            <Text style={s.scopeChipText}>{selectedAuthor}</Text>
                            <TouchableOpacity onPress={() => setSelectedAuthor(null)} accessibilityLabel="Clear author filter">
                                <X size={14} color={colors.text.tertiary} />
                            </TouchableOpacity>
                        </View>
                    )}
                    {selectedTags.map((tag) => (
                        <View key={tag} style={s.scopeChip}>
                            <Hash size={13} color={colors.primary.DEFAULT} />
                            <Text style={s.scopeChipText}>{tag}</Text>
                            <TouchableOpacity onPress={() => setSelectedTags((current) => current.filter((currentTag) => currentTag !== tag))} accessibilityLabel={`Clear tag filter ${tag}`}>
                                <X size={14} color={colors.text.tertiary} />
                            </TouchableOpacity>
                        </View>
                    ))}
                </View>
            )}

            {suggestionsLoading && !suggestions ? (
                <View style={s.loading}>
                    <ActivityIndicator size="large" color={colors.primary.DEFAULT} />
                    <Text style={s.loadingText}>Finding smarter matches…</Text>
                </View>
            ) : isLoading ? (
                <View style={s.loading}>
                    <ActivityIndicator size="large" color={colors.primary.DEFAULT} />
                    <Text style={s.loadingText}>Searching through your knowledge…</Text>
                </View>
            ) : (
                <Animated.View style={[s.listContainer, { opacity: fadeAnim }]}>
                    {!query.trim() && !activePreset ? (
                        <ScrollView contentContainerStyle={s.suggestionsScroll} showsVerticalScrollIndicator={false}>
                            <View style={s.suggestionsHero}>
                                <SearchIcon size={44} color={colors.background.tertiary} />
                                <View style={s.emptyContent}>
                                    <Text style={s.emptyTitleLarge}>Deep Search</Text>
                                    <Text style={s.emptyText}>Find any article, video, podcast, feed, folder, or saved search across your library.</Text>
                                </View>
                            </View>

                            <View style={s.suggestionsContainer}>
                                <View style={s.recentHeader}>
                                    <Text style={s.recentTitle}>Recent Searches</Text>
                                    <TouchableOpacity onPress={clearSearchHistory} accessibilityLabel="Clear recent searches">
                                        <Trash2 size={16} color={colors.text.tertiary} />
                                    </TouchableOpacity>
                                </View>
                                {suggestions?.recent_searches?.length ? (
                                    suggestions.recent_searches.map((entry) => (
                                        <TouchableOpacity
                                            key={entry.id}
                                            style={s.recentItem}
                                            onPress={() => handleSuggestionPress('recent', entry.query)}
                                        >
                                            <Clock size={16} color={colors.text.tertiary} />
                                            <Text style={s.recentText}>{entry.query}</Text>
                                            <Text style={s.recentMeta}>{entry.result_count}</Text>
                                        </TouchableOpacity>
                                    ))
                                ) : (
                                    <Text style={s.emptyText}>No recent searches yet.</Text>
                                )}
                            </View>

                            {suggestions?.popular_searches?.length ? (
                                <View style={s.suggestionsContainer}>
                                    <Text style={s.recentTitle}>Popular Searches</Text>
                                    {suggestions.popular_searches.map((item) => (
                                        <TouchableOpacity
                                            key={item.query}
                                            style={s.recentItem}
                                            onPress={() => handleSuggestionPress('popular', item.query)}
                                        >
                                            <Star size={16} color={colors.text.tertiary} />
                                            <Text style={s.recentText}>{item.query}</Text>
                                            <Text style={s.recentMeta}>{item.count}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            ) : null}

                            {suggestions?.saved_searches?.length ? (
                                <View style={s.suggestionsContainer}>
                                    <Text style={s.recentTitle}>Saved Searches</Text>
                                    {suggestions.saved_searches.map((item) => (
                                        <TouchableOpacity
                                            key={item.id}
                                            style={s.recentItem}
                                            onPress={() => handleSuggestionPress('saved', item.name, { savedSearch: item })}
                                        >
                                            <BookOpen size={16} color={colors.text.tertiary} />
                                            <Text style={s.recentText}>{item.name}</Text>
                                            <Text style={s.recentMeta}>{item.use_count}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            ) : null}
                        </ScrollView>
                    ) : (
                        <FlatList
                            testID="search-results"
                            data={results}
                            keyExtractor={(item: SearchResult) => String(item.id)}
                            renderItem={renderResult}
                            contentContainerStyle={s.list}
                            ItemSeparatorComponent={() => <View style={s.separator} />}
                            ListHeaderComponent={
                                <View style={s.suggestionsContainer}>
                                    {activePreset ? (
                                        <View style={s.activePresetBanner}>
                                            <View style={s.activePresetInfo}>
                                                <Text style={s.activePresetLabel}>Preset</Text>
                                                <Text style={s.activePresetTitle} numberOfLines={1}>{activePreset.name}</Text>
                                            </View>
                                            <TouchableOpacity onPress={clearPreset} accessibilityLabel="Clear preset">
                                                <X size={16} color={colors.text.tertiary} />
                                            </TouchableOpacity>
                                        </View>
                                    ) : null}

                                    {suggestions?.feeds?.length ? (
                                        <View style={s.suggestionGroup}>
                                            <Text style={s.recentTitle}>Feeds</Text>
                                            {suggestions.feeds.map((item) => (
                                                <TouchableOpacity
                                                    key={item.id}
                                                    style={s.recentItem}
                                                    onPress={() => handleSuggestionPress('feed', item.title, { feedId: item.id, type: item.type })}
                                                >
                                                    <Newspaper size={16} color={colors.text.tertiary} />
                                                    <Text style={s.recentText}>{item.title}</Text>
                                                    <Text style={s.recentMeta}>{item.type.toUpperCase()}</Text>
                                                </TouchableOpacity>
                                            ))}
                                        </View>
                                    ) : null}

                                    {suggestions?.folders?.length ? (
                                        <View style={s.suggestionGroup}>
                                            <Text style={s.recentTitle}>Folders</Text>
                                            {suggestions.folders.map((item) => (
                                                <TouchableOpacity
                                                    key={item.id}
                                                    style={s.recentItem}
                                                    onPress={() => handleSuggestionPress('folder', item.name, { folderId: item.id })}
                                                >
                                                    <Layers size={16} color={colors.text.tertiary} />
                                                    <Text style={s.recentText}>{item.name}</Text>
                                                </TouchableOpacity>
                                            ))}
                                        </View>
                                    ) : null}

                                    {suggestions?.tags?.length ? (
                                        <View style={s.suggestionGroup}>
                                            <Text style={s.recentTitle}>Tags</Text>
                                            {suggestions.tags.map((tag) => (
                                                <TouchableOpacity
                                                    key={tag}
                                                    style={s.recentItem}
                                                    onPress={() => handleSuggestionPress('tag', tag)}
                                                >
                                                    <Hash size={16} color={colors.text.tertiary} />
                                                    <Text style={s.recentText}>{tag}</Text>
                                                </TouchableOpacity>
                                            ))}
                                        </View>
                                    ) : null}

                                    {suggestions?.authors?.length ? (
                                        <View style={s.suggestionGroup}>
                                            <Text style={s.recentTitle}>Authors</Text>
                                            {suggestions.authors.map((author) => (
                                                <TouchableOpacity
                                                    key={author}
                                                    style={s.recentItem}
                                                    onPress={() => handleSuggestionPress('author', author)}
                                                >
                                                    <User size={16} color={colors.text.tertiary} />
                                                    <Text style={s.recentText}>{author}</Text>
                                                </TouchableOpacity>
                                            ))}
                                        </View>
                                    ) : null}

                                    {suggestions?.saved_searches?.length ? (
                                        <View style={s.suggestionGroup}>
                                            <Text style={s.recentTitle}>Saved Searches</Text>
                                            {suggestions.saved_searches.map((item) => (
                                                <TouchableOpacity
                                                    key={item.id}
                                                    style={s.recentItem}
                                                    onPress={() => handleSuggestionPress('saved', item.name, { savedSearch: item })}
                                                >
                                                    <BookOpen size={16} color={colors.text.tertiary} />
                                                    <Text style={s.recentText}>{item.name}</Text>
                                                    <Text style={s.recentMeta}>{item.use_count}</Text>
                                                </TouchableOpacity>
                                            ))}
                                        </View>
                                    ) : null}

                                    {suggestions?.articles?.length ? (
                                        <View style={s.suggestionGroup}>
                                            <Text style={s.recentTitle}>Article Matches</Text>
                                            {suggestions.articles.map((item) => (
                                                <TouchableOpacity
                                                    key={item.id}
                                                    style={s.recentItem}
                                                    onPress={() => handleResultPress(item.id)}
                                                >
                                                    <SearchIcon size={16} color={colors.text.tertiary} />
                                                    <Text style={s.recentText} numberOfLines={1}>{item.title}</Text>
                                                </TouchableOpacity>
                                            ))}
                                        </View>
                                    ) : null}
                                </View>
                            }
                            ListEmptyComponent={
                                hasSearched ? (
                                    <View style={s.empty}>
                                        <View style={s.emptyIconCircle}>
                                            <Filter size={32} color={colors.text.tertiary} />
                                        </View>
                                        <Text style={s.emptyTitle}>No matches found</Text>
                                        <Text style={s.emptyText}>Try adjusting your filters or search term</Text>
                                    </View>
                                ) : null
                            }
                        />
                    )}
                </Animated.View>
            )}

            <Modal
                visible={isSavePresetOpen}
                transparent
                animationType="fade"
                onRequestClose={() => setIsSavePresetOpen(false)}
            >
                <TouchableOpacity
                    style={s.modalOverlay}
                    activeOpacity={1}
                    onPress={() => setIsSavePresetOpen(false)}
                >
                    <View style={s.modalCard}>
                        <Text style={s.modalTitle}>Save preset</Text>
                        <Text style={s.modalDescription}>
                            Save the current query and filters so you can reuse them later.
                        </Text>
                        <TextInput
                            value={presetName}
                            onChangeText={setPresetName}
                            placeholder="Preset name"
                            placeholderTextColor={colors.text.tertiary}
                            style={s.modalInput}
                            autoFocus
                        />
                        <View style={s.modalActions}>
                            <TouchableOpacity
                                style={s.modalSecondaryButton}
                                onPress={() => setIsSavePresetOpen(false)}
                            >
                                <Text style={s.modalSecondaryButtonText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={s.modalPrimaryButton}
                                onPress={() => void handleSavePreset()}
                            >
                                <Text style={s.modalPrimaryButtonText}>Save</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </TouchableOpacity>
            </Modal>
        </View>
    );
}

const styles = (colors: any) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background.primary,
    },
    searchControls: {
        backgroundColor: colors.background.primary,
        ...Platform.select({
            web: {
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)',
            },
        }),
    },
    searchInputContainer: {
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
        backgroundColor: colors.background.primary,
        borderTopWidth: 1,
        borderTopColor: colors.border.DEFAULT,
        borderBottomWidth: 1,
        borderBottomColor: colors.border.DEFAULT,
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
    presetSection: {
        gap: spacing.sm,
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.sm,
    },
    presetHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: spacing.md,
    },
    presetScroll: {
        gap: spacing.sm,
        paddingBottom: spacing.xs,
    },
    presetChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
        borderRadius: borderRadius.full,
        backgroundColor: colors.background.secondary,
        borderWidth: 1,
        borderColor: colors.border.DEFAULT,
        maxWidth: 220,
    },
    presetChipActive: {
        backgroundColor: colors.primary.DEFAULT,
        borderColor: colors.primary.DEFAULT,
    },
    presetChipText: {
        fontSize: 12,
        fontWeight: '700',
        color: colors.text.secondary,
        maxWidth: 180,
    },
    presetChipTextActive: {
        color: colors.text.inverse,
    },
    savePresetButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
        borderRadius: borderRadius.full,
        backgroundColor: colors.background.secondary,
        borderWidth: 1,
        borderColor: colors.primary.DEFAULT,
    },
    savePresetButtonText: {
        fontSize: 12,
        fontWeight: '700',
        color: colors.primary.DEFAULT,
    },
    activePresetBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: spacing.sm,
        padding: spacing.md,
        borderRadius: borderRadius.lg,
        backgroundColor: colors.primary.soft || `${colors.primary.DEFAULT}15`,
        borderWidth: 1,
        borderColor: colors.primary.DEFAULT,
    },
    activePresetInfo: {
        flex: 1,
        gap: 2,
    },
    activePresetLabel: {
        fontSize: 11,
        fontWeight: '800',
        color: colors.primary.DEFAULT,
        textTransform: 'uppercase',
        letterSpacing: 0.8,
    },
    activePresetTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: colors.text.primary,
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
    suggestionsScroll: {
        padding: spacing.lg,
        gap: spacing.xl,
        maxWidth: 800,
        alignSelf: 'center',
        width: '100%',
        paddingBottom: spacing.xxl,
    },
    suggestionsContainer: {
        gap: spacing.lg,
        width: '100%',
        backgroundColor: colors.background.primary,
        borderRadius: borderRadius.xl,
        borderWidth: 1,
        borderColor: colors.border.DEFAULT,
        padding: spacing.lg,
        ...Platform.select({
            web: {
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.04)',
            },
        }),
    },
    suggestionGroup: {
        gap: spacing.sm,
    },
    suggestionGroupTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: spacing.xs,
    },
    result: {
        backgroundColor: colors.background.primary,
        borderRadius: borderRadius.xl,
        padding: spacing.lg,
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
        marginBottom: spacing.xs,
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
        fontSize: 17,
        fontWeight: '800',
        color: colors.text.primary,
        lineHeight: 23,
        marginBottom: spacing.xs,
        letterSpacing: -0.3,
    },
    snippet: {
        fontSize: 14,
        color: colors.text.secondary,
        lineHeight: 19,
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
        marginBottom: spacing.md,
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
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.md,
        marginBottom: spacing.sm,
        borderRadius: borderRadius.lg,
        backgroundColor: colors.background.secondary,
        borderWidth: 1,
        borderColor: colors.border.DEFAULT,
    },
    recentText: {
        flex: 1,
        fontSize: 15,
        color: colors.text.primary,
        fontWeight: '600',
    },
    recentMeta: {
        fontSize: 12,
        color: colors.text.tertiary,
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 0.6,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.55)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: spacing.xl,
    },
    modalCard: {
        width: '100%',
        maxWidth: 420,
        backgroundColor: colors.background.primary,
        borderRadius: borderRadius.xl,
        padding: spacing.xl,
        gap: spacing.md,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '800',
        color: colors.text.primary,
    },
    modalDescription: {
        fontSize: 14,
        color: colors.text.secondary,
        lineHeight: 20,
    },
    modalInput: {
        borderWidth: 1,
        borderColor: colors.border.DEFAULT,
        backgroundColor: colors.background.secondary,
        borderRadius: borderRadius.lg,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.md,
        color: colors.text.primary,
        fontSize: 15,
        fontWeight: '600',
    },
    modalActions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: spacing.sm,
        marginTop: spacing.xs,
    },
    modalSecondaryButton: {
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.lg,
        borderRadius: borderRadius.full,
        backgroundColor: colors.background.secondary,
    },
    modalSecondaryButtonText: {
        color: colors.text.primary,
        fontWeight: '700',
    },
    modalPrimaryButton: {
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.lg,
        borderRadius: borderRadius.full,
        backgroundColor: colors.primary.DEFAULT,
    },
    modalPrimaryButtonText: {
        color: colors.text.inverse,
        fontWeight: '800',
    },
    scopeRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.sm,
        paddingHorizontal: spacing.lg,
        paddingBottom: spacing.sm,
    },
    scopeChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
        borderRadius: borderRadius.full,
        backgroundColor: colors.background.secondary,
        borderWidth: 1,
        borderColor: colors.border.DEFAULT,
    },
    clearFiltersButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
        borderRadius: borderRadius.full,
        backgroundColor: colors.background.secondary,
        borderWidth: 1,
        borderColor: colors.border.DEFAULT,
    },
    clearFiltersText: {
        fontSize: 12,
        fontWeight: '700',
        color: colors.text.tertiary,
    },
    scopeChipText: {
        fontSize: 12,
        fontWeight: '700',
        color: colors.text.primary,
    },
    empty: {
        alignItems: 'center',
        paddingVertical: 72,
        paddingHorizontal: spacing.xxl,
        backgroundColor: colors.background.primary,
        borderWidth: 1,
        borderColor: colors.border.DEFAULT,
        borderRadius: borderRadius.xl,
        width: '100%',
    },
    suggestionsHero: {
        alignItems: 'center',
        paddingVertical: spacing.xl,
        gap: spacing.md,
    },
    emptyContent: {
        alignItems: 'center',
        marginTop: spacing.lg,
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
        fontSize: 30,
        fontWeight: '900',
        color: colors.text.primary,
        marginBottom: spacing.md,
        letterSpacing: -1,
    },
    emptyText: {
        fontSize: 14,
        color: colors.text.tertiary,
        textAlign: 'center',
        lineHeight: 22,
        fontWeight: '500',
        maxWidth: 320,
    },
});
