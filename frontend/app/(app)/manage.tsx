import * as DocumentPicker from 'expo-document-picker';
import { useMemo, useState, useCallback, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Alert, Modal, Image, Platform, useWindowDimensions, Animated } from 'react-native';
import { useRouter } from 'expo-router';
import { useFeedStore, useToastStore, useArticleStore, useSettingsStore } from '@/stores';
import { api, DiscoveredFeed, Feed, Folder, Recommendation, FeedPreview } from '@/services/api';
import {
    ArrowLeft, Plus, Search, Rss, Youtube, Headphones, MessageSquare,
    Folder as FolderIcon, Trash2, Edit2, FolderInput,
    Check, FileUp, FileDown, AlertTriangle, RefreshCw, RefreshCcw,
    Info, Pause, Clock, Skull, X, Globe, AlertCircle, ChevronRight,
    Sparkles, ChevronDown, ArrowUpRight
} from 'lucide-react-native';
import { FeedInfoSheet } from '@/components/FeedInfoSheet';
import { useColors, borderRadius, spacing } from '@/theme';
import { ProgressDialog, ProgressState } from '@/components/ProgressDialog';
import { useProgressHandler } from '@/hooks/useProgressHandler';
import { getFeedHealth, getFeedHealthInfo } from '@/utils/feedHealth';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { Button } from '@/components/ui/Button';
import { LoadingState } from '@/components/ui/LoadingState';
import { Input } from '@/components/ui/Input';
import { DiscoveryCard } from '@/components/DiscoveryCard';
import Sidebar from '@/components/Sidebar';
import { QuickAddGrid } from '@/components/QuickAddGrid';
import { useDebouncedDiscovery } from '@/hooks/useDebouncedDiscovery';
import { isDuplicateFeed, suggestFolderName } from '@/utils/feedUtils';
import { openExternalLink } from '@/utils/externalLink';

type ModalType = 'edit_feed' | 'rename_folder' | 'move_feed' | 'view_folder' | null;

type DiscoveryType = 'all' | 'rss' | 'youtube' | 'reddit' | 'podcast';
type AddFeedTab = 'search' | 'foryou';

const discoveryTypes: DiscoveryType[] = ['all', 'rss', 'youtube', 'reddit', 'podcast'];

type ItemStatus = 'pending' | 'processing' | 'success' | 'skipped' | 'error';

export default function ManageScreen() {
    const router = useRouter();
    const colors = useColors();
    const { width } = useWindowDimensions();
    const { feeds, folders, addFeed, deleteFeed, deleteFolder, fetchFeeds, fetchFolders } = useFeedStore();
    const { setFilter } = useArticleStore();
    const { show } = useToastStore();
    const { settings } = useSettingsStore();

    // Use debounced discovery hook
    const {
        input: urlInput,
        setInput: setUrlInput,
        discoveries,
        setDiscoveries,
        isDiscovering,
        hasAttempted,
        triggerDiscovery,
        clearDiscovery,
    } = useDebouncedDiscovery({
        onError: () => show('Discovery failed', 'error'),
    });

    const [discoveryType, setDiscoveryType] = useState<DiscoveryType>('all');
    const [activeTab, setActiveTab] = useState<AddFeedTab>('search');
    const [isAdding, setIsAdding] = useState(false);
    const [addingId, setAddingId] = useState<string | null>(null);
    const [addingRecId, setAddingRecId] = useState<number | null>(null);
    const [newFolderName, setNewFolderName] = useState('');
    const [showMenu, setShowMenu] = useState(false);
    const [sidebarAnim] = useState(new Animated.Value(-300));
    const [expandedFolderIds, setExpandedFolderIds] = useState<Set<number>>(new Set());

    // AI Recommendations state
    const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
    const [isLoadingRecs, setIsLoadingRecs] = useState(false);
    const [recsError, setRecsError] = useState<string | null>(null);
    const [hasFetchedRecs, setHasFetchedRecs] = useState(false);

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
    const [feedSearch, setFeedSearch] = useState('');

    // Feed Info Sheet state
    const [feedInfoId, setFeedInfoId] = useState<number | null>(null);
    const [feedInfoVisible, setFeedInfoVisible] = useState(false);

    // Preview modal state
    const [previewFeed, setPreviewFeed] = useState<DiscoveredFeed | null>(null);

    // Discovery card expand state
    const [expandedDiscoveries, setExpandedDiscoveries] = useState<Set<string>>(new Set());
    const [previewArticles, setPreviewArticles] = useState<Record<string, FeedPreview[]>>({});

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
    const filteredFeeds = useMemo(() => {
        const query = feedSearch.trim().toLowerCase();
        if (!query) return feeds;
        return feeds.filter((feed) => {
            const folderName = feed.folder_id ? folderNameById.get(feed.folder_id) : null;
            const haystacks = [feed.title, feed.url, feed.type, folderName].filter(Boolean) as string[];
            return haystacks.some((value) => value.toLowerCase().includes(query));
        });
    }, [feedSearch, feeds, folderNameById]);
    const visibleFeedCount = feedSearch.trim() ? filteredFeeds.length : feeds.length;
    const discoveryPlaceholder = discoveryType === 'all' ? 'feeds' : discoveryType;

    // Manual discovery trigger
    const handleDiscover = useCallback(async () => {
        if (!urlInput.trim()) return;
        const typeParam = discoveryType === 'all' ? undefined : discoveryType;
        await triggerDiscovery(urlInput, typeParam);
    }, [urlInput, discoveryType, triggerDiscovery]);

    // Fetch AI recommendations
    const fetchRecommendations = useCallback(async () => {
        setIsLoadingRecs(true);
        setRecsError(null);
        try {
            const res = await api.getRecommendations();
            setRecommendations(res.recommendations.filter(r => r.status === 'pending'));
            setHasFetchedRecs(true);
        } catch (err) {
            console.error('Failed to fetch recommendations:', err);
            setRecsError('Failed to load recommendations');
        } finally {
            setIsLoadingRecs(false);
        }
    }, []);

    // Refresh AI recommendations (triggers new discovery)
    const handleRefreshRecommendations = useCallback(async () => {
        setIsLoadingRecs(true);
        setRecsError(null);
        try {
            // Call the refresh endpoint which triggers AI-powered discovery
            const res = await api.refreshRecommendations();
            setRecommendations(res.recommendations.filter(r => r.status === 'pending'));
            setHasFetchedRecs(true);
            show('Recommendations refreshed!', 'success');
        } catch (err) {
            console.error('Failed to refresh recommendations:', err);
            setRecsError('Failed to refresh recommendations');
            show('Failed to refresh recommendations', 'error');
        } finally {
            setIsLoadingRecs(false);
        }
    }, [show]);

    // Load recommendations when tab changes to 'foryou'
    useEffect(() => {
        if (activeTab === 'foryou' && !hasFetchedRecs && !isLoadingRecs) {
            fetchRecommendations();
        }
    }, [activeTab, fetchRecommendations, hasFetchedRecs, isLoadingRecs]);

    // Convert Recommendation to DiscoveredFeed format for DiscoveryCard
    const convertRecommendationToDiscovery = (rec: Recommendation): DiscoveredFeed => {
        const metadata = JSON.parse(rec.metadata || '{}');
        return {
            feed_url: rec.feed_url,
            title: rec.title,
            description: rec.description,
            type: rec.feed_type,
            site_url: metadata.site_url || rec.feed_url,
            icon_url: metadata.thumbnail || null,
            confidence: rec.relevance_score / 100,
            method: 'search',
        };
    };

    // Handle subscribe to recommendation
    const handleSubscribeRecommendation = async (rec: Recommendation) => {
        if (addingRecId === rec.id) return;

        setAddingRecId(rec.id);
        show(`Subscribing to ${rec.title}…`, 'success');

        try {
            await addFeed(rec.feed_url, undefined, settings?.refresh_interval_minutes, false);
            // Remove from list after successful subscription
            setRecommendations(prev => prev.filter(r => r.id !== rec.id));
            show(`Subscribed to ${rec.title}`, 'success');
        } catch (err) {
            if (err instanceof Error && 'status' in err && (err as any).status === 409) {
                setRecommendations(prev => prev.filter(r => r.id !== rec.id));
                show(`Already subscribed to ${rec.title}`, 'info');
            } else {
                const message = err instanceof Error ? err.message : 'Failed to subscribe';
                show(message, 'error');
            }
        } finally {
            setAddingRecId(null);
        }
    };

    // Handle dismiss recommendation
    const handleDismissRecommendation = async (id: number) => {
        try {
            await api.dismissRecommendation(id);
            setRecommendations(prev => prev.filter(r => r.id !== id));
        } catch (err) {
            show('Failed to dismiss', 'error');
        }
    };

    // Handle add feed with smart folder suggestion
    const handleAddFeed = useCallback(async (discovery: DiscoveredFeed) => {
        setAddingId(discovery.feed_url);
        setIsAdding(true);

        try {
            // Check for suggested folder
            const suggestedFolder = suggestFolderName(discovery.type, discovery.title);
            let folderId: number | undefined;

            if (suggestedFolder) {
                const existingFolder = folders.find((f) =>
                    f.name.toLowerCase() === suggestedFolder.toLowerCase()
                );
                if (existingFolder) {
                    folderId = existingFolder.id;
                }
            }

            await addFeed(discovery.feed_url, folderId, settings?.refresh_interval_minutes);
            setDiscoveries((prev) => prev.filter((d) => d.feed_url !== discovery.feed_url));

            if (folderId) {
                show(`Added "${discovery.title}" to ${suggestFolderName(discovery.type, discovery.title)}`, 'success');
            } else {
                show(`Added "${discovery.title}"`, 'success');
            }
        } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to add feed';
            show(errorMessage, 'error');
        } finally {
            setIsAdding(false);
            setAddingId(null);
        }
    }, [addFeed, folders, setDiscoveries, settings?.refresh_interval_minutes, show]);

    // Handle quick add from popular feeds
    const handleQuickAdd = useCallback((url: string, type: string) => {
        // Pass true as second arg to skip the debounce effect
        setUrlInput(url, true);
        triggerDiscovery(url, type);
    }, [setUrlInput, triggerDiscovery]);

    // Handle preview
    const handlePreview = useCallback((discovery: DiscoveredFeed) => {
        setPreviewFeed(discovery);
    }, []);

    // Toggle expanded discovery card
    const toggleExpandDiscovery = useCallback(async (feedUrl: string) => {
        setExpandedDiscoveries((prev) => {
            const newSet = new Set(prev);
            if (newSet.has(feedUrl)) {
                newSet.delete(feedUrl);
                return newSet;
            }
            newSet.add(feedUrl);
            return newSet;
        });

        // Fetch preview articles if not already cached
        if (!previewArticles[feedUrl]) {
            try {
                const result = await api.previewFeed(feedUrl);
                setPreviewArticles((prev) => ({
                    ...prev,
                    [feedUrl]: result.articles.slice(0, 5),
                }));
            } catch {
                // Silently fail - preview is optional
            }
        }
    }, [previewArticles]);

    // Handle opening site URL
    const handleOpenSite = useCallback((url: string) => {
        openExternalLink(url);
    }, []);

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

    const toggleFolder = (folderId: number) => {
        setExpandedFolderIds((prev) => {
            const next = new Set(prev);
            if (next.has(folderId)) {
                next.delete(folderId);
            } else {
                next.add(folderId);
            }
            return next;
        });
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
        const visibleFeeds = feedSearch.trim() ? filteredFeeds : feeds;
        if (selectedFeedIds.size === visibleFeeds.length) {
            setSelectedFeedIds(new Set());
        } else {
            setSelectedFeedIds(new Set(visibleFeeds.map((f: Feed) => f.id)));
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
            default: return <Rss size={18} color={colors.primary?.DEFAULT ?? colors.primary} />;
        }
    };

    return (
        <View style={s.container}>
            {/* Header */}
            <ScreenHeader
                title="Feed Manager"
                showBackButton={false}
                showMenuButton={!isDesktop}
                onMenuPress={() => {
                    setShowMenu(true);
                    Animated.timing(sidebarAnim, {
                        toValue: 0,
                        duration: 250,
                        useNativeDriver: true,
                    }).start();
                }}
                rightActions={[
                    {
                        icon: <Check size={18} color={isBulkMode ? (colors.primary?.DEFAULT ?? colors.primary) : colors.text.secondary} />,
                        onPress: toggleBulkMode,
                        accessibilityLabel: 'Bulk mode',
                        variant: isBulkMode ? 'primary' : 'default',
                    }
                ]}
            />

            <ScrollView style={s.scrollView} contentContainerStyle={s.content}>
                {/* Add Feed */}
                <View style={s.section}>
                    <SectionHeader title="Add Feed" />

                    {/* Tab Switcher: Search / For You */}
                    <View style={s.tabContainer}>
                        <TouchableOpacity
                            style={[s.tab, activeTab === 'search' && s.tabActive]}
                            onPress={() => setActiveTab('search')}
                        >
                            <Search size={16} color={activeTab === 'search' ? colors.primary?.DEFAULT ?? colors.primary : colors.text.secondary} />
                            <Text style={[s.tabText, activeTab === 'search' && s.tabTextActive]}>
                                Search
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[s.tab, activeTab === 'foryou' && s.tabActive]}
                            onPress={() => setActiveTab('foryou')}
                        >
                            <Sparkles size={16} color={activeTab === 'foryou' ? colors.primary?.DEFAULT ?? colors.primary : colors.text.secondary} />
                            <Text style={[s.tabText, activeTab === 'foryou' && s.tabTextActive]}>
                                For You
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {/* Tab Content Container - fixed minHeight prevents layout shift */}
                    <View style={s.tabContentContainer}>

                        {/* Search Tab Content */}
                        {activeTab === 'search' && (
                            <>
                                {/* Type Filter Pills */}
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

                                {/* Search Input with Clear Button */}
                                <View style={s.inputRow}>
                                    <View style={{ flex: 1, minWidth: 0, position: 'relative' }}>
                                        <Input
                                            style={{
                                                flex: 1,
                                                minWidth: 0,
                                                paddingRight: urlInput ? 40 : spacing.md,
                                            }}
                                            placeholder={`Paste URL or search ${discoveryPlaceholder}…`}
                                            value={urlInput}
                                            onChangeText={setUrlInput}
                                            autoCapitalize="none"
                                            autoCorrect={false}
                                            keyboardType="default"
                                            returnKeyType="search"
                                            onSubmitEditing={handleDiscover}
                                            accessibilityLabel={`Search ${discoveryPlaceholder}`}
                                        />
                                        {urlInput.length > 0 && (
                                            <TouchableOpacity
                                                style={s.clearButton}
                                                onPress={() => {
                                                    setUrlInput('');
                                                    clearDiscovery();
                                                }}
                                                hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
                                            >
                                                <X size={16} color={colors.text.tertiary} />
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                    <Button
                                        onPress={handleDiscover}
                                        disabled={isDiscovering || !urlInput.trim()}
                                        loading={isDiscovering}
                                        icon={!isDiscovering ? <Search size={20} color={colors.text.inverse} /> : undefined}
                                        style={{ width: 44, height: 44, paddingHorizontal: 0 }}
                                    />
                                </View>

                                {/* Loading Shimmer */}
                                {isDiscovering && <LoadingState variant="skeleton" count={2} />}

                                {/* Discovery Results */}
                                {!isDiscovering && discoveries.length > 0 && (
                                    <View style={s.discoveries}>
                                        {(() => {
                                            // Filter out feeds that are already subscribed
                                            const newDiscoveries = discoveries.filter(
                                                (d) => !isDuplicateFeed(d, feeds)
                                            );

                                            if (newDiscoveries.length === 0) {
                                                return (
                                                    <View style={s.emptyDiscoveries}>
                                                        <Check size={48} color={colors.status.success} />
                                                        <Text style={s.emptyTitle}>Already subscribed!</Text>
                                                        <Text style={s.emptySubtitle}>
                                                            You&apos;re already following all feeds from this source
                                                        </Text>
                                                    </View>
                                                );
                                            }

                                            // Group by type
                                            const grouped = {
                                                rss: newDiscoveries.filter(d => d.type === 'rss'),
                                                youtube: newDiscoveries.filter(d => d.type === 'youtube'),
                                                podcast: newDiscoveries.filter(d => d.type === 'podcast'),
                                                reddit: newDiscoveries.filter(d => d.type === 'reddit'),
                                            };

                                            const total = Object.values(grouped).reduce((sum, arr) => sum + arr.length, 0);

                                            return (
                                                <>
                                                    <Text style={s.discoveriesTitle}>
                                                        {total} {total === 1 ? 'feed' : 'feeds'} found
                                                    </Text>

                                                    {/* RSS Section */}
                                                    {grouped.rss.length > 0 && (
                                                        <View style={s.groupSection}>
                                                            <View style={s.groupHeader}>
                                                                <Rss size={18} color={colors.feedTypes.rss} />
                                                                <Text style={s.groupTitle}>RSS Feeds</Text>
                                                                <Text style={s.groupCount}>{grouped.rss.length}</Text>
                                                            </View>
                                                            {grouped.rss.map((discovery, i) => (
                                                                <DiscoveryCard
                                                                    key={`rss-${discovery.feed_url}-${i}`}
                                                                    discovery={discovery}
                                                                    previewArticles={previewArticles[discovery.feed_url] || []}
                                                                    isAdding={addingId === discovery.feed_url}
                                                                    isDuplicate={false}
                                                                    onPreview={() => handlePreview(discovery)}
                                                                    onAdd={() => handleAddFeed(discovery)}
                                                                    onOpenSite={() => handleOpenSite(discovery.site_url || discovery.feed_url)}
                                                                    expanded={expandedDiscoveries.has(discovery.feed_url)}
                                                                    onToggleExpand={() => toggleExpandDiscovery(discovery.feed_url)}
                                                                />
                                                            ))}
                                                        </View>
                                                    )}

                                                    {/* YouTube Section */}
                                                    {grouped.youtube.length > 0 && (
                                                        <View style={s.groupSection}>
                                                            <View style={s.groupHeader}>
                                                                <Youtube size={18} color={colors.feedTypes.youtube} />
                                                                <Text style={s.groupTitle}>YouTube Channels</Text>
                                                                <Text style={s.groupCount}>{grouped.youtube.length}</Text>
                                                            </View>
                                                            {grouped.youtube.map((discovery, i) => (
                                                                <DiscoveryCard
                                                                    key={`yt-${discovery.feed_url}-${i}`}
                                                                    discovery={discovery}
                                                                    previewArticles={previewArticles[discovery.feed_url] || []}
                                                                    isAdding={addingId === discovery.feed_url}
                                                                    isDuplicate={false}
                                                                    onPreview={() => handlePreview(discovery)}
                                                                    onAdd={() => handleAddFeed(discovery)}
                                                                    onOpenSite={() => handleOpenSite(discovery.site_url || discovery.feed_url)}
                                                                    expanded={expandedDiscoveries.has(discovery.feed_url)}
                                                                    onToggleExpand={() => toggleExpandDiscovery(discovery.feed_url)}
                                                                />
                                                            ))}
                                                        </View>
                                                    )}

                                                    {/* Podcast Section */}
                                                    {grouped.podcast.length > 0 && (
                                                        <View style={s.groupSection}>
                                                            <View style={s.groupHeader}>
                                                                <Headphones size={18} color={colors.feedTypes.podcast} />
                                                                <Text style={s.groupTitle}>Podcasts</Text>
                                                                <Text style={s.groupCount}>{grouped.podcast.length}</Text>
                                                            </View>
                                                            {grouped.podcast.map((discovery, i) => (
                                                                <DiscoveryCard
                                                                    key={`pod-${discovery.feed_url}-${i}`}
                                                                    discovery={discovery}
                                                                    previewArticles={previewArticles[discovery.feed_url] || []}
                                                                    isAdding={addingId === discovery.feed_url}
                                                                    isDuplicate={false}
                                                                    onPreview={() => handlePreview(discovery)}
                                                                    onAdd={() => handleAddFeed(discovery)}
                                                                    onOpenSite={() => handleOpenSite(discovery.site_url || discovery.feed_url)}
                                                                    expanded={expandedDiscoveries.has(discovery.feed_url)}
                                                                    onToggleExpand={() => toggleExpandDiscovery(discovery.feed_url)}
                                                                />
                                                            ))}
                                                        </View>
                                                    )}

                                                    {/* Reddit Section */}
                                                    {grouped.reddit.length > 0 && (
                                                        <View style={s.groupSection}>
                                                            <View style={s.groupHeader}>
                                                                <MessageSquare size={18} color={colors.feedTypes.reddit} />
                                                                <Text style={s.groupTitle}>Subreddits</Text>
                                                                <Text style={s.groupCount}>{grouped.reddit.length}</Text>
                                                            </View>
                                                            {grouped.reddit.map((discovery, i) => (
                                                                <DiscoveryCard
                                                                    key={`rd-${discovery.feed_url}-${i}`}
                                                                    discovery={discovery}
                                                                    previewArticles={previewArticles[discovery.feed_url] || []}
                                                                    isAdding={addingId === discovery.feed_url}
                                                                    isDuplicate={false}
                                                                    onPreview={() => handlePreview(discovery)}
                                                                    onAdd={() => handleAddFeed(discovery)}
                                                                    onOpenSite={() => handleOpenSite(discovery.site_url || discovery.feed_url)}
                                                                    expanded={expandedDiscoveries.has(discovery.feed_url)}
                                                                    onToggleExpand={() => toggleExpandDiscovery(discovery.feed_url)}
                                                                />
                                                            ))}
                                                        </View>
                                                    )}
                                                </>
                                            );
                                        })()}
                                    </View>
                                )}

                                {/* Empty State with Quick Add */}
                                {!isDiscovering && !hasAttempted && !urlInput && (
                                    <QuickAddGrid onSelect={handleQuickAdd} />
                                )}

                                {/* No Results State */}
                                {!isDiscovering && hasAttempted && discoveries.length === 0 && urlInput && (
                                    <View style={s.emptyDiscoveries}>
                                        <Globe size={48} color={colors.text.tertiary} />
                                        <Text style={s.emptyTitle}>No feeds found</Text>
                                        <Text style={s.emptySubtitle}>
                                            Try a different URL or search term
                                        </Text>
                                    </View>
                                )}
                            </>
                        )}

                        {/* For You Tab Content - AI Recommendations */}
                        {activeTab === 'foryou' && (
                            <View style={s.discoveries}>
                                {/* Refresh Button Row */}
                                <View style={s.refreshRow}>
                                    <Text style={s.discoveriesTitle}>
                                        {isLoadingRecs ? 'Finding recommendations…' :
                                            recommendations.length > 0 ? `${recommendations.length} recommendation${recommendations.length === 1 ? '' : 's'}` :
                                                'Personalized for you'}
                                    </Text>
                                    <TouchableOpacity
                                        onPress={handleRefreshRecommendations}
                                        disabled={isLoadingRecs}
                                        style={[s.refreshButton, isLoadingRecs && s.refreshButtonDisabled]}
                                    >
                                        {isLoadingRecs ? (
                                            <ActivityIndicator size={14} color={colors.primary?.DEFAULT ?? colors.primary} />
                                        ) : (
                                            <RefreshCw size={14} color={colors.primary?.DEFAULT ?? colors.primary} />
                                        )}
                                        <Text style={s.refreshButtonText}>
                                            {isLoadingRecs ? 'Refreshing…' : 'Refresh'}
                                        </Text>
                                    </TouchableOpacity>
                                </View>

                                {(isLoadingRecs || !hasFetchedRecs) && recommendations.length === 0 ? (
                                    <LoadingState variant="skeleton" count={2} />
                                ) : recsError ? (
                                    <View style={s.emptyDiscoveries}>
                                        <AlertCircle size={48} color={colors.status.error} />
                                        <Text style={s.emptyTitle}>{recsError}</Text>
                                        <Button
                                            title="Try Again"
                                            onPress={fetchRecommendations}
                                            variant="primary"
                                            icon={<RefreshCw size={16} color={colors.text.inverse} />}
                                        />
                                    </View>
                                ) : recommendations.length === 0 ? (
                                    <View style={s.emptyDiscoveries}>
                                        <Sparkles size={48} color={colors.text.tertiary} />
                                        <Text style={s.emptyTitle}>All caught up!</Text>
                                        <Text style={s.emptySubtitle}>
                                            Check back later for personalized recommendations
                                        </Text>
                                    </View>
                                ) : (
                                    <>
                                        {recommendations.map((rec) => {
                                            const discovery = convertRecommendationToDiscovery(rec);
                                            return (
                                                <DiscoveryCard
                                                    key={rec.id}
                                                    discovery={discovery}
                                                    previewArticles={previewArticles[discovery.feed_url] || []}
                                                    isAdding={addingRecId === rec.id}
                                                    isDuplicate={false}
                                                    onPreview={() => handlePreview(discovery)}
                                                    onAdd={() => handleSubscribeRecommendation(rec)}
                                                    onOpenSite={() => handleOpenSite(discovery.site_url || discovery.feed_url)}
                                                    expanded={expandedDiscoveries.has(discovery.feed_url)}
                                                    onToggleExpand={() => toggleExpandDiscovery(discovery.feed_url)}
                                                />
                                            );
                                        })}
                                    </>
                                )}
                            </View>
                        )}
                    </View>
                </View>

                {/* Create Folder */}
                <View style={s.section}>
                    <SectionHeader title="Create Folder" />
                    <View style={s.inputRow}>
                        <Input
                            style={{ flex: 1, minWidth: 0 }}
                            placeholder="Folder name…"
                            value={newFolderName}
                            onChangeText={setNewFolderName}
                            accessibilityLabel="Folder name"
                        />
                        <Button
                            variant="secondary"
                            onPress={handleCreateFolder}
                            icon={<FolderIcon size={20} color={colors.text.primary} />}
                            style={{ width: 44, height: 44, paddingHorizontal: 0 }}
                        />
                    </View>
                </View>

                {/* Folders */}
                {folders.length > 0 && (
                    <View style={s.section}>
                        <SectionHeader title={`Folders (${folders.length})`} />
                        {folders.map((folder: Folder) => {
                            const isExpanded = expandedFolderIds.has(folder.id);
                            const folderFeeds = feeds.filter(f => f.folder_id === folder.id);

                            return (
                                <View key={folder.id}>
                                    <View style={s.feedItem}>
                                        <TouchableOpacity
                                            style={s.folderContent}
                                            onPress={() => toggleFolder(folder.id)}
                                            activeOpacity={0.7}
                                        >
                                            {isExpanded ? (
                                                <ChevronDown size={18} color={colors.text.tertiary} />
                                            ) : (
                                                <ChevronRight size={18} color={colors.text.tertiary} />
                                            )}
                                            <FolderIcon size={18} color={colors.secondary.DEFAULT} style={{ marginLeft: spacing.sm }} />
                                            <View style={s.feedInfo}>
                                                <Text style={s.feedTitle}>{folder.name}</Text>
                                                <Text style={s.feedUrl}>
                                                    {folderFeeds.length} feeds
                                                </Text>
                                            </View>
                                        </TouchableOpacity>
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

                                    {isExpanded && (
                                        <View style={{ paddingLeft: spacing.xl }}>
                                            {folderFeeds.map((feed) => {
                                                const healthStatus = getFeedHealth(feed);
                                                const isStale = healthStatus === 'stale';
                                                const isDead = healthStatus === 'dead';

                                                return (
                                                    <View key={feed.id} style={[s.feedItem, { borderLeftWidth: 3, borderLeftColor: colors.border.DEFAULT }]}>
                                                        <TouchableOpacity
                                                            style={s.feedContentClickable}
                                                            onPress={() => {
                                                                setFilter({ feed_id: feed.id, type: undefined, folder_id: undefined });
                                                                router.push('/(app)');
                                                            }}
                                                            activeOpacity={0.7}
                                                        >
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

                                                            <View style={s.feedInfo}>
                                                                <Text style={[s.feedTitle, feed.paused_at && s.feedTitlePaused]} numberOfLines={1}>{feed.title}</Text>
                                                                {feed.paused_at && (
                                                                    <View style={s.pausedBadge}>
                                                                        <Pause size={10} color={colors.warning} />
                                                                        <Text style={s.pausedBadgeText}>Paused</Text>
                                                                    </View>
                                                                )}
                                                                {feed.error_count > 0 && !feed.paused_at && (
                                                                    <View style={s.errorBadge}>
                                                                        <AlertTriangle size={10} color={colors.error} />
                                                                        <Text style={s.errorBadgeText}>Error</Text>
                                                                    </View>
                                                                )}
                                                            </View>
                                                        </TouchableOpacity>

                                                        <View style={s.feedActions}>
                                                            {feed.error_count > 0 ? (
                                                                <TouchableOpacity
                                                                    onPress={() => handleRetryFeed(feed.id, feed.title)}
                                                                    style={s.actionButton}
                                                                >
                                                                    <RefreshCw size={16} color={colors.error} />
                                                                </TouchableOpacity>
                                                            ) : (
                                                                <TouchableOpacity
                                                                    onPress={() => handleMoveFeed(feed)}
                                                                    style={s.actionButton}
                                                                >
                                                                    <FolderInput size={16} color={colors.text.tertiary} />
                                                                </TouchableOpacity>
                                                            )}
                                                            <TouchableOpacity
                                                                onPress={() => handleEditFeed(feed)}
                                                                style={s.actionButton}
                                                            >
                                                                <Edit2 size={16} color={colors.text.tertiary} />
                                                            </TouchableOpacity>
                                                            <TouchableOpacity
                                                                onPress={() => handleDeleteFeed(feed.id, feed.title)}
                                                                style={s.actionButton}
                                                            >
                                                                <Trash2 size={16} color={colors.text.tertiary} />
                                                            </TouchableOpacity>
                                                        </View>
                                                    </View>
                                                );
                                            })}
                                        </View>
                                    )}
                                </View>
                            );
                        })}
                    </View>
                )}

                {/* Feeds */}
                <View style={s.section}>
                    <SectionHeader title={`Feeds (${feedSearch.trim() ? `${filteredFeeds.length} / ${feeds.length}` : feeds.length})`} />
                    <View style={s.searchRow}>
                        <Input
                            placeholder="Search feeds…"
                            value={feedSearch}
                            onChangeText={setFeedSearch}
                            accessibilityLabel="Search feeds"
                            autoCorrect={false}
                            autoCapitalize="none"
                        />
                    </View>
                    {filteredFeeds.length === 0 ? (
                        <Text style={s.emptyText}>No feeds match your search.</Text>
                    ) : filteredFeeds.map((feed: Feed) => {
                        const healthStatus = getFeedHealth(feed);
                        const healthInfo = getFeedHealthInfo(feed);
                        const isStale = healthStatus === 'stale';
                        const isDead = healthStatus === 'dead';

                        return (
                            <View
                                key={feed.id}
                                style={[
                                    s.feedItem,
                                    feed.error_count > 0 && s.feedItemError,
                                    feed.paused_at && s.feedItemPaused,
                                    isStale && s.feedItemStale,
                                    isDead && s.feedItemDead,
                                    isBulkMode && selectedFeedIds.has(feed.id) && { backgroundColor: (colors.primary?.DEFAULT ?? colors.primary) + '11', borderColor: (colors.primary?.DEFAULT ?? colors.primary) + '44' }
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
                                            <View style={s.feedTypeBadge}>
                                                {getTypeIcon(feed.type)}
                                            </View>
                                            {feed.paused_at && (
                                                <Pause size={14} color={colors.warning} style={s.statusIcon} />
                                            )}
                                            {feed.error_count > 0 && !feed.paused_at && (
                                                <AlertTriangle size={14} color={colors.error} style={s.statusIcon} />
                                            )}
                                        </View>
                                        <Text style={[s.feedUrl, feed.folder_id && s.folderTextHighlight]} numberOfLines={1}>
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
                                        {isStale && !feed.paused_at && feed.error_count === 0 && (
                                            <View style={s.staleBadge}>
                                                <Clock size={10} color={colors.warning} />
                                                <Text style={s.staleBadgeText}>Stale</Text>
                                            </View>
                                        )}
                                        {isDead && !feed.paused_at && (
                                            <View style={s.deadBadge}>
                                                <Skull size={10} color="#6b7280" />
                                                <Text style={s.deadBadgeText}>Dead</Text>
                                            </View>
                                        )}
                                        <Text style={s.healthTime}>{healthInfo.lastFetched}</Text>
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
                        );
                    })}
                </View>

                {/* Data Management */}
                <View style={s.section}>
                    <SectionHeader title="Data Management" />
                    <View style={s.dataActions}>
                        <Button
                            title="Import OPML"
                            onPress={handleImportOpml}
                            loading={progressState.isActive && progressState.operation === 'import'}
                            disabled={progressState.isActive}
                            icon={!progressState.isActive ? <FileUp size={20} color={colors.text.inverse} /> : undefined}
                            style={{ flex: 1 }}
                        />

                        <Button
                            title="Export OPML"
                            variant="secondary"
                            onPress={handleExportOpml}
                            loading={isExporting}
                            disabled={isExporting}
                            icon={!isExporting ? <FileDown size={20} color={colors.text.primary} /> : undefined}
                            style={{ flex: 1 }}
                        />
                    </View>

                    {/* Refresh All Feeds button */}
                    <Button
                        title={`Refresh All Feeds (${feeds.length})`}
                        onPress={handleRefreshAll}
                        loading={progressState.isActive && progressState.operation === 'refresh'}
                        disabled={progressState.isActive || feeds.length === 0}
                        icon={!(progressState.isActive && progressState.operation === 'refresh') ? <RefreshCcw size={20} color={colors.text.inverse} /> : undefined}
                        style={{ marginTop: spacing.md, backgroundColor: colors.primary?.dark ?? colors.primary }}
                    />
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
                            {selectedFeedIds.size === visibleFeedCount ? 'Deselect All' : 'Select All'}
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
                        <Input
                            value={renameValue}
                            onChangeText={setRenameValue}
                            placeholder="Enter name…"
                            autoFocus={modalType === 'edit_feed' && isDesktop}
                            accessibilityLabel="Name"
                            style={{ marginBottom: spacing.xl }}
                        />

                        <View style={s.modalActions}>
                            <Button
                                title="Cancel"
                                variant="secondary"
                                onPress={() => setModalType(null)}
                                style={{ flex: 1 }}
                            />
                            <Button
                                title="Save"
                                onPress={submitRename}
                                style={{ flex: 1 }}
                            />
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Move Feed Modal */}
            <Modal
                visible={modalType === 'move_feed'}
                transparent
                animationType="slide"
                onRequestClose={() => setModalType(null)}
            >
                <View style={s.moveModalOverlay}>
                    <View style={s.moveModalContainer}>
                        {/* Header */}
                        <View style={s.moveModalHeader}>
                            <View style={s.moveModalHeaderContent}>
                                <Text style={s.moveModalTitle}>Move Feed</Text>
                                {selectedFeed && (
                                    <Text style={s.moveModalSubtitle} numberOfLines={1}>
                                        {selectedFeed.title}
                                    </Text>
                                )}
                            </View>
                            <TouchableOpacity
                                onPress={() => setModalType(null)}
                                style={s.moveModalClose}
                            >
                                <X size={24} color={colors.text.secondary} />
                            </TouchableOpacity>
                        </View>

                        {/* Folder List */}
                        <ScrollView
                            style={s.moveModalList}
                            showsVerticalScrollIndicator={false}
                            contentContainerStyle={s.moveModalListContent}
                        >
                            {/* No Folder Option */}
                            <TouchableOpacity
                                style={[
                                    s.moveModalOption,
                                    selectedFolderId === null && s.moveModalOptionSelected
                                ]}
                                onPress={() => setSelectedFolderId(null)}
                                activeOpacity={0.7}
                            >
                                <View style={[s.moveModalOptionIcon, { backgroundColor: colors.background.tertiary }]}>
                                    <FolderIcon size={20} color={colors.text.tertiary} />
                                </View>
                                <Text style={[s.moveModalOptionText, selectedFolderId === null && s.moveModalOptionTextSelected]}>
                                    No Folder
                                </Text>
                                {selectedFolderId === null && (
                                    <View style={s.moveModalCheck}>
                                        <Check size={18} color={colors.primary?.DEFAULT ?? colors.primary} />
                                    </View>
                                )}
                            </TouchableOpacity>

                            {/* Divider */}
                            <View style={s.moveModalDivider} />

                            {/* Folder Options */}
                            {folders.map((folder: Folder) => (
                                <TouchableOpacity
                                    key={folder.id}
                                    style={[
                                        s.moveModalOption,
                                        selectedFolderId === folder.id && s.moveModalOptionSelected
                                    ]}
                                    onPress={() => setSelectedFolderId(folder.id)}
                                    activeOpacity={0.7}
                                >
                                    <View style={[s.moveModalOptionIcon, { backgroundColor: colors.secondary.DEFAULT + '20' }]}>
                                        <FolderIcon size={20} color={colors.secondary.DEFAULT} />
                                    </View>
                                    <Text style={[s.moveModalOptionText, selectedFolderId === folder.id && s.moveModalOptionTextSelected]}>
                                        {folder.name}
                                    </Text>
                                    {selectedFolderId === folder.id && (
                                        <View style={s.moveModalCheck}>
                                            <Check size={18} color={colors.primary?.DEFAULT ?? colors.primary} />
                                        </View>
                                    )}
                                </TouchableOpacity>
                            ))}
                        </ScrollView>

                        {/* Bottom Actions */}
                        <View style={s.moveModalActions}>
                            <Button
                                title={`Move to ${selectedFolderId === null ? 'No Folder' : folders.find((f: Folder) => f.id === selectedFolderId)?.name || 'Selected Folder'}`}
                                onPress={submitMove}
                                style={{ flex: 1 }}
                            />
                        </View>
                    </View>
                </View>
            </Modal>

            {/* View Folder Modal */}
            <Modal
                visible={modalType === 'view_folder'}
                transparent
                animationType="fade"
                onRequestClose={() => setModalType(null)}
            >
                <View style={s.modalOverlay}>
                    <View style={s.viewFolderModal}>
                        {selectedFolder && (
                            <>
                                <View style={s.viewFolderHeader}>
                                    <FolderIcon size={24} color={colors.secondary.DEFAULT} />
                                    <Text style={s.viewFolderTitle}>{selectedFolder.name}</Text>
                                    <TouchableOpacity
                                        onPress={() => setModalType(null)}
                                        style={s.viewFolderClose}
                                    >
                                        <X size={20} color={colors.text.secondary} />
                                    </TouchableOpacity>
                                </View>

                                <Text style={s.viewFolderSubtitle}>
                                    {feeds.filter((f: Feed) => f.folder_id === selectedFolder.id).length} feeds
                                </Text>

                                <ScrollView style={s.viewFolderList} showsVerticalScrollIndicator={false}>
                                    {feeds
                                        .filter((f: Feed) => f.folder_id === selectedFolder.id)
                                        .map((feed: Feed) => (
                                            <TouchableOpacity
                                                key={feed.id}
                                                style={s.viewFolderFeedItem}
                                                onPress={() => {
                                                    setModalType(null);
                                                    setFilter({ feed_id: feed.id, type: undefined, folder_id: undefined });
                                                    router.push('/(app)');
                                                }}
                                            >
                                                {feed.icon_url ? (
                                                    <Image source={{ uri: feed.icon_url }} style={s.viewFolderFeedIcon} />
                                                ) : (
                                                    <View style={[s.viewFolderFeedIconPlaceholder, { backgroundColor: colors.background.tertiary }]}>
                                                        <Rss size={16} color={colors.text.tertiary} />
                                                    </View>
                                                )}
                                                <View style={s.viewFolderFeedInfo}>
                                                    <Text style={s.viewFolderFeedTitle} numberOfLines={1}>
                                                        {feed.title}
                                                    </Text>
                                                    <Text style={s.viewFolderFeedType}>
                                                        {feed.type}
                                                    </Text>
                                                </View>
                                                <ChevronRight size={16} color={colors.text.tertiary} />
                                            </TouchableOpacity>
                                        ))}
                                </ScrollView>

                                <Button
                                    title="Close"
                                    variant="secondary"
                                    onPress={() => setModalType(null)}
                                    style={{ marginTop: spacing.md }}
                                />
                            </>
                        )}
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

            {/* Preview Modal */}
            <Modal
                visible={!!previewFeed}
                transparent
                animationType="fade"
                onRequestClose={() => setPreviewFeed(null)}
            >
                <View style={s.modalOverlay}>
                    <View style={s.previewModal}>
                        {previewFeed && (
                            <>
                                <View style={s.previewHeader}>
                                    {previewFeed.icon_url ? (
                                        <Image source={{ uri: previewFeed.icon_url }} style={s.previewIcon} />
                                    ) : (
                                        <View style={[s.previewIconPlaceholder, { backgroundColor: colors.background.tertiary }]}>
                                            <Globe size={24} color={colors.text.tertiary} />
                                        </View>
                                    )}
                                    <View style={s.previewTitleContainer}>
                                        <Text style={s.previewTitle} numberOfLines={2}>
                                            {previewFeed.title}
                                        </Text>
                                        <TouchableOpacity
                                            onPress={() => openExternalLink(previewFeed.site_url || previewFeed.feed_url)}
                                        >
                                            <Text style={[s.previewUrl, s.previewLinkText]} numberOfLines={1}>
                                                {new URL(previewFeed.site_url || previewFeed.feed_url).hostname}
                                            </Text>
                                        </TouchableOpacity>
                                    </View>
                                    <TouchableOpacity
                                        onPress={() => setPreviewFeed(null)}
                                        style={s.previewClose}
                                    >
                                        <X size={20} color={colors.text.secondary} />
                                    </TouchableOpacity>
                                </View>

                                {/* Feed Metadata */}
                                <View style={s.previewMeta}>
                                    <View style={s.previewMetaRow}>
                                        <Text style={s.previewMetaLabel}>Feed Type</Text>
                                        <Text style={[s.previewMetaValue, { textTransform: 'capitalize' }]}>
                                            {previewFeed.type}
                                        </Text>
                                    </View>
                                    <View style={s.previewMetaRow}>
                                        <Text style={s.previewMetaLabel}>Confidence</Text>
                                        <Text style={s.previewMetaValue}>
                                            {Math.round(previewFeed.confidence * 100)}%
                                        </Text>
                                    </View>
                                    <View style={s.previewMetaRow}>
                                        <Text style={s.previewMetaLabel}>Feed URL</Text>
                                        <Text style={[s.previewMetaValue, { fontSize: 11 }]} numberOfLines={2}>
                                            {previewFeed.feed_url}
                                        </Text>
                                    </View>
                                    {previewFeed.site_url && (
                                        <View style={s.previewMetaRow}>
                                            <Text style={s.previewMetaLabel}>Website</Text>
                                            <TouchableOpacity
                                                onPress={() => openExternalLink(previewFeed.site_url!)}
                                                style={s.previewLink}
                                            >
                                                <Text style={[s.previewMetaValue, s.previewLinkText]} numberOfLines={1}>
                                                    {previewFeed.site_url}
                                                </Text>
                                            </TouchableOpacity>
                                        </View>
                                    )}
                                </View>

                                {isDuplicateFeed(previewFeed, feeds) && (
                                    <View style={s.previewDuplicateBanner}>
                                        <AlertCircle size={16} color={colors.status.warning} />
                                        <Text style={s.previewDuplicateText}>
                                            You&apos;re already subscribed to this feed
                                        </Text>
                                    </View>
                                )}

                                <View style={s.previewActions}>
                                    <Button
                                        title="Close"
                                        variant="secondary"
                                        onPress={() => setPreviewFeed(null)}
                                        style={{ flex: 1 }}
                                    />
                                    <Button
                                        title="Add Feed"
                                        onPress={() => {
                                            handleAddFeed(previewFeed);
                                            setPreviewFeed(null);
                                        }}
                                        disabled={isDuplicateFeed(previewFeed, feeds)}
                                        style={{ flex: 1 }}
                                    />
                                </View>
                            </>
                        )}
                    </View>
                </View>
            </Modal>
            {/* Mobile Sidebar */}
            {!isDesktop && (
                <>
                    {/* Backdrop */}
                    {showMenu && (
                        <TouchableOpacity
                            style={s.sidebarBackdrop}
                            activeOpacity={1}
                            onPress={() => {
                                setShowMenu(false);
                                Animated.timing(sidebarAnim, {
                                    toValue: -300,
                                    duration: 250,
                                    useNativeDriver: true,
                                }).start();
                            }}
                        />
                    )}
                    {/* Sidebar */}
                    <Animated.View
                        style={[
                            s.sidebarContainer,
                            {
                                transform: [{ translateX: sidebarAnim }],
                                width: 280,
                            },
                        ]}
                    >
                        <View style={{ alignItems: 'flex-end', padding: spacing.md }}>
                            <TouchableOpacity
                                onPress={() => {
                                    setShowMenu(false);
                                    Animated.timing(sidebarAnim, {
                                        toValue: -300,
                                        duration: 250,
                                        useNativeDriver: true,
                                    }).start();
                                }}
                                style={{ padding: spacing.sm }}
                                accessibilityLabel="Close menu"
                            >
                                <X size={24} color={colors.text.primary} />
                            </TouchableOpacity>
                        </View>
                        <Sidebar onNavigate={() => {
                            setShowMenu(false);
                            Animated.timing(sidebarAnim, {
                                toValue: -300,
                                duration: 250,
                                useNativeDriver: true,
                            }).start();
                        }} />
                    </Animated.View>
                </>
            )}
        </View>
    );
}

const styles = (colors: any) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background.primary,
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
    inputRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.sm,
        alignItems: 'center',
    },
    discoveries: {
        marginTop: spacing.lg,
    },
    discoveriesTitle: {
        fontSize: 13,
        color: colors.text.tertiary,
        marginBottom: spacing.sm,
    },
    groupSection: {
        marginBottom: spacing.lg,
    },
    groupHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        marginBottom: spacing.sm,
        paddingHorizontal: spacing.xs,
    },
    groupTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.text.primary,
        flex: 1,
    },
    groupCount: {
        fontSize: 12,
        color: colors.text.tertiary,
        backgroundColor: colors.background.tertiary,
        paddingHorizontal: spacing.sm,
        paddingVertical: 2,
        borderRadius: borderRadius.full,
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
    searchRow: {
        marginTop: spacing.sm,
        marginBottom: spacing.sm,
    },
    emptyText: {
        color: colors.text.tertiary,
        fontSize: 13,
        paddingVertical: spacing.sm,
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
    feedTypeBadge: {
        marginLeft: 4,
        opacity: 0.8,
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
        fontSize: 14,
        color: colors.text.secondary,
        marginBottom: spacing.sm,
    },
    modalActions: {
        flexDirection: 'row',
        gap: spacing.md,
    },
    modalCancel: {
        flex: 1,
        padding: spacing.md,
        alignItems: 'center',
        backgroundColor: colors.background.secondary,
        borderRadius: borderRadius.md,
    },
    modalCancelText: {
        fontSize: 16,
        color: colors.text.primary,
    },
    modalConfirm: {
        flex: 1,
        padding: spacing.md,
        alignItems: 'center',
        backgroundColor: colors.primary.DEFAULT,
        borderRadius: borderRadius.md,
    },
    modalConfirmText: {
        fontSize: 16,
        color: colors.text.inverse,
        fontWeight: '600',
    },
    // Add Feed section styles
    clearButton: {
        position: 'absolute',
        right: spacing.sm,
        top: '50%',
        transform: [{ translateY: -10 }],
        padding: spacing.xs,
    },
    emptyDiscoveries: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: spacing.xl,
        gap: spacing.md,
    },
    emptyTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: colors.text.secondary,
    },
    emptySubtitle: {
        fontSize: 14,
        color: colors.text.tertiary,
        textAlign: 'center',
    },
    // Preview Modal styles
    previewModal: {
        backgroundColor: colors.background.secondary,
        borderRadius: borderRadius.xl,
        padding: spacing.xl,
        maxHeight: '80%',
    },
    previewHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: spacing.lg,
    },
    previewIcon: {
        width: 56,
        height: 56,
        borderRadius: borderRadius.lg,
        marginRight: spacing.md,
    },
    previewIconPlaceholder: {
        width: 56,
        height: 56,
        borderRadius: borderRadius.lg,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: spacing.md,
    },
    previewTitleContainer: {
        flex: 1,
    },
    previewTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: colors.text.primary,
        marginBottom: 2,
    },
    previewUrl: {
        fontSize: 13,
        color: colors.text.tertiary,
    },
    previewClose: {
        padding: spacing.sm,
        marginLeft: spacing.sm,
    },
    previewSectionTitle: {
        fontSize: 13,
        fontWeight: '800',
        color: colors.text.tertiary,
        letterSpacing: 0.5,
        marginBottom: spacing.md,
        textTransform: 'uppercase',
    },
    previewLoader: {
        marginVertical: spacing.xl,
    },
    previewArticles: {
        gap: spacing.sm,
        marginBottom: spacing.lg,
    },
    previewArticle: {
        backgroundColor: colors.background.tertiary,
        padding: spacing.md,
        borderRadius: borderRadius.md,
    },
    previewArticleTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.text.primary,
        marginBottom: 2,
    },
    previewArticleDate: {
        fontSize: 12,
        color: colors.text.tertiary,
    },
    previewEmpty: {
        fontSize: 14,
        color: colors.text.tertiary,
        textAlign: 'center',
        marginVertical: spacing.xl,
    },
    previewActions: {
        flexDirection: 'row',
        gap: spacing.md,
    },
    previewMeta: {
        backgroundColor: colors.background.tertiary,
        borderRadius: borderRadius.lg,
        padding: spacing.md,
        marginBottom: spacing.lg,
        gap: spacing.sm,
    },
    previewMetaRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    previewMetaLabel: {
        fontSize: 13,
        fontWeight: '600',
        color: colors.text.tertiary,
        width: 80,
    },
    previewMetaValue: {
        flex: 1,
        fontSize: 13,
        fontWeight: '500',
        color: colors.text.primary,
        textAlign: 'right',
    },
    previewDuplicateBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.xs,
        backgroundColor: colors.status.warning + '15',
        padding: spacing.md,
        borderRadius: borderRadius.md,
        marginBottom: spacing.lg,
    },
    previewDuplicateText: {
        fontSize: 13,
        fontWeight: '600',
        color: colors.status.warning,
    },
    previewLink: {
        flex: 1,
    },
    previewLinkText: {
        color: colors.primary?.DEFAULT ?? colors.primary,
        textDecorationLine: 'underline',
    },
    // View Folder Modal styles
    viewFolderModal: {
        backgroundColor: colors.background.secondary,
        borderRadius: borderRadius.xl,
        padding: spacing.xl,
        maxHeight: '80%',
        width: '90%',
        maxWidth: 400,
    },
    viewFolderHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: spacing.sm,
    },
    viewFolderTitle: {
        flex: 1,
        fontSize: 20,
        fontWeight: '700',
        color: colors.text.primary,
        marginLeft: spacing.md,
    },
    viewFolderClose: {
        padding: spacing.sm,
    },
    viewFolderSubtitle: {
        fontSize: 14,
        color: colors.text.tertiary,
        marginBottom: spacing.lg,
        marginLeft: spacing.xl + 24, // Align with title
    },
    viewFolderList: {
        maxHeight: 300,
        marginBottom: spacing.md,
    },
    viewFolderFeedItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: spacing.md,
        backgroundColor: colors.background.tertiary,
        borderRadius: borderRadius.md,
        marginBottom: spacing.sm,
    },
    viewFolderFeedIcon: {
        width: 32,
        height: 32,
        borderRadius: borderRadius.md,
    },
    viewFolderFeedIconPlaceholder: {
        width: 32,
        height: 32,
        borderRadius: borderRadius.md,
        justifyContent: 'center',
        alignItems: 'center',
    },
    viewFolderFeedInfo: {
        flex: 1,
        marginLeft: spacing.md,
    },
    viewFolderFeedTitle: {
        fontSize: 15,
        fontWeight: '600',
        color: colors.text.primary,
    },
    viewFolderFeedType: {
        fontSize: 12,
        color: colors.text.tertiary,
        textTransform: 'capitalize',
        marginTop: 2,
    },
    // Move Feed Modal styles (mobile-optimized)
    moveModalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    moveModalContainer: {
        backgroundColor: colors.background.secondary,
        borderTopLeftRadius: borderRadius.xxl,
        borderTopRightRadius: borderRadius.xxl,
        maxHeight: '85%',
        paddingBottom: spacing.xl,
    },
    moveModalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: spacing.lg,
        borderBottomWidth: 1,
        borderBottomColor: colors.border.DEFAULT,
    },
    moveModalHeaderContent: {
        flex: 1,
    },
    moveModalTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: colors.text.primary,
    },
    moveModalSubtitle: {
        fontSize: 14,
        color: colors.text.tertiary,
        marginTop: 2,
    },
    moveModalClose: {
        padding: spacing.sm,
        marginLeft: spacing.sm,
    },
    moveModalList: {
        maxHeight: 400,
    },
    moveModalListContent: {
        paddingVertical: spacing.sm,
    },
    moveModalOption: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: spacing.md,
        marginHorizontal: spacing.lg,
        marginVertical: spacing.xs,
        borderRadius: borderRadius.lg,
        backgroundColor: colors.background.tertiary,
    },
    moveModalOptionSelected: {
        backgroundColor: (colors.primary?.DEFAULT ?? colors.primary) + '15',
        borderWidth: 2,
        borderColor: colors.primary?.DEFAULT ?? colors.primary,
    },
    moveModalOptionIcon: {
        width: 40,
        height: 40,
        borderRadius: borderRadius.full,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: spacing.md,
    },
    moveModalOptionText: {
        flex: 1,
        fontSize: 16,
        fontWeight: '600',
        color: colors.text.primary,
    },
    moveModalOptionTextSelected: {
        color: colors.primary?.DEFAULT ?? colors.primary,
        fontWeight: '700',
    },
    moveModalCheck: {
        marginLeft: spacing.sm,
    },
    moveModalDivider: {
        height: 1,
        backgroundColor: colors.border.DEFAULT,
        marginVertical: spacing.sm,
        marginHorizontal: spacing.lg,
    },
    moveModalActions: {
        padding: spacing.lg,
        paddingTop: spacing.md,
        borderTopWidth: 1,
        borderTopColor: colors.border.DEFAULT,
    },
    // Tab Switcher styles
    tabContainer: {
        flexDirection: 'row',
        backgroundColor: colors.background.secondary,
        borderRadius: borderRadius.lg,
        padding: 4,
        marginBottom: spacing.md,
        borderWidth: 1,
        borderColor: colors.border.DEFAULT,
    },
    tab: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.xs,
        paddingVertical: spacing.sm,
        borderRadius: borderRadius.md,
    },
    tabActive: {
        backgroundColor: colors.background.elevated,
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.1,
                shadowRadius: 2,
            },
            android: {
                elevation: 2,
            },
            web: {
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            },
        }),
    },
    tabText: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.text.secondary,
    },
    tabTextActive: {
        color: colors.primary?.DEFAULT ?? colors.primary,
        fontWeight: '700',
    },
    tabContentContainer: {
        minHeight: 200,
    },
    refreshRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.sm,
    },
    refreshButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
        borderRadius: borderRadius.md,
        backgroundColor: colors.background.secondary,
        borderWidth: 1,
        borderColor: colors.border.DEFAULT,
    },
    refreshButtonDisabled: {
        opacity: 0.6,
    },
    refreshButtonText: {
        fontSize: 13,
        fontWeight: '600',
        color: colors.primary?.DEFAULT ?? colors.primary,
    },
    // Missing Health Styles
    staleBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginTop: 4,
        alignSelf: 'flex-start',
        backgroundColor: '#f59e0b22',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: borderRadius.sm,
    },
    staleBadgeText: {
        fontSize: 11,
        color: '#f59e0b',
        fontWeight: '600',
    },
    deadBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginTop: 4,
        alignSelf: 'flex-start',
        backgroundColor: '#6b728022',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: borderRadius.sm,
    },
    deadBadgeText: {
        fontSize: 11,
        color: '#6b7280',
        fontWeight: '600',
    },
    healthTime: {
        fontSize: 11,
        color: colors.text.tertiary,
        marginTop: 4,
    },
    // Missing Filter Styles
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
    // Missing Bulk Styles
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
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 8,
            },
            android: {
                elevation: 8,
            },
            web: {
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            },
        }),
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
    // Mobile Sidebar
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
    feedItemStale: {
        borderLeftWidth: 3,
        borderLeftColor: '#f59e0b', // warning orange
    },
    feedItemDead: {
        borderLeftWidth: 3,
        borderLeftColor: '#6b7280', // gray
        opacity: 0.7,
    },
    sidebarBackdrop: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        zIndex: 900,
    },
    sidebarContainer: {
        position: 'absolute',
        top: 0,
        left: 0,
        bottom: 0,
        backgroundColor: colors.background.elevated,
        borderRightWidth: 1,
        borderRightColor: colors.border.DEFAULT,
        zIndex: 1000,
        shadowColor: '#000',
        shadowOffset: { width: 2, height: 0 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
        elevation: 5,
    },
    folderTextHighlight: {
        color: colors.primary.DEFAULT,
        fontWeight: '600',
    },
});
