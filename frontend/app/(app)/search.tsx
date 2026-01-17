import { useState, useCallback } from 'react';
import { View, Text, TextInput, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { formatDistanceToNow } from 'date-fns';
import { api, SearchResult } from '@/services/api';
import { Search as SearchIcon, ArrowLeft, X } from 'lucide-react-native';

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
                    <ArrowLeft size={24} color="#fafafa" />
                </TouchableOpacity>

                <View style={styles.searchInputContainer}>
                    <SearchIcon size={18} color="#71717a" />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search articles..."
                        placeholderTextColor="#71717a"
                        value={query}
                        onChangeText={setQuery}
                        onSubmitEditing={handleSearch}
                        returnKeyType="search"
                        autoFocus
                    />
                    {query.length > 0 && (
                        <TouchableOpacity onPress={() => setQuery('')}>
                            <X size={18} color="#71717a" />
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            {/* Results */}
            {isLoading ? (
                <View style={styles.loading}>
                    <ActivityIndicator size="large" color="#a3e635" />
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
        backgroundColor: '#18181b',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        gap: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#27272a',
    },
    backButton: {
        padding: 8,
        marginLeft: -8,
    },
    searchInputContainer: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#27272a',
        borderRadius: 10,
        paddingHorizontal: 12,
        gap: 8,
    },
    searchInput: {
        flex: 1,
        padding: 12,
        fontSize: 16,
        color: '#fafafa',
    },
    loading: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    list: {
        padding: 16,
    },
    result: {
        backgroundColor: '#27272a',
        borderRadius: 12,
        padding: 16,
    },
    feedTitle: {
        fontSize: 12,
        color: '#a3e635',
        fontWeight: '500',
        marginBottom: 6,
    },
    resultTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#fafafa',
        lineHeight: 22,
        marginBottom: 6,
    },
    snippet: {
        fontSize: 14,
        color: '#a1a1aa',
        lineHeight: 20,
        marginBottom: 8,
    },
    timestamp: {
        fontSize: 12,
        color: '#52525b',
    },
    separator: {
        height: 12,
    },
    empty: {
        alignItems: 'center',
        paddingVertical: 48,
    },
    emptyText: {
        fontSize: 16,
        color: '#71717a',
    },
});
