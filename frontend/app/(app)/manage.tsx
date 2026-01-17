import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useFeedStore } from '@/stores';
import { api, DiscoveredFeed } from '@/services/api';
import { ArrowLeft, Plus, Search, Rss, Youtube, Headphones, MessageSquare, Folder, Trash2 } from 'lucide-react-native';
import { colors, borderRadius, spacing } from '@/theme';

export default function ManageScreen() {
    const router = useRouter();
    const { feeds, folders, addFeed, deleteFeed, fetchFolders } = useFeedStore();

    const [urlInput, setUrlInput] = useState('');
    const [isDiscovering, setIsDiscovering] = useState(false);
    const [discoveries, setDiscoveries] = useState<DiscoveredFeed[]>([]);
    const [isAdding, setIsAdding] = useState(false);
    const [newFolderName, setNewFolderName] = useState('');

    const handleDiscover = async () => {
        if (!urlInput.trim()) return;

        setIsDiscovering(true);
        setDiscoveries([]);

        try {
            const result = await api.discoverFromUrl(urlInput);
            if (result.discoveries.length > 0) {
                setDiscoveries(result.discoveries);
            } else {
                // No discoveries, try adding directly
                setDiscoveries([{
                    type: 'rss',
                    title: 'Direct Feed',
                    feed_url: urlInput,
                    confidence: 1,
                    method: 'direct',
                }]);
            }
        } catch (err) {
            Alert.alert('Error', 'Could not discover feeds from this URL');
        } finally {
            setIsDiscovering(false);
        }
    };

    const handleAddFeed = async (discovery: DiscoveredFeed) => {
        setIsAdding(true);
        try {
            await addFeed(discovery.feed_url);
            setDiscoveries([]);
            setUrlInput('');
            Alert.alert('Success', `Added "${discovery.title}"`);
        } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to add feed';
            Alert.alert('Error', errorMessage);
        } finally {
            setIsAdding(false);
        }
    };

    const handleDeleteFeed = async (feedId: number, feedTitle: string) => {
        Alert.alert(
            'Delete Feed',
            `Are you sure you want to delete "${feedTitle}"?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await deleteFeed(feedId);
                        } catch (err) {
                            Alert.alert('Error', 'Failed to delete feed');
                        }
                    }
                },
            ]
        );
    };

    const handleCreateFolder = async () => {
        if (!newFolderName.trim()) return;

        try {
            await api.createFolder(newFolderName);
            setNewFolderName('');
            fetchFolders();
        } catch (err) {
            Alert.alert('Error', 'Failed to create folder');
        }
    };

    const getTypeIcon = (type: string) => {
        switch (type) {
            case 'youtube': return <Youtube size={18} color="#ef4444" />;
            case 'podcast': return <Headphones size={18} color={colors.secondary.DEFAULT} />;
            case 'reddit': return <MessageSquare size={18} color="#f97316" />;
            default: return <Rss size={18} color={colors.primary.DEFAULT} />;
        }
    };

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <ArrowLeft size={24} color={colors.text.primary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Manage Feeds</Text>
            </View>

            <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
                {/* Add Feed */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Add Feed</Text>
                    <View style={styles.inputRow}>
                        <TextInput
                            style={styles.input}
                            placeholder="Enter feed URL or website..."
                            placeholderTextColor={colors.text.tertiary}
                            value={urlInput}
                            onChangeText={setUrlInput}
                            autoCapitalize="none"
                            autoCorrect={false}
                            keyboardType="url"
                        />
                        <TouchableOpacity
                            style={styles.discoverButton}
                            onPress={handleDiscover}
                            disabled={isDiscovering}
                        >
                            {isDiscovering ? (
                                <ActivityIndicator size="small" color={colors.text.inverse} />
                            ) : (
                                <Search size={20} color={colors.text.inverse} />
                            )}
                        </TouchableOpacity>
                    </View>

                    {/* Discovery Results */}
                    {discoveries.length > 0 && (
                        <View style={styles.discoveries}>
                            <Text style={styles.discoveriesTitle}>Discovered Feeds:</Text>
                            {discoveries.map((d, i) => (
                                <TouchableOpacity
                                    key={i}
                                    style={styles.discoveryItem}
                                    onPress={() => handleAddFeed(d)}
                                    disabled={isAdding}
                                >
                                    {getTypeIcon(d.type)}
                                    <View style={styles.discoveryInfo}>
                                        <Text style={styles.discoveryTitle}>{d.title}</Text>
                                        <Text style={styles.discoveryUrl} numberOfLines={1}>{d.feed_url}</Text>
                                    </View>
                                    <Plus size={20} color={colors.primary.DEFAULT} />
                                </TouchableOpacity>
                            ))}
                        </View>
                    )}
                </View>

                {/* Create Folder */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Create Folder</Text>
                    <View style={styles.inputRow}>
                        <TextInput
                            style={styles.input}
                            placeholder="Folder name..."
                            placeholderTextColor={colors.text.tertiary}
                            value={newFolderName}
                            onChangeText={setNewFolderName}
                        />
                        <TouchableOpacity
                            style={[styles.discoverButton, { backgroundColor: colors.secondary.DEFAULT }]}
                            onPress={handleCreateFolder}
                        >
                            <Folder size={20} color={colors.text.inverse} />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Existing Feeds */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Your Feeds ({feeds.length})</Text>
                    {feeds.map((feed) => (
                        <View key={feed.id} style={styles.feedItem}>
                            {getTypeIcon(feed.type)}
                            <View style={styles.feedInfo}>
                                <Text style={styles.feedTitle} numberOfLines={1}>{feed.title}</Text>
                                <Text style={styles.feedUrl} numberOfLines={1}>{feed.url}</Text>
                            </View>
                            <TouchableOpacity
                                onPress={() => handleDeleteFeed(feed.id, feed.title)}
                                style={styles.deleteButton}
                            >
                                <Trash2 size={18} color={colors.text.tertiary} />
                            </TouchableOpacity>
                        </View>
                    ))}
                </View>
            </ScrollView>
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
    headerTitle: {
        fontSize: 20,
        fontWeight: '600',
        color: colors.text.primary,
    },
    scrollView: {
        flex: 1,
    },
    content: {
        padding: spacing.lg,
    },
    section: {
        marginBottom: spacing.xxl,
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.text.secondary,
        marginBottom: spacing.md,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    inputRow: {
        flexDirection: 'row',
        gap: spacing.sm,
    },
    input: {
        flex: 1,
        backgroundColor: colors.background.secondary,
        borderRadius: borderRadius.md,
        padding: spacing.lg,
        fontSize: 16,
        color: colors.text.primary,
        borderWidth: 1,
        borderColor: colors.border.DEFAULT,
    },
    discoverButton: {
        backgroundColor: colors.primary.DEFAULT,
        borderRadius: borderRadius.md,
        padding: spacing.lg,
        alignItems: 'center',
        justifyContent: 'center',
    },
    discoveries: {
        marginTop: spacing.lg,
    },
    discoveriesTitle: {
        fontSize: 13,
        color: colors.text.tertiary,
        marginBottom: spacing.sm,
    },
    discoveryItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.background.secondary,
        borderRadius: borderRadius.md,
        padding: spacing.md,
        gap: spacing.md,
        marginBottom: spacing.sm,
    },
    discoveryInfo: {
        flex: 1,
    },
    discoveryTitle: {
        fontSize: 15,
        fontWeight: '500',
        color: colors.text.primary,
    },
    discoveryUrl: {
        fontSize: 12,
        color: colors.text.tertiary,
        marginTop: 2,
    },
    feedItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.background.secondary,
        borderRadius: borderRadius.md,
        padding: spacing.md,
        gap: spacing.md,
        marginBottom: spacing.sm,
    },
    feedInfo: {
        flex: 1,
    },
    feedTitle: {
        fontSize: 15,
        fontWeight: '500',
        color: colors.text.primary,
    },
    feedUrl: {
        fontSize: 12,
        color: colors.text.tertiary,
        marginTop: 2,
    },
    deleteButton: {
        padding: spacing.sm,
    },
});
