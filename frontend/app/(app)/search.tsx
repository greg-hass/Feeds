import { useState, useCallback } from 'react';
import { View, Text, TextInput, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { formatDistanceToNow } from 'date-fns';
import { api, SearchResult } from '@/services/api';
import { Search as SearchIcon, ArrowLeft, X } from 'lucide-react-native';
import { colors, borderRadius, spacing } from '@/theme';

export default function SearchScreen() {
    const router = useRouter();
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<SearchResult[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [hasSearched, setHasSearched] = useState(false);

    const handleSearch = useCallback(async () => {
        if (!query.trim()) return;

        setIsLoading(true);
        setHasSearched(true);

        try {
            const response = await api.search(query);
            setResults(response.results);
        } catch (err) {
            console.error('Search failed:', err);
            setResults([]);
        } finally {
            setIsLoading(false);
        }
    }, [query]);

    const handleResultPress = (id: number) => {
        router.push(`/(app)/article/${id}`);
    };

    const renderResult = ({ item }: { item: SearchResult }) => (
        <TouchableOpacity
            style={styles.result}
            onPress={() => handleResultPress(item.id)}
        >
            <Text style={styles.feedTitle}>{item.feed_title}</Text>
            <Text style={styles.resultTitle} numberOfLines={2}>{item.title}</Text>
            <Text
                style={styles.snippet}
                numberOfLines={2}
            >
                {item.snippet.replace(/<\/?mark>/g, '')}
            </Text>
            {item.published_at && (
                <Text style={styles.timestamp}>
                    {formatDistanceToNow(new Date(item.published_at), { addSuffix: true })}
                </Text>
            )}
        </TouchableOpacity>
    );

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <ArrowLeft size={24} color={colors.text.primary} />
                </TouchableOpacity>

                <View style={styles.searchInputContainer}>
                    <SearchIcon size={18} color={colors.text.tertiary} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search articles..."
                        placeholderTextColor={colors.text.tertiary}
                        value={query}
                        onChangeText={setQuery}
                        onSubmitEditing={handleSearch}
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

            {/* Results */}
            {isLoading ? (
                <View style={styles.loading}>
                    <ActivityIndicator size="large" color={colors.primary.DEFAULT} />
                </View>
            ) : (
                <FlatList
                    data={results}
                    keyExtractor={(item) => String(item.id)}
                    renderItem={renderResult}
                    contentContainerStyle={styles.list}
                    ItemSeparatorComponent={() => <View style={styles.separator} />}
                    ListEmptyComponent={
                        hasSearched ? (
                            <View style={styles.empty}>
                                <Text style={styles.emptyText}>No results found for "{query}"</Text>
                            </View>
                        ) : (
                            <View style={styles.empty}>
                                <Text style={styles.emptyText}>Enter a search term</Text>
                            </View>
                        )
                    }
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background.primary,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: spacing.lg,
        gap: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.border.DEFAULT,
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
        borderRadius: borderRadius.md,
        paddingHorizontal: spacing.md,
        gap: spacing.sm,
    },
    searchInput: {
        flex: 1,
        padding: spacing.md,
        fontSize: 16,
        color: colors.text.primary,
    },
    loading: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    list: {
        padding: spacing.lg,
    },
    result: {
        backgroundColor: colors.background.secondary,
        borderRadius: borderRadius.lg,
        padding: spacing.lg,
    },
    feedTitle: {
        fontSize: 12,
        color: colors.secondary.DEFAULT,
        fontWeight: '500',
        marginBottom: spacing.sm,
    },
    resultTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.text.primary,
        lineHeight: 22,
        marginBottom: spacing.sm,
    },
    snippet: {
        fontSize: 14,
        color: colors.text.secondary,
        lineHeight: 20,
        marginBottom: spacing.sm,
    },
    timestamp: {
        fontSize: 12,
        color: colors.text.tertiary,
    },
    separator: {
        height: spacing.md,
    },
    empty: {
        alignItems: 'center',
        paddingVertical: 48,
    },
    emptyText: {
        fontSize: 16,
        color: colors.text.tertiary,
    },
});
