import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useFeedStore } from '@/stores';
import { api, DiscoveredFeed } from '@/services/api';
import { ArrowLeft, Plus, Search, Rss, Youtube, Headphones, MessageSquare, Folder, Trash2 } from 'lucide-react-native';

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
        } catch (err: any) {
            Alert.alert('Error', err.message || 'Failed to add feed');
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
            case 'podcast': return <Headphones size={18} color="#a855f7" />;
            case 'reddit': return <MessageSquare size={18} color="#f97316" />;
            default: return <Rss size={18} color="#a3e635" />;
        }
    };

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <ArrowLeft size={24} color="#fafafa" />
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
                            placeholderTextColor="#71717a"
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
                                <ActivityIndicator size="small" color="#18181b" />
                            ) : (
                                <Search size={20} color="#18181b" />
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
                                    <Plus size={20} color="#a3e635" />
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
                            placeholderTextColor="#71717a"
                            value={newFolderName}
                            onChangeText={setNewFolderName}
                        />
                        <TouchableOpacity
                            style={styles.discoverButton}
                            onPress={handleCreateFolder}
                        >
                            <Folder size={20} color="#18181b" />
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
                                <Trash2 size={18} color="#71717a" />
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
    headerTitle: {
        fontSize: 20,
        fontWeight: '600',
        color: '#fafafa',
    },
    scrollView: {
        flex: 1,
    },
    content: {
        padding: 16,
    },
    section: {
        marginBottom: 32,
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#a1a1aa',
        marginBottom: 12,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    inputRow: {
        flexDirection: 'row',
        gap: 8,
    },
    input: {
        flex: 1,
        backgroundColor: '#27272a',
        borderRadius: 10,
        padding: 14,
        fontSize: 16,
        color: '#fafafa',
        borderWidth: 1,
        borderColor: '#3f3f46',
    },
    discoverButton: {
        backgroundColor: '#a3e635',
        borderRadius: 10,
        padding: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    discoveries: {
        marginTop: 16,
    },
    discoveriesTitle: {
        fontSize: 13,
        color: '#71717a',
        marginBottom: 8,
    },
    discoveryItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#27272a',
        borderRadius: 10,
        padding: 12,
        gap: 12,
        marginBottom: 8,
    },
    discoveryInfo: {
        flex: 1,
    },
    discoveryTitle: {
        fontSize: 15,
        fontWeight: '500',
        color: '#fafafa',
    },
    discoveryUrl: {
        fontSize: 12,
        color: '#71717a',
        marginTop: 2,
    },
    feedItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#27272a',
        borderRadius: 10,
        padding: 12,
        gap: 12,
        marginBottom: 8,
    },
    feedInfo: {
        flex: 1,
    },
    feedTitle: {
        fontSize: 15,
        fontWeight: '500',
        color: '#fafafa',
    },
    feedUrl: {
        fontSize: 12,
        color: '#71717a',
        marginTop: 2,
    },
    deleteButton: {
        padding: 8,
    },
});
