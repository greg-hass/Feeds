import * as DocumentPicker from 'expo-document-picker';
import { useMemo, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Alert, Modal, Image, Platform, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { useFeedStore, useToastStore, useArticleStore, useSettingsStore } from '@/stores';
import { api, DiscoveredFeed, Feed, Folder } from '@/services/api';
import {
    ArrowLeft, Plus, Search, Rss, Youtube, Headphones, MessageSquare,
    Folder as FolderIcon, Trash2, Edit2, FolderInput,
    Check, FileUp, FileDown, AlertTriangle, RefreshCw, RefreshCcw,
    Info, Pause
} from 'lucide-react-native';
import { FeedInfoSheet } from '@/components/FeedInfoSheet';
import { useColors, borderRadius, spacing } from '@/theme';
import { ProgressDialog, ProgressState } from '@/components/ProgressDialog';
import { useProgressHandler } from '@/hooks/useProgressHandler';

type ModalType = 'edit_feed' | 'rename_folder' | 'move_feed' | null;

type DiscoveryType = 'all' | 'rss' | 'youtube' | 'reddit' | 'podcast';

const discoveryTypes: DiscoveryType[] = ['all', 'rss', 'youtube', 'reddit', 'podcast'];

export default function ManageScreen() {
    const router = useRouter();
    const colors = useColors();
    const { width } = useWindowDimensions();
    const { feeds, folders, addFeed, deleteFeed, deleteFolder, fetchFeeds, fetchFolders } = useFeedStore();
    const { setFilter } = useArticleStore();
    const { show } = useToastStore();
    const { settings } = useSettingsStore();

    const [urlInput, setUrlInput] = useState('');
    const [discoveryType, setDiscoveryType] = useState<DiscoveryType>('all');
    const [isDiscovering, setIsDiscovering] = useState(false);
    const [discoveries, setDiscoveries] = useState<DiscoveredFeed[]>([]);
    const [isAdding, setIsAdding] = useState(false);
    const [newFolderName, setNewFolderName] = useState('');

    // Modal states
    const [modalType, setModalType] = useState<ModalType>(null);
    const [selectedFeed, setSelectedFeed] = useState<Feed | null>(null);
    const [selectedFolder, setSelectedFolder] = useState<Folder | null>(null);
    const [renameValue, setRenameValue] = useState('');
    const [selectedFolderId, setSelectedFolderId] = useState<number | null>(null);
    const isDesktop = Platform.OS === 'web' && width >= 1024;

    const [isExporting, setIsExporting] = useState(false);

    // Bulk actions
    const [isBulkMode, setIsBulkMode] = useState(false);

    // Progress dialog state
    const [progressState, setProgressState] = useState<ProgressState>({
        isActive: false,
        operation: 'import',
        items: [],
        current: null,
        total: 0,
        stats: { success: 0, skipped: 0, errors: 0 },
        complete: false,
        failedFeeds: [],
    });
    const [selectedFeedIds, setSelectedFeedIds] = useState<Set<number>>(new Set());

    // Feed Info Sheet state
    const [feedInfoId, setFeedInfoId] = useState<number | null>(null);
    const [feedInfoVisible, setFeedInfoVisible] = useState(false);

    const handleProgressEvent = useProgressHandler(setProgressState, {
        onFolderCreated: fetchFolders,
        onFeedCreated: () => {
            fetchFeeds();
            fetchFolders();
        },
        onFeedComplete: fetchFeeds,
    });

    const s = styles(colors);
    const folderNameById = useMemo(() => {
        const entries = folders.map((folder) => [folder.id, folder.name] as const);
        return new Map(entries);
    }, [folders]);
    const feedCountByFolderId = useMemo(() => {
        const counts = new Map<number, number>();
        feeds.forEach((feed) => {
            if (!feed.folder_id) return;
            counts.set(feed.folder_id, (counts.get(feed.folder_id) ?? 0) + 1);
        });
        return counts;
    }, [feeds]);
    const discoveryPlaceholder = discoveryType === 'all' ? 'feeds' : discoveryType;

    const handleDiscover = async () => {
        if (!urlInput.trim()) return;

        setIsDiscovering(true);
        setDiscoveries([]);

        try {
            // Pass type if not 'all'
            const typeParam = discoveryType === 'all' ? undefined : discoveryType;
            // @ts-ignore - api.discover will be updated to accept params object or optional arg
            const result = await api.discover(urlInput, typeParam);
            if (result.discoveries.length > 0) {
                setDiscoveries(result.discoveries);
            } else {
                show('No feeds found', 'info');
            }
        } catch (err) {
            show('Discovery failed', 'error');
        } finally {
            setIsDiscovering(false);
        }
    };

    const handleAddFeed = async (discovery: DiscoveredFeed) => {
        setIsAdding(true);
        try {
            await addFeed(discovery.feed_url, undefined, settings?.refresh_interval_minutes);
            setDiscoveries([]);
            setUrlInput('');
            show(`Added "${discovery.title}"`, 'success');
        } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to add feed';
            show(errorMessage, 'error');
        } finally {
            setIsAdding(false);
        }
    };

    const handleDeleteFeed = (feedId: number, feedTitle: string) => {
        if (Platform.OS === 'web') {
            if (window.confirm(`Delete "${feedTitle}" and all its articles?`)) {
                deleteFeed(feedId)
                    .then(() => show('Feed deleted', 'success'))
                    .catch((err) => {
                        console.error('Delete error:', err);
                        const errorMsg = err?.message || err?.toString() || 'Unknown error';
                        const statusMsg = err?.status ? ` (${err.status})` : '';
                        show(`Delete failed: ${errorMsg}${statusMsg}`, 'error');
                    });
            }
        } else {
            Alert.alert(
                'Delete Feed',
                `Delete "${feedTitle}" and all its articles?`,
                [
                    { text: 'Cancel', style: 'cancel' },
                    {
                        text: 'Delete',
                        style: 'destructive',
                        onPress: async () => {
                            try {
                                await deleteFeed(feedId);
                                show('Feed deleted', 'success');
                            } catch (err: any) {
                                const errorMsg = err?.message || err?.toString() || 'Unknown error';
                                show(`Delete failed: ${errorMsg}`, 'error');
                            }
                        }
                    },
                ]
            );
        }
    };

    const handleEditFeed = (feed: Feed) => {
        setSelectedFeed(feed);
        setRenameValue(feed.title);
        setModalType('edit_feed');
    };

    const handleRenameFolder = (folder: Folder) => {
        setSelectedFolder(folder);
        setRenameValue(folder.name);
        setModalType('rename_folder');
    };

    const handleMoveFeed = (feed: Feed) => {
        setSelectedFeed(feed);
        setSelectedFolderId(feed.folder_id || null);
        setModalType('move_feed');
    };

    const submitRename = async () => {
        if (!renameValue.trim()) return;

        try {
            if (modalType === 'edit_feed' && selectedFeed) {
                await api.updateFeed(selectedFeed.id, {
                    title: renameValue,
                });
            } else if (modalType === 'rename_folder' && selectedFolder) {
                await api.updateFolder(selectedFolder.id, renameValue);
            }
            fetchFeeds();
            fetchFolders();
            setModalType(null);
            show('Changes saved', 'success');
        } catch (err) {
            show('Failed to save changes', 'error');
        }
    };

    const submitMove = async () => {
        if (!selectedFeed && selectedFeedIds.size === 0) return;

        try {
            if (selectedFeed) {
                // Single move
                await api.updateFeed(selectedFeed.id, { folder_id: selectedFolderId });
            } else {
                // Bulk move
                await api.bulkFeedAction('move', Array.from(selectedFeedIds), selectedFolderId ?? null);
                setSelectedFeedIds(new Set());
                setIsBulkMode(false);
            }
            fetchFeeds();
            setModalType(null);
            show('Feeds moved', 'success');
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : 'Failed to move feeds';
            show(errorMsg, 'error');
        }
    };

    const handleCreateFolder = async () => {
        if (!newFolderName.trim()) return;

        try {
            await api.createFolder(newFolderName);
            setNewFolderName('');
            fetchFolders();
            show(`Folder "${newFolderName}" created`, 'success');
        } catch (err) {
            show('Failed to create folder', 'error');
        }
    };

    const handleDeleteFolder = (folderId: number, folderName: string) => {
        if (Platform.OS === 'web') {
            if (window.confirm(`Delete "${folderName}"? Feeds inside will be moved to the root.`)) {
                deleteFolder(folderId)
                    .then(() => show('Folder deleted', 'success'))
                    .catch((err) => {
                        const errorMsg = err?.message || err?.toString() || 'Unknown error';
                        show(`Delete failed: ${errorMsg}`, 'error');
                    });
            }
        } else {
            Alert.alert(
                'Delete Folder',
                `Delete "${folderName}"? Feeds inside will be moved to the root.`,
                [
                    { text: 'Cancel', style: 'cancel' },
                    {
                        text: 'Delete',
                        style: 'destructive',
                        onPress: async () => {
                            try {
                                await deleteFolder(folderId);
                                show('Folder deleted', 'success');
                            } catch (err: any) {
                                const errorMsg = err?.message || err?.toString() || 'Unknown error';
                                show(`Delete failed: ${errorMsg}`, 'error');
                            }
                        }
                    }
                ]
            );
        }
    };

    const handleRetryFeed = async (feedId: number, feedTitle: string) => {
        try {
            const result = await api.refreshFeed(feedId);
            if (result.success) {
                show(`Refreshed "${feedTitle}" - ${result.new_articles} new articles`, 'success');
                fetchFeeds();
            } else {
                show('Failed to refresh feed', 'error');
            }
        } catch (err) {
            show('Failed to refresh feed', 'error');
        }
    };

    const handleExportOpml = async () => {
        setIsExporting(true);
        try {
            const opml = await api.exportOpml();
            // On web, trigger download
            const blob = new Blob([opml], { type: 'text/xml' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'feeds-export.opml';
            a.click();
            URL.revokeObjectURL(url);
            show('OPML exported', 'success');
        } catch (err) {
            show('Failed to export OPML', 'error');
        } finally {
            setIsExporting(false);
        }
    };

    const handleImportOpml = async () => {
        try {
            // Use '*/*' to allow all files - OPML has inconsistent MIME type support across platforms
            // We validate the extension after selection
            const result = await DocumentPicker.getDocumentAsync({
                type: '*/*',
                copyToCacheDirectory: true,
            });

            if (result.canceled) return;

            const file = result.assets[0];

            // Validate file extension
            const fileName = file.name?.toLowerCase() || '';
            if (!fileName.endsWith('.opml') && !fileName.endsWith('.xml')) {
                show('Please select an OPML or XML file', 'error');
                return;
            }

            // Initialize progress state
            setProgressState({
                isActive: true,
                operation: 'import',
                items: [],
                current: null,
                total: 0,
                stats: { success: 0, skipped: 0, errors: 0 },
                complete: false,
                failedFeeds: [],
            });

            // Use SSE for real-time progress
            await api.importOpmlWithProgress(
                file,
                (event: ProgressEvent) => handleProgressEvent(event),
                (error: Error) => {
                    setProgressState(prev => ({
                        ...prev,
                        complete: true,
                        stats: { ...prev.stats, errors: prev.stats.errors + 1 },
                        failedFeeds: [...prev.failedFeeds, { id: 0, title: 'Import', error: error.message }],
                    }));
                }
            );

        } catch (err) {
            console.error(err);
            show('Failed to import OPML', 'error');
            setProgressState(prev => ({ ...prev, isActive: false }));
        }
    };

    const handleRefreshAll = async () => {
        // Initialize progress state for refresh
        setProgressState({
            isActive: true,
            operation: 'refresh',
            items: feeds.map((feed: Feed) => ({
                id: `feed-${feed.id}`,
                type: 'feed' as const,
                title: feed.title,
                folder: feed.folder_id ? folderNameById.get(feed.folder_id) : undefined,
                status: 'pending' as ItemStatus,
            })),
            current: null,
            total: feeds.length,
            stats: { success: 0, skipped: 0, errors: 0 },
            complete: false,
            failedFeeds: [],
        });

        await api.refreshFeedsWithProgress(
            undefined, // Refresh all
            handleProgressEvent,
            (error: Error) => {
                setProgressState(prev => ({
                    ...prev,
                    complete: true,
                    stats: { ...prev.stats, errors: prev.stats.errors + 1 },
                    failedFeeds: [...prev.failedFeeds, { id: 0, title: 'Refresh', error: error.message }],
                }));
            }
        );

        fetchFeeds();
    };

    const handleRetryFailed = async (feedIds: number[]) => {
        // Reset progress for retry
        setProgressState(prev => ({
            ...prev,
            items: prev.failedFeeds.map(f => ({
                id: `feed-${f.id}`,
                type: 'feed' as const,
                title: f.title,
                status: 'pending' as ItemStatus,
            })),
            current: null,
            total: feedIds.length,
            stats: { success: 0, skipped: 0, errors: 0 },
            complete: false,
            failedFeeds: [],
        }));

        await api.refreshFeedsWithProgress(
            feedIds,
            handleProgressEvent,
            (error: Error) => {
                setProgressState(prev => ({
                    ...prev,
                    complete: true,
                    stats: { ...prev.stats, errors: prev.stats.errors + 1 },
                    failedFeeds: [...prev.failedFeeds, { id: 0, title: 'Retry', error: error.message }],
                }));
            }
        );

        fetchFeeds();
    };



    const closeProgressDialog = () => {
        setProgressState(prev => ({ ...prev, isActive: false }));
    };

    const handleSelectAll = () => {
        if (selectedFeedIds.size === feeds.length) {
            setSelectedFeedIds(new Set());
        } else {
            setSelectedFeedIds(new Set(feeds.map((f: Feed) => f.id)));
        }
    };

    const toggleBulkMode = () => {
        setIsBulkMode(!isBulkMode);
        setSelectedFeedIds(new Set());
    };

    const toggleSelectFeed = (id: number) => {
        const next = new Set(selectedFeedIds);
        if (next.has(id)) {
            next.delete(id);
        } else {
            next.add(id);
        }
        setSelectedFeedIds(next);
    };

    const handleBulkDelete = () => {
        if (selectedFeedIds.size === 0) return;

        Alert.alert(
            'Bulk Delete',
            `Delete ${selectedFeedIds.size} selected feeds?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await api.bulkFeedAction('delete', Array.from(selectedFeedIds));
                            fetchFeeds();
                            setIsBulkMode(false);
                            setSelectedFeedIds(new Set());
                            show(`Deleted ${selectedFeedIds.size} feeds`, 'success');
                        } catch (err) {
                            show('Bulk delete failed', 'error');
                        }
                    }
                }
            ]
        );
    };

    const handleBulkMove = () => {
        if (selectedFeedIds.size === 0) return;
        setModalType('move_feed');
        setSelectedFeed(null); // Use null to indicate bulk move
        setSelectedFolderId(null);
    };

    const getTypeIcon = (type: Feed['type']) => {
        switch (type) {
            case 'youtube': return <Youtube size={18} color="#ef4444" />;
            case 'podcast': return <Headphones size={18} color={colors.secondary.DEFAULT} />;
            case 'reddit': return <MessageSquare size={18} color="#f97316" />;
            default: return <Rss size={18} color={colors.primary.DEFAULT} />;
        }
    };

    return (
        <View style={s.container}>
            {/* Header */}
            <View style={s.header}>
                <TouchableOpacity onPress={() => router.back()} style={s.backButton}>
                    <ArrowLeft size={24} color={colors.text.primary} />
                </TouchableOpacity>
                <Text style={s.headerTitle}>Manage Feeds</Text>
                <View style={s.headerActions}>
                    <TouchableOpacity
                        style={[s.headerButton, isBulkMode && { backgroundColor: colors.primary.DEFAULT + '22' }]}
                        onPress={toggleBulkMode}
                    >
                        <Check size={18} color={isBulkMode ? colors.primary.DEFAULT : colors.text.secondary} />
                    </TouchableOpacity>
                </View>
            </View>

            <ScrollView style={s.scrollView} contentContainerStyle={s.content}>
                {/* Add Feed */}
                <View style={s.section}>
                    <Text style={s.sectionTitle}>Add Feed</Text>

                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={s.filterPillsContainer}
                        style={s.filterPillsScroll}
                    >
                        {discoveryTypes.map((type) => (
                            <TouchableOpacity
                                key={type}
                                style={[
                                    s.filterPill,
                                    discoveryType === type && s.filterPillActive,
                                ]}
                                onPress={() => setDiscoveryType(type)}
                            >
                                <Text style={[
                                    s.filterPillText,
                                    discoveryType === type && s.filterPillTextActive
                                ]}>
                                    {type.charAt(0).toUpperCase() + type.slice(1)}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>

                    <View style={s.inputRow}>
                        <TextInput
                            style={s.input}
                            placeholder={`Search ${discoveryPlaceholder}…`}
                            placeholderTextColor={colors.text.tertiary}
                            value={urlInput}
                            onChangeText={setUrlInput}
                            autoCapitalize="none"
                            autoCorrect={false}
                            keyboardType="url"
                            accessibilityLabel={`Search ${discoveryPlaceholder}`}
                        />
                        <TouchableOpacity
                            style={s.primaryButton}
                            onPress={handleDiscover}
                            disabled={isDiscovering}
                            accessibilityLabel="Discover feeds"
                        >
                            {isDiscovering ? (
                                <ActivityIndicator size="small" color={colors.text.inverse} />
                            ) : (
                                <Search size={20} color={colors.text.inverse} />
                            )}
                        </TouchableOpacity>
                    </View>

                    {discoveries.length > 0 && (
                        <View style={s.discoveries}>
                            <Text style={s.discoveriesTitle}>Discovered Feeds:</Text>
                            {discoveries.map((d: DiscoveredFeed, i: number) => (
                                <TouchableOpacity
                                    key={i}
                                    style={s.discoveryItem}
                                    onPress={() => handleAddFeed(d)}
                                    disabled={isAdding}
                                >
                                    {d.icon_url ? (
                                        <Image source={{ uri: d.icon_url }} style={s.feedIcon} />
                                    ) : (
                                        getTypeIcon(d.type)
                                    )}
                                    <View style={s.discoveryInfo}>
                                        <Text style={s.discoveryTitle}>{d.title}</Text>
                                        <Text style={s.discoveryUrl} numberOfLines={1}>{d.feed_url}</Text>
                                    </View>
                                    <Plus size={20} color={colors.primary.DEFAULT} />
                                </TouchableOpacity>
                            ))}
                        </View>
                    )}
                </View>

                {/* Create Folder */}
                <View style={s.section}>
                    <Text style={s.sectionTitle}>Create Folder</Text>
                    <View style={s.inputRow}>
                        <TextInput
                            style={s.input}
                            placeholder="Folder name…"
                            placeholderTextColor={colors.text.tertiary}
                            value={newFolderName}
                            onChangeText={setNewFolderName}
                            accessibilityLabel="Folder name"
                        />
                        <TouchableOpacity
                            style={[s.primaryButton, { backgroundColor: colors.secondary.DEFAULT }]}
                            onPress={handleCreateFolder}
                            accessibilityLabel="Create folder"
                        >
                            <FolderIcon size={20} color={colors.text.inverse} />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Folders */}
                {folders.length > 0 && (
                    <View style={s.section}>
                        <Text style={s.sectionTitle}>Folders ({folders.length})</Text>
                        {folders.map((folder: Folder) => (
                            <View key={folder.id} style={s.feedItem}>
                                <View style={s.folderContent}>
                                    <FolderIcon size={18} color={colors.secondary.DEFAULT} />
                                    <View style={s.feedInfo}>
                                        <Text style={s.feedTitle}>{folder.name}</Text>
                                        <Text style={s.feedUrl}>
                                            {feedCountByFolderId.get(folder.id) ?? 0} feeds
                                        </Text>
                                    </View>
                                </View>
                                <TouchableOpacity
                                    onPress={() => handleRenameFolder(folder)}
                                    style={s.actionButton}
                                    accessibilityLabel={`Rename folder ${folder.name}`}
                                >
                                    <Edit2 size={16} color={colors.text.tertiary} />
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={() => handleDeleteFolder(folder.id, folder.name)}
                                    style={s.actionButton}
                                    accessibilityLabel={`Delete folder ${folder.name}`}
                                >
                                    <Trash2 size={16} color={colors.text.tertiary} />
                                </TouchableOpacity>
                            </View>
                        ))}
                    </View>
                )}

                {/* Feeds */}
                <View style={s.section}>
                    <Text style={s.sectionTitle}>Feeds ({feeds.length})</Text>
                    {feeds.map((feed: Feed) => (
                        <View
                            key={feed.id}
                            style={[
                                s.feedItem,
                                feed.error_count > 0 && s.feedItemError,
                                feed.paused_at && s.feedItemPaused,
                                isBulkMode && selectedFeedIds.has(feed.id) && { backgroundColor: colors.primary.DEFAULT + '11', borderColor: colors.primary.DEFAULT + '44' }
                            ]}
                        >
                            <TouchableOpacity
                                style={s.feedContentClickable}
                                onPress={() => {
                                    if (isBulkMode) {
                                        toggleSelectFeed(feed.id);
                                    } else {
                                        setFilter({ feed_id: feed.id, type: undefined, folder_id: undefined });
                                        router.push('/(app)');
                                    }
                                }}
                                onLongPress={() => {
                                    if (!isBulkMode) {
                                        setFeedInfoId(feed.id);
                                        setFeedInfoVisible(true);
                                    }
                                }}
                                activeOpacity={0.7}
                            >
                                {isBulkMode ? (
                                    <View style={[
                                        s.checkbox,
                                        selectedFeedIds.has(feed.id) && s.checkboxSelected
                                    ]}>
                                        {selectedFeedIds.has(feed.id) && <Check size={12} color={colors.text.inverse} />}
                                    </View>
                                ) : (
                                    <View style={s.feedIconContainer}>
                                        {feed.icon_url ? (
                                            <Image source={{ uri: feed.icon_url }} style={[s.feedIcon, feed.paused_at && s.feedIconPaused]} />
                                        ) : (
                                            getTypeIcon(feed.type)
                                        )}
                                        {feed.paused_at && (
                                            <View style={s.pausedOverlay}>
                                                <Pause size={10} color={colors.text.inverse} />
                                            </View>
                                        )}
                                    </View>
                                )}

                                <View style={s.feedInfo}>
                                    <View style={s.feedTitleRow}>
                                        <Text style={[s.feedTitle, feed.paused_at && s.feedTitlePaused]} numberOfLines={1}>{feed.title}</Text>
                                        {feed.paused_at && (
                                            <Pause size={14} color={colors.warning} style={s.statusIcon} />
                                        )}
                                        {feed.error_count > 0 && !feed.paused_at && (
                                            <AlertTriangle size={14} color={colors.error} style={s.statusIcon} />
                                        )}
                                    </View>
                                    <Text style={s.feedUrl} numberOfLines={1}>
                                        {feed.folder_id ? folderNameById.get(feed.folder_id) || 'No folder' : 'No folder'}
                                    </Text>
                                    {feed.paused_at && (
                                        <View style={s.pausedBadge}>
                                            <Pause size={10} color={colors.warning} />
                                            <Text style={s.pausedBadgeText}>Paused</Text>
                                        </View>
                                    )}
                                    {feed.error_count > 0 && !feed.paused_at && (
                                        <View style={s.errorBadge}>
                                            <AlertTriangle size={10} color={colors.error} />
                                            <Text style={s.errorBadgeText}>Connection Issue</Text>
                                        </View>
                                    )}
                                </View>
                            </TouchableOpacity>

                            {!isBulkMode && (
                                <View style={s.feedActions}>
                                    <TouchableOpacity
                                        onPress={() => {
                                            setFeedInfoId(feed.id);
                                            setFeedInfoVisible(true);
                                        }}
                                        style={s.actionButton}
                                        accessibilityLabel={`View details for ${feed.title}`}
                                    >
                                        <Info size={16} color={colors.text.tertiary} />
                                    </TouchableOpacity>
                                    {feed.error_count > 0 ? (
                                        <TouchableOpacity
                                            onPress={() => handleRetryFeed(feed.id, feed.title)}
                                            style={s.actionButton}
                                            accessibilityLabel={`Retry ${feed.title}`}
                                        >
                                            <RefreshCw size={16} color={colors.error} />
                                        </TouchableOpacity>
                                    ) : (
                                        <TouchableOpacity
                                            onPress={() => handleMoveFeed(feed)}
                                            style={s.actionButton}
                                            accessibilityLabel={`Move ${feed.title}`}
                                        >
                                            <FolderInput size={16} color={colors.text.tertiary} />
                                        </TouchableOpacity>
                                    )}
                                    <TouchableOpacity
                                        onPress={() => handleEditFeed(feed)}
                                        style={s.actionButton}
                                        accessibilityLabel={`Edit ${feed.title}`}
                                    >
                                        <Edit2 size={16} color={colors.text.tertiary} />
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        onPress={() => handleDeleteFeed(feed.id, feed.title)}
                                        style={s.actionButton}
                                        accessibilityLabel={`Delete ${feed.title}`}
                                    >
                                        <Trash2 size={16} color={colors.text.tertiary} />
                                    </TouchableOpacity>
                                </View>
                            )}
                        </View>
                    ))}
                </View>

                {/* Data Management */}
                <View style={s.section}>
                    <Text style={s.sectionTitle}>Data Management</Text>
                    <View style={s.dataActions}>
                        <TouchableOpacity
                            style={s.dataButton}
                            onPress={handleImportOpml}
                            disabled={progressState.isActive}
                        >
                            {progressState.isActive && progressState.operation === 'import' ? (
                                <ActivityIndicator color={colors.text.inverse} />
                            ) : (
                                <FileUp size={20} color={colors.text.inverse} />
                            )}
                            <Text style={s.dataButtonText}>Import OPML</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[s.dataButton, { backgroundColor: colors.background.tertiary }]}
                            onPress={handleExportOpml}
                            disabled={isExporting}
                        >
                            {isExporting ? (
                                <ActivityIndicator color={colors.text.primary} />
                            ) : (
                                <FileDown size={20} color={colors.text.primary} />
                            )}
                            <Text style={[s.dataButtonText, { color: colors.text.primary }]}>Export OPML</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Refresh All Feeds button */}
                    <TouchableOpacity
                        style={[s.dataButton, { backgroundColor: colors.primary.dark, marginTop: spacing.md }]}
                        onPress={handleRefreshAll}
                        disabled={progressState.isActive || feeds.length === 0}
                    >
                        {progressState.isActive && progressState.operation === 'refresh' ? (
                            <ActivityIndicator color={colors.text.inverse} />
                        ) : (
                            <RefreshCcw size={20} color={colors.text.inverse} />
                        )}
                        <Text style={s.dataButtonText}>Refresh All Feeds ({feeds.length})</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>

            {/* Bulk Toolbar */}
            {isBulkMode && selectedFeedIds.size > 0 && (
                <View style={s.bulkToolbar}>
                    <TouchableOpacity
                        style={[s.bulkButton, { backgroundColor: colors.background.tertiary }]}
                        onPress={handleSelectAll}
                    >
                        <Check size={18} color={colors.text.secondary} />
                        <Text style={[s.bulkButtonText, { color: colors.text.secondary }]}>
                            {selectedFeedIds.size === feeds.length ? 'Deselect All' : 'Select All'}
                        </Text>
                    </TouchableOpacity>
                    <Text style={s.bulkText}>{selectedFeedIds.size} selected</Text>
                    <View style={s.bulkActions}>
                        <TouchableOpacity
                            style={[s.bulkButton, { backgroundColor: colors.secondary.DEFAULT + '22' }]}
                            onPress={handleBulkMove}
                        >
                            <FolderInput size={18} color={colors.secondary.DEFAULT} />
                            <Text style={[s.bulkButtonText, { color: colors.secondary.DEFAULT }]}>Move</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[s.bulkButton, { backgroundColor: '#ef444422' }]}
                            onPress={handleBulkDelete}
                        >
                            <Trash2 size={18} color="#ef4444" />
                            <Text style={[s.bulkButtonText, { color: '#ef4444' }]}>Delete</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            )}

            {/* Edit Feed / Rename Folder Modal */}
            <Modal
                visible={modalType === 'edit_feed' || modalType === 'rename_folder'}
                transparent
                animationType="fade"
            >
                <View style={s.modalOverlay}>
                    <View style={s.modal}>
                        <Text style={s.modalTitle}>
                            {modalType === 'edit_feed' ? 'Edit Feed' : 'Rename Folder'}
                        </Text>

                        <Text style={s.modalLabel}>Name</Text>
                        <TextInput
                            style={s.modalInput}
                            value={renameValue}
                            onChangeText={setRenameValue}
                            placeholder="Enter name…"
                            placeholderTextColor={colors.text.tertiary}
                            autoFocus={modalType === 'edit_feed' && isDesktop}
                            accessibilityLabel="Name"
                        />

                        <View style={s.modalActions}>
                            <TouchableOpacity
                                style={s.modalCancel}
                                onPress={() => setModalType(null)}
                            >
                                <Text style={s.modalCancelText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={s.modalConfirm}
                                onPress={submitRename}
                            >
                                <Text style={s.modalConfirmText}>Save</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Move Feed Modal */}
            <Modal
                visible={modalType === 'move_feed'}
                transparent
                animationType="fade"
            >
                <View style={s.modalOverlay}>
                    <View style={s.modal}>
                        <Text style={s.modalTitle}>Move to Folder</Text>
                        <TouchableOpacity
                            style={[
                                s.folderOption,
                                selectedFolderId === null && s.folderOptionSelected
                            ]}
                            onPress={() => setSelectedFolderId(null)}
                        >
                            <Text style={s.folderOptionText}>No Folder</Text>
                            {selectedFolderId === null && <Check size={18} color={colors.primary.DEFAULT} />}
                        </TouchableOpacity>
                        {folders.map((folder: Folder) => (
                            <TouchableOpacity
                                key={folder.id}
                                style={[
                                    s.folderOption,
                                    selectedFolderId === folder.id && s.folderOptionSelected
                                ]}
                                onPress={() => setSelectedFolderId(folder.id)}
                            >
                                <FolderIcon size={18} color={colors.secondary.DEFAULT} />
                                <Text style={s.folderOptionText}>{folder.name}</Text>
                                {selectedFolderId === folder.id && <Check size={18} color={colors.primary.DEFAULT} />}
                            </TouchableOpacity>
                        ))}
                        <View style={s.modalActions}>
                            <TouchableOpacity
                                style={s.modalCancel}
                                onPress={() => setModalType(null)}
                            >
                                <Text style={s.modalCancelText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={s.modalConfirm}
                                onPress={submitMove}
                            >
                                <Text style={s.modalConfirmText}>Move</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Progress Dialog */}
            <ProgressDialog
                state={progressState}
                onClose={closeProgressDialog}
                onRetryFailed={handleRetryFailed}
            />

            {/* Feed Info Sheet */}
            <FeedInfoSheet
                feedId={feedInfoId}
                visible={feedInfoVisible}
                onClose={() => {
                    setFeedInfoVisible(false);
                    setFeedInfoId(null);
                }}
                onEdit={(feed) => {
                    handleEditFeed(feed);
                }}
                onDelete={(feed) => {
                    handleDeleteFeed(feed.id, feed.title);
                }}
            />

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
        borderBottomWidth: 1,
        borderBottomColor: colors.border.DEFAULT,
    },
    backButton: {
        padding: spacing.sm,
        marginLeft: -spacing.sm,
    },
    headerTitle: {
        flex: 1,
        fontSize: 20,
        fontWeight: '600',
        color: colors.text.primary,
    },
    headerActions: {
        flexDirection: 'row',
        gap: spacing.sm,
    },
    headerButton: {
        padding: spacing.sm,
        backgroundColor: colors.background.secondary,
        borderRadius: borderRadius.md,
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
    primaryButton: {
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
        borderRadius: borderRadius.lg,
        marginBottom: spacing.md,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: colors.border.DEFAULT,
        // Elevation for premium feel
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.1,
                shadowRadius: 4,
            },
            android: {
                elevation: 2,
            },
            web: {
                boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
            },
        }),
    },
    feedContentClickable: { // New style for the main clickable area
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        padding: spacing.md,
        gap: spacing.sm,
    },
    folderContent: { // New style for folder content layout
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        padding: spacing.md,
        gap: spacing.sm,
    },
    feedActions: { // New style for the action buttons container
        flexDirection: 'row',
        alignItems: 'center',
        paddingRight: spacing.xs,
    },
    feedIcon: {
        width: 18,
        height: 18,
        borderRadius: 3,
    },
    dataActions: {
        flexDirection: 'row',
        gap: spacing.md,
    },
    dataButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.primary.DEFAULT,
        padding: spacing.lg,
        borderRadius: borderRadius.md,
        gap: spacing.sm,
    },
    dataButtonText: {
        color: colors.text.inverse,
        fontWeight: '600',
        fontSize: 16,
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
    feedTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        flex: 1,
    },
    errorIcon: {
        flexShrink: 0,
    },
    errorBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginTop: 4,
        alignSelf: 'flex-start',
        backgroundColor: colors.error + '22',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: borderRadius.sm,
    },
    errorBadgeText: {
        fontSize: 11,
        color: colors.error,
        fontWeight: '600',
    },
    feedItemError: {
        borderLeftWidth: 3,
        borderLeftColor: colors.error,
    },
    feedItemPaused: {
        borderLeftWidth: 3,
        borderLeftColor: colors.warning,
        opacity: 0.8,
    },
    feedIconContainer: {
        position: 'relative',
    },
    feedIconPaused: {
        opacity: 0.5,
    },
    pausedOverlay: {
        position: 'absolute',
        bottom: -2,
        right: -2,
        backgroundColor: colors.warning,
        borderRadius: 8,
        padding: 2,
    },
    feedTitlePaused: {
        color: colors.text.tertiary,
    },
    statusIcon: {
        flexShrink: 0,
    },
    pausedBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginTop: 4,
        alignSelf: 'flex-start',
        backgroundColor: colors.warning + '22',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: borderRadius.sm,
    },
    pausedBadgeText: {
        fontSize: 11,
        color: colors.warning,
        fontWeight: '600',
    },
    actionButton: {
        padding: spacing.sm,
    },
    // Modal styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        justifyContent: 'center',
        padding: spacing.xl,
    },
    modal: {
        backgroundColor: colors.background.secondary,
        borderRadius: borderRadius.lg,
        padding: spacing.xl,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: colors.text.primary,
        marginBottom: spacing.lg,
    },
    modalHint: {
        fontSize: 14,
        color: colors.text.secondary,
        marginBottom: spacing.md,
    },
    modalInput: {
        backgroundColor: colors.background.primary,
        borderRadius: borderRadius.md,
        padding: spacing.lg,
        fontSize: 16,
        color: colors.text.primary,
        borderWidth: 1,
        borderColor: colors.border.DEFAULT,
        marginBottom: spacing.lg,
    },
    modalLabel: {
        fontSize: 13,
        fontWeight: '600',
        color: colors.text.secondary,
        marginBottom: spacing.xs,
        marginTop: spacing.md,
        textTransform: 'uppercase',
    },
    modalActions: {
        flexDirection: 'row',
        gap: spacing.md,
    },
    modalCancel: {
        flex: 1,
        padding: spacing.md,
        borderRadius: borderRadius.md,
        backgroundColor: colors.background.tertiary,
        alignItems: 'center',
    },
    modalCancelText: {
        fontSize: 15,
        color: colors.text.secondary,
        fontWeight: '500',
    },
    modalConfirm: {
        flex: 1,
        padding: spacing.md,
        borderRadius: borderRadius.md,
        backgroundColor: colors.primary.DEFAULT,
        alignItems: 'center',
    },
    modalConfirmText: {
        fontSize: 15,
        color: colors.text.inverse,
        fontWeight: '500',
    },
    folderOption: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        padding: spacing.md,
        borderRadius: borderRadius.md,
        marginBottom: spacing.sm,
    },
    folderOptionSelected: {
        backgroundColor: colors.background.tertiary,
    },
    folderOptionText: {
        flex: 1,
        fontSize: 15,
        color: colors.text.primary,
    },
    // Bulk styles
    checkbox: {
        width: 20,
        height: 20,
        borderRadius: 4,
        borderWidth: 2,
        borderColor: colors.border.DEFAULT,
        alignItems: 'center',
        justifyContent: 'center',
    },
    checkboxSelected: {
        backgroundColor: colors.primary.DEFAULT,
        borderColor: colors.primary.DEFAULT,
    },
    bulkToolbar: {
        position: 'absolute',
        bottom: spacing.xl,
        left: spacing.xl,
        right: spacing.xl,
        backgroundColor: colors.background.secondary,
        borderRadius: borderRadius.lg,
        padding: spacing.md,
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.lg,
        borderWidth: 1,
        borderColor: colors.border.DEFAULT,
        // Shadow
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
    },
    bulkText: {
        flex: 1,
        fontSize: 14,
        fontWeight: '600',
        color: colors.text.primary,
        marginLeft: spacing.sm,
    },
    bulkActions: {
        flexDirection: 'row',
        gap: spacing.sm,
    },
    bulkButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: borderRadius.md,
        gap: spacing.xs,
    },
    bulkButtonText: {
        fontSize: 13,
        fontWeight: '600',
    },
    filterPillsContainer: {
        flexDirection: 'row',
        gap: spacing.sm,
        paddingBottom: spacing.sm,
    },
    filterPillsScroll: {
        flexGrow: 0,
        marginBottom: spacing.sm,
    },
    filterPill: {
        paddingHorizontal: spacing.md,
        paddingVertical: 6,
        borderRadius: borderRadius.full,
        backgroundColor: colors.background.tertiary,
        borderWidth: 1,
        borderColor: colors.border.DEFAULT,
    },
    filterPillActive: {
        backgroundColor: colors.primary.DEFAULT,
        borderColor: colors.primary.DEFAULT,
    },
    filterPillText: {
        fontSize: 13,
        color: colors.text.secondary,
        fontWeight: '500',
    },
    filterPillTextActive: {
        color: colors.text.inverse,
    },
});
