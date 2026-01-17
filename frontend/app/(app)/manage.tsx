import { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Alert, Modal } from 'react-native';
import { useRouter } from 'expo-router';
import { useFeedStore, useToastStore } from '@/stores';
import { api, DiscoveredFeed, Feed, Folder } from '@/services/api';
import {
    ArrowLeft, Plus, Search, Rss, Youtube, Headphones, MessageSquare,
    Folder as FolderIcon, Trash2, Edit2, FolderInput, Download, Upload,
    ChevronDown, X, Check
} from 'lucide-react-native';
import { colors, borderRadius, spacing } from '@/theme';

type ModalType = 'edit_feed' | 'rename_folder' | 'move_feed' | 'import_opml' | null;

export default function ManageScreen() {
    const router = useRouter();
    const { feeds, folders, addFeed, deleteFeed, fetchFeeds, fetchFolders } = useFeedStore();
    const { show } = useToastStore();

    const [urlInput, setUrlInput] = useState('');
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
    const [refreshInterval, setRefreshInterval] = useState(30);
    const [opmlContent, setOpmlContent] = useState('');
    const [isExporting, setIsExporting] = useState(false);

    // Bulk actions
    const [isBulkMode, setIsBulkMode] = useState(false);
    const [selectedFeedIds, setSelectedFeedIds] = useState<Set<number>>(new Set());

    const handleDiscover = async () => {
        if (!urlInput.trim()) return;

        setIsDiscovering(true);
        setDiscoveries([]);

        try {
            const result = await api.discover(urlInput);
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
            await addFeed(discovery.feed_url);
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
                        } catch (err) {
                            show('Failed to delete feed', 'error');
                        }
                    }
                },
            ]
        );
    };

    const handleEditFeed = (feed: Feed) => {
        setSelectedFeed(feed);
        setRenameValue(feed.title);
        setRefreshInterval(feed.refresh_interval_minutes || 30);
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
                    refresh_interval_minutes: refreshInterval
                });
            } else if (modalType === 'rename_folder' && selectedFolder) {
                await api.updateFolder(selectedFolder.id, { name: renameValue });
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
                await api.bulkFeedAction('move', Array.from(selectedFeedIds), selectedFolderId || undefined);
                setSelectedFeedIds(new Set());
                setIsBulkMode(false);
            }
            fetchFeeds();
            setModalType(null);
            show('Feeds moved', 'success');
        } catch (err) {
            show('Failed to move feeds', 'error');
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
                            await api.deleteFolder(folderId);
                            fetchFolders();
                            fetchFeeds();
                            show('Folder deleted', 'success');
                        } catch (err) {
                            show('Failed to delete folder', 'error');
                        }
                    }
                }
            ]
        );
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
        if (!opmlContent.trim()) return;

        try {
            const result = await api.importOpml(opmlContent);
            show(`Imported ${result.imported.feeds} feeds, ${result.imported.folders} folders`, 'success');
            setOpmlContent('');
            setModalType(null);
            fetchFeeds();
            fetchFolders();
        } catch (err) {
            show('Failed to import OPML', 'error');
        }
    };

    const handleSelectAll = () => {
        if (selectedFeedIds.size === feeds.length) {
            setSelectedFeedIds(new Set());
        } else {
            setSelectedFeedIds(new Set(feeds.map(f => f.id)));
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
    };

    const submitBulkMove = async () => {
        try {
            await api.bulkFeedAction('move', Array.from(selectedFeedIds), selectedFolderId || undefined);
            fetchFeeds();
            setModalType(null);
            setIsBulkMode(false);
            setSelectedFeedIds(new Set());
            show(`Moved ${selectedFeedIds.size} feeds`, 'success');
        } catch (err) {
            show('Bulk move failed', 'error');
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
                <View style={styles.headerActions}>
                    <TouchableOpacity
                        style={[styles.headerButton, isBulkMode && { backgroundColor: colors.primary.DEFAULT + '22' }]}
                        onPress={toggleBulkMode}
                    >
                        <Check size={18} color={isBulkMode ? colors.primary.DEFAULT : colors.text.secondary} />
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.headerButton}
                        onPress={() => setModalType('import_opml')}
                    >
                        <Upload size={18} color={colors.text.secondary} />
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.headerButton}
                        onPress={handleExportOpml}
                        disabled={isExporting}
                    >
                        <Download size={18} color={colors.text.secondary} />
                    </TouchableOpacity>
                </View>
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
                            style={styles.primaryButton}
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
                            style={[styles.primaryButton, { backgroundColor: colors.secondary.DEFAULT }]}
                            onPress={handleCreateFolder}
                        >
                            <FolderIcon size={20} color={colors.text.inverse} />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Folders */}
                {folders.length > 0 && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Folders ({folders.length})</Text>
                        {folders.map((folder) => (
                            <View key={folder.id} style={styles.feedItem}>
                                <FolderIcon size={18} color={colors.secondary.DEFAULT} />
                                <View style={styles.feedInfo}>
                                    <Text style={styles.feedTitle}>{folder.name}</Text>
                                    <Text style={styles.feedUrl}>
                                        {feeds.filter(f => f.folder_id === folder.id).length} feeds
                                    </Text>
                                </View>
                                <TouchableOpacity
                                    onPress={() => handleRenameFolder(folder)}
                                    style={styles.actionButton}
                                >
                                    <Edit2 size={16} color={colors.text.tertiary} />
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={() => handleDeleteFolder(folder.id, folder.name)}
                                    style={styles.actionButton}
                                >
                                    <Trash2 size={16} color={colors.text.tertiary} />
                                </TouchableOpacity>
                            </View>
                        ))}
                    </View>
                )}

                {/* Feeds */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Feeds ({feeds.length})</Text>
                    {feeds.map((feed) => (
                        <TouchableOpacity
                            key={feed.id}
                            style={[
                                styles.feedItem,
                                isBulkMode && selectedFeedIds.has(feed.id) && { backgroundColor: colors.primary.DEFAULT + '11', borderColor: colors.primary.DEFAULT + '44' }
                            ]}
                            onPress={() => isBulkMode ? toggleSelectFeed(feed.id) : null}
                            activeOpacity={isBulkMode ? 0.7 : 1}
                        >
                            {isBulkMode ? (
                                <View style={[
                                    styles.checkbox,
                                    selectedFeedIds.has(feed.id) && styles.checkboxSelected
                                ]}>
                                    {selectedFeedIds.has(feed.id) && <Check size={12} color={colors.text.inverse} />}
                                </View>
                            ) : getTypeIcon(feed.type)}

                            <View style={styles.feedInfo}>
                                <Text style={styles.feedTitle} numberOfLines={1}>{feed.title}</Text>
                                <Text style={styles.feedUrl} numberOfLines={1}>
                                    {folders.find(f => f.id === feed.folder_id)?.name || 'No folder'}
                                </Text>
                            </View>

                            {!isBulkMode && (
                                <>
                                    <TouchableOpacity
                                        onPress={() => handleMoveFeed(feed)}
                                        style={styles.actionButton}
                                    >
                                        <FolderInput size={16} color={colors.text.tertiary} />
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        onPress={() => handleEditFeed(feed)}
                                        style={styles.actionButton}
                                    >
                                        <Edit2 size={16} color={colors.text.tertiary} />
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        onPress={() => handleDeleteFeed(feed.id, feed.title)}
                                        style={styles.actionButton}
                                    >
                                        <Trash2 size={16} color={colors.text.tertiary} />
                                    </TouchableOpacity>
                                </>
                            )}
                        </TouchableOpacity>
                    ))}
                </View>
            </ScrollView>

            {/* Bulk Toolbar */}
            {isBulkMode && selectedFeedIds.size > 0 && (
                <View style={styles.bulkToolbar}>
                    <TouchableOpacity
                        style={[styles.bulkButton, { backgroundColor: colors.background.tertiary }]}
                        onPress={handleSelectAll}
                    >
                        <Check size={18} color={colors.text.secondary} />
                        <Text style={[styles.bulkButtonText, { color: colors.text.secondary }]}>
                            {selectedFeedIds.size === feeds.length ? 'Deselect All' : 'Select All'}
                        </Text>
                    </TouchableOpacity>
                    <Text style={styles.bulkText}>{selectedFeedIds.size} selected</Text>
                    <View style={styles.bulkActions}>
                        <TouchableOpacity
                            style={[styles.bulkButton, { backgroundColor: colors.secondary.DEFAULT + '22' }]}
                            onPress={handleBulkMove}
                        >
                            <FolderInput size={18} color={colors.secondary.DEFAULT} />
                            <Text style={[styles.bulkButtonText, { color: colors.secondary.DEFAULT }]}>Move</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.bulkButton, { backgroundColor: '#ef444422' }]}
                            onPress={handleBulkDelete}
                        >
                            <Trash2 size={18} color="#ef4444" />
                            <Text style={[styles.bulkButtonText, { color: '#ef4444' }]}>Delete</Text>
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
                <View style={styles.modalOverlay}>
                    <View style={styles.modal}>
                        <Text style={styles.modalTitle}>
                            {modalType === 'edit_feed' ? 'Edit Feed' : 'Rename Folder'}
                        </Text>

                        <Text style={styles.modalLabel}>Name</Text>
                        <TextInput
                            style={styles.modalInput}
                            value={renameValue}
                            onChangeText={setRenameValue}
                            placeholder="Enter name..."
                            placeholderTextColor={colors.text.tertiary}
                            autoFocus={modalType === 'edit_feed'}
                        />

                        {modalType === 'edit_feed' && (
                            <>
                                <Text style={styles.modalLabel}>Refresh Interval</Text>
                                <View style={styles.intervalOptions}>
                                    {[
                                        { label: '15m', value: 15 },
                                        { label: '30m', value: 30 },
                                        { label: '1h', value: 60 },
                                        { label: '4h', value: 240 },
                                        { label: '12h', value: 720 },
                                        { label: '24h', value: 1440 },
                                    ].map((opt) => (
                                        <TouchableOpacity
                                            key={opt.value}
                                            style={[
                                                styles.intervalOption,
                                                refreshInterval === opt.value && styles.intervalOptionSelected
                                            ]}
                                            onPress={() => setRefreshInterval(opt.value)}
                                        >
                                            <Text style={[
                                                styles.intervalOptionText,
                                                refreshInterval === opt.value && styles.intervalOptionTextSelected
                                            ]}>
                                                {opt.label}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </>
                        )}

                        <View style={styles.modalActions}>
                            <TouchableOpacity
                                style={styles.modalCancel}
                                onPress={() => setModalType(null)}
                            >
                                <Text style={styles.modalCancelText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.modalConfirm}
                                onPress={submitRename}
                            >
                                <Text style={styles.modalConfirmText}>Save</Text>
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
                <View style={styles.modalOverlay}>
                    <View style={styles.modal}>
                        <Text style={styles.modalTitle}>Move to Folder</Text>
                        <TouchableOpacity
                            style={[
                                styles.folderOption,
                                selectedFolderId === null && styles.folderOptionSelected
                            ]}
                            onPress={() => setSelectedFolderId(null)}
                        >
                            <Text style={styles.folderOptionText}>No Folder</Text>
                            {selectedFolderId === null && <Check size={18} color={colors.primary.DEFAULT} />}
                        </TouchableOpacity>
                        {folders.map(folder => (
                            <TouchableOpacity
                                key={folder.id}
                                style={[
                                    styles.folderOption,
                                    selectedFolderId === folder.id && styles.folderOptionSelected
                                ]}
                                onPress={() => setSelectedFolderId(folder.id)}
                            >
                                <FolderIcon size={18} color={colors.secondary.DEFAULT} />
                                <Text style={styles.folderOptionText}>{folder.name}</Text>
                                {selectedFolderId === folder.id && <Check size={18} color={colors.primary.DEFAULT} />}
                            </TouchableOpacity>
                        ))}
                        <View style={styles.modalActions}>
                            <TouchableOpacity
                                style={styles.modalCancel}
                                onPress={() => setModalType(null)}
                            >
                                <Text style={styles.modalCancelText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.modalConfirm}
                                onPress={submitMove}
                            >
                                <Text style={styles.modalConfirmText}>Move</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Import OPML Modal */}
            <Modal
                visible={modalType === 'import_opml'}
                transparent
                animationType="fade"
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modal}>
                        <Text style={styles.modalTitle}>Import OPML</Text>
                        <Text style={styles.modalHint}>Paste your OPML content below:</Text>
                        <TextInput
                            style={[styles.modalInput, { height: 150, textAlignVertical: 'top' }]}
                            value={opmlContent}
                            onChangeText={setOpmlContent}
                            placeholder="<?xml version='1.0'?>..."
                            placeholderTextColor={colors.text.tertiary}
                            multiline
                        />
                        <View style={styles.modalActions}>
                            <TouchableOpacity
                                style={styles.modalCancel}
                                onPress={() => setModalType(null)}
                            >
                                <Text style={styles.modalCancelText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.modalConfirm}
                                onPress={handleImportOpml}
                            >
                                <Text style={styles.modalConfirmText}>Import</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
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
        borderRadius: borderRadius.md,
        padding: spacing.md,
        gap: spacing.sm,
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
    intervalOptions: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.sm,
        marginBottom: spacing.lg,
    },
    intervalOption: {
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: borderRadius.md,
        backgroundColor: colors.background.tertiary,
        borderWidth: 1,
        borderColor: colors.border.DEFAULT,
    },
    intervalOptionSelected: {
        backgroundColor: colors.primary.DEFAULT,
        borderColor: colors.primary.DEFAULT,
    },
    intervalOptionText: {
        fontSize: 13,
        fontWeight: '500',
        color: colors.text.secondary,
    },
    intervalOptionTextSelected: {
        color: colors.text.inverse,
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
});
