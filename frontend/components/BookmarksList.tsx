import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Image,
  Animated,
  Platform,
  TextInput,
  ScrollView,
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { formatDistanceToNow } from 'date-fns';
import { api, Article, BookmarkFolder } from '@/services/api';
import { useArticleStore } from '@/stores';
import {
  Archive,
  AlertCircle,
  Bookmark,
  Circle,
  CircleCheck,
  FolderOpen,
  FolderPlus,
  Headphones,
  MoreVertical,
  Play,
  RefreshCw,
  Search,
  X,
} from 'lucide-react-native';
import { useColors, borderRadius, spacing } from '@/theme';
import { extractVideoId, getThumbnailUrl } from '@/utils/youtube';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { LoadingState } from '@/components/ui/LoadingState';
import Sidebar from '@/components/Sidebar';
import { EqualWidthPills, type EqualWidthPillItem } from '@/components/ui/EqualWidthPills';

interface BookmarksListProps {
  onArticlePress?: (article: Article) => void;
  activeArticleId?: number | null;
  isMobile?: boolean;
}

export default function BookmarksList({
  onArticlePress,
  activeArticleId,
  isMobile = false,
}: BookmarksListProps) {
  const colors = useColors();
  const useNativeDriver = Platform.OS !== 'web';
  const router = useRouter();
  const {
    bookmarkedArticles,
    bookmarkFolders,
    fetchBookmarks,
    isLoading,
    error,
    markRead,
  } = useArticleStore();

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [sidebarAnim] = useState(new Animated.Value(-300));
  const [query, setQuery] = useState('');
  const [archivedOnly, setArchivedOnly] = useState(false);
  const [selectedFolderId, setSelectedFolderId] = useState<number | undefined>(undefined);
  const [menuArticle, setMenuArticle] = useState<Article | null>(null);
  const [folderTargetArticle, setFolderTargetArticle] = useState<Article | null>(null);
  const [isFolderPickerOpen, setIsFolderPickerOpen] = useState(false);
  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderError, setNewFolderError] = useState<string | null>(null);

  const s = styles(colors, isMobile);

  const loadBookmarks = useCallback(() => {
    return fetchBookmarks({
      query: query.trim() || undefined,
      archived: archivedOnly,
      folderId: selectedFolderId,
    });
  }, [archivedOnly, fetchBookmarks, query, selectedFolderId]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadBookmarks();
    }, 250);

    return () => clearTimeout(timer);
  }, [loadBookmarks]);

  const toggleMenu = useCallback(() => {
    setShowMenu((prev) => {
      Animated.timing(sidebarAnim, {
        toValue: prev ? -300 : 0,
        duration: 250,
        useNativeDriver,
      }).start();
      return !prev;
    });
  }, [sidebarAnim, useNativeDriver]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await loadBookmarks();
    } finally {
      setIsRefreshing(false);
    }
  }, [loadBookmarks]);

  const handleMarkAllRead = useCallback(async () => {
    const unreadItems = bookmarkedArticles.filter((article) => !article.is_read);
    for (const article of unreadItems) {
      await markRead(article.id);
    }
  }, [bookmarkedArticles, markRead]);

  const handleArticlePress = useCallback((article: Article) => {
    void markRead(article.id);
    if (onArticlePress) {
      onArticlePress(article);
      return;
    }
    router.push(`/(app)/article/${article.id}`);
  }, [markRead, onArticlePress, router]);

  const headerActions = useMemo(() => [
    {
      icon: <RefreshCw size={20} color={colors.text.secondary} />,
      onPress: handleRefresh,
      loading: isRefreshing,
      accessibilityLabel: 'Refresh bookmarks',
    },
    {
      icon: <CircleCheck size={20} color={colors.text.secondary} />,
      onPress: handleMarkAllRead,
      accessibilityLabel: 'Mark all as read',
    },
  ], [colors.text.secondary, handleMarkAllRead, handleRefresh, isRefreshing]);

  const filterItems = useMemo<EqualWidthPillItem[]>(
    () => [
      {
        id: 'active',
        label: 'Active',
        active: !archivedOnly,
        onPress: () => setArchivedOnly(false),
      },
      {
        id: 'archived',
        label: 'Archived',
        active: archivedOnly,
        onPress: () => setArchivedOnly(true),
      },
    ],
    [archivedOnly],
  );

  const filteredFolders = useMemo(() => bookmarkFolders ?? [], [bookmarkFolders]);
  const selectedFolder = useMemo(
    () => filteredFolders.find((folder) => folder.id === selectedFolderId) ?? null,
    [filteredFolders, selectedFolderId],
  );

  const clearAllFilters = useCallback(() => {
    setQuery('');
    setArchivedOnly(false);
    setSelectedFolderId(undefined);
  }, []);

  const handleOpenMenu = (article: Article) => {
    setMenuArticle(article);
  };

  const applyBookmarkUpdate = useCallback(async (
    article: Article,
    updates: { folder_id?: number | null; archived?: boolean | null }
  ) => {
    await api.bookmarkArticle(article.id, true, {
      folder_id: updates.folder_id !== undefined ? updates.folder_id : (article.bookmark_folder_id ?? null),
      archived: updates.archived ?? (article.bookmark_archived_at ? true : false),
    });
    await loadBookmarks();
  }, [loadBookmarks]);

  const handleArchiveToggle = useCallback(async () => {
    if (!menuArticle) return;
    const article = menuArticle;
    const shouldArchive = !article.bookmark_archived_at;
    setMenuArticle(null);
    await applyBookmarkUpdate(article, { archived: shouldArchive });
  }, [applyBookmarkUpdate, menuArticle]);

  const handleMoveToFolder = useCallback(() => {
    if (!menuArticle) return;
    setFolderTargetArticle(menuArticle);
    setMenuArticle(null);
    setIsFolderPickerOpen(true);
  }, [menuArticle]);

  const handleRemoveBookmark = useCallback(async () => {
    if (!menuArticle) return;
    const article = menuArticle;
    setMenuArticle(null);
    await api.bookmarkArticle(article.id, false);
    await loadBookmarks();
  }, [loadBookmarks, menuArticle]);

  const handleCreateFolder = useCallback(async () => {
    const name = newFolderName.trim();
    if (!name) {
      setNewFolderError('Folder name cannot be empty');
      return;
    }

    const folder = await api.createBookmarkFolder(name);
    setNewFolderName('');
    setNewFolderError(null);
    setIsFolderModalOpen(false);

    if (folderTargetArticle) {
      const article = folderTargetArticle;
      setFolderTargetArticle(null);
      await applyBookmarkUpdate(article, { folder_id: folder.id });
      setIsFolderPickerOpen(false);
      return;
    }

    await loadBookmarks();
  }, [applyBookmarkUpdate, folderTargetArticle, loadBookmarks, newFolderName]);

  const handleSelectFolder = useCallback(async (folder: BookmarkFolder | null) => {
    if (!folderTargetArticle) return;
    const article = folderTargetArticle;
    setFolderTargetArticle(null);
    setIsFolderPickerOpen(false);
    await applyBookmarkUpdate(article, { folder_id: folder?.id ?? null });
  }, [applyBookmarkUpdate, folderTargetArticle]);

  const openFolderCreator = useCallback(() => {
    setIsFolderPickerOpen(false);
    setNewFolderName('');
    setNewFolderError(null);
    setIsFolderModalOpen(true);
  }, []);

  const getArticleThumbnail = (item: Article): string | null => {
    if (item.feed_type === 'youtube') {
      const videoId = extractVideoId(item.url || item.thumbnail_url || '');
      if (videoId) return getThumbnailUrl(videoId, isMobile ? 'hq' : 'maxres');
    }
    return item.thumbnail_url || null;
  };

  const renderArticle = ({ item }: { item: Article }) => {
    const thumbnail = getArticleThumbnail(item);
    const isYouTube = item.feed_type === 'youtube';
    const isActive = activeArticleId === item.id;
    const isArchived = !!item.bookmark_archived_at;

    return (
      <TouchableOpacity
        style={[
          s.articleCard,
          item.is_read && s.articleRead,
          isActive && s.articleActive,
          isArchived && s.articleArchived,
        ]}
        onPress={() => handleArticlePress(item)}
        activeOpacity={0.85}
      >
        <View style={isMobile ? s.articleColumnLayout : s.articleRowLayout}>
          <View style={s.articleContent}>
            <View style={s.articleHeader}>
              <View style={s.articleHeaderLeft}>
                <Text style={s.feedName} numberOfLines={1}>
                  {item.feed_title}
                </Text>
                {item.bookmark_folder_name ? (
                  <View style={s.folderBadge}>
                    <FolderOpen size={12} color={colors.primary.DEFAULT} />
                    <Text style={s.folderBadgeText} numberOfLines={1}>
                      {item.bookmark_folder_name}
                    </Text>
                  </View>
                ) : null}
              </View>
              <View style={s.articleHeaderActions}>
                {item.has_audio ? <Headphones size={14} color={colors.secondary.DEFAULT} /> : null}
                {isArchived ? (
                  <View style={s.archivedBadge}>
                    <Archive size={10} color={colors.text.secondary} />
                    <Text style={s.archivedBadgeText}>Archived</Text>
                  </View>
                ) : null}
                <TouchableOpacity
                  onPress={() => handleOpenMenu(item)}
                  accessibilityLabel={`Bookmark actions for ${item.title}`}
                  style={s.moreButton}
                >
                  <MoreVertical size={16} color={colors.text.tertiary} />
                </TouchableOpacity>
              </View>
            </View>

            <Text
              style={[s.articleTitle, item.is_read && s.articleTitleRead]}
              numberOfLines={2}
            >
              {!item.is_read && (
                <Circle
                  size={8}
                  color={colors.primary.DEFAULT}
                  fill={colors.primary.DEFAULT}
                  style={{ marginRight: 6 }}
                />
              )}
              {item.title}
            </Text>

            {isMobile && thumbnail ? (
              <View style={s.thumbnailContainerMobile}>
                <Image
                  source={{ uri: thumbnail }}
                  style={s.thumbnailMobile}
                  resizeMode="cover"
                />
                {isYouTube ? (
                  <View style={s.playOverlay}>
                    <Play size={32} color={colors.text.inverse} fill="#fff" />
                  </View>
                ) : null}
              </View>
            ) : null}

            {item.summary ? (
              <Text style={s.articleSummary} numberOfLines={2}>
                {item.summary}
              </Text>
            ) : null}

            {item.bookmark_note ? (
              <Text style={s.articleNote} numberOfLines={1}>
                {item.bookmark_note}
              </Text>
            ) : null}

            <Text style={s.articleMeta}>
              {item.author ? `${item.author} • ` : ''}
              {item.published_at
                ? formatDistanceToNow(new Date(item.published_at), { addSuffix: true })
                : ''}
            </Text>
          </View>

          {!isMobile && thumbnail ? (
            <View style={s.thumbnailContainerDesktop}>
              <Image
                source={{ uri: thumbnail }}
                style={s.thumbnailDesktop}
                resizeMode="cover"
              />
              {isYouTube ? (
                <View style={s.playOverlaySmall}>
                  <Play size={20} color={colors.text.inverse} fill="#fff" />
                </View>
              ) : null}
            </View>
          ) : null}
        </View>
      </TouchableOpacity>
    );
  };

  const emptyState = (
    <View style={s.empty}>
      <Bookmark size={48} color={colors.text.tertiary} />
      <Text style={s.emptyTitle}>No bookmarks yet</Text>
      <Text style={s.emptyText}>Bookmark articles to save them here</Text>
    </View>
  );

  const content = (
    <FlatList
      data={bookmarkedArticles}
      keyExtractor={(item) => String(item.id)}
      renderItem={renderArticle}
      contentContainerStyle={s.list}
      ItemSeparatorComponent={() => <View style={s.separator} />}
      ListEmptyComponent={emptyState}
      keyboardShouldPersistTaps="handled"
    />
  );

  return (
    <View style={s.container}>
      <ScreenHeader
        title="Saved"
        showBackButton={false}
        showMenuButton={isMobile}
        onMenuPress={toggleMenu}
        isRefreshing={isRefreshing}
        rightActions={headerActions}
      />

      <View style={s.filtersContainer}>
        <View style={s.searchRow}>
          <Search size={16} color={colors.text.tertiary} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search saved articles"
            placeholderTextColor={colors.text.tertiary}
            style={s.searchInput}
            returnKeyType="search"
            autoCapitalize="none"
            autoCorrect={false}
          />
          {query.length > 0 ? (
            <TouchableOpacity onPress={() => setQuery('')} accessibilityLabel="Clear saved search">
              <X size={16} color={colors.text.tertiary} />
            </TouchableOpacity>
          ) : null}
        </View>

        <EqualWidthPills
          items={filterItems}
          containerStyle={s.equalPillContainer}
          rowStyle={s.equalPillRow}
          textSize={12}
        />

        {(query.trim() || archivedOnly || selectedFolder) ? (
          <View style={s.activeFilterRow}>
            <TouchableOpacity
              style={s.clearFiltersButton}
              onPress={clearAllFilters}
              accessibilityLabel="Clear all saved filters"
            >
              <X size={13} color={colors.text.tertiary} />
              <Text style={s.clearFiltersText}>Clear filters</Text>
            </TouchableOpacity>

            {query.trim() ? (
              <View style={s.activeFilterChip}>
                <Search size={13} color={colors.primary.DEFAULT} />
                <Text style={s.activeFilterChipText} numberOfLines={1}>
                  {query.trim()}
                </Text>
                <TouchableOpacity
                  onPress={() => setQuery('')}
                  accessibilityLabel="Clear saved search query"
                >
                  <X size={13} color={colors.text.tertiary} />
                </TouchableOpacity>
              </View>
            ) : null}

            {archivedOnly ? (
              <View style={s.activeFilterChip}>
                <Archive size={13} color={colors.primary.DEFAULT} />
                <Text style={s.activeFilterChipText}>Archived</Text>
                <TouchableOpacity
                  onPress={() => setArchivedOnly(false)}
                  accessibilityLabel="Clear archived filter"
                >
                  <X size={13} color={colors.text.tertiary} />
                </TouchableOpacity>
              </View>
            ) : null}

            {selectedFolder ? (
              <View style={s.activeFilterChip}>
                <FolderOpen size={13} color={colors.primary.DEFAULT} />
                <Text style={s.activeFilterChipText} numberOfLines={1}>
                  {selectedFolder.name}
                </Text>
                <TouchableOpacity
                  onPress={() => setSelectedFolderId(undefined)}
                  accessibilityLabel="Clear folder filter"
                >
                  <X size={13} color={colors.text.tertiary} />
                </TouchableOpacity>
              </View>
            ) : null}
          </View>
        ) : null}

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.folderScroll}
        >
          <TouchableOpacity
            style={[s.folderChip, selectedFolderId === undefined && s.folderChipActive]}
            onPress={() => setSelectedFolderId(undefined)}
            accessibilityRole="button"
            accessibilityState={{ selected: selectedFolderId === undefined }}
          >
            <Text
              style={[
                s.folderChipText,
                selectedFolderId === undefined && s.folderChipTextActive,
              ]}
            >
              All folders
            </Text>
          </TouchableOpacity>

          {filteredFolders.map((folder) => (
            <TouchableOpacity
              key={folder.id}
              style={[s.folderChip, selectedFolderId === folder.id && s.folderChipActive]}
              onPress={() => setSelectedFolderId(folder.id)}
              accessibilityRole="button"
              accessibilityState={{ selected: selectedFolderId === folder.id }}
            >
              <Text
                style={[
                  s.folderChipText,
                  selectedFolderId === folder.id && s.folderChipTextActive,
                ]}
              >
                {folder.name}
                {folder.bookmark_count !== undefined ? ` (${folder.bookmark_count})` : ''}
              </Text>
            </TouchableOpacity>
          ))}

          <TouchableOpacity
            style={s.newFolderChip}
            onPress={() => {
              setNewFolderName('');
              setNewFolderError(null);
              setIsFolderModalOpen(true);
            }}
            accessibilityRole="button"
            accessibilityLabel="Create new bookmark folder"
          >
            <FolderPlus size={14} color={colors.primary.DEFAULT} />
            <Text style={s.newFolderChipText}>New folder</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {isLoading && bookmarkedArticles.length === 0 ? (
        <View style={s.loadingContainer}>
          <LoadingState variant="skeleton" count={3} />
        </View>
      ) : error ? (
        <View style={s.errorContainer}>
          <AlertCircle size={48} color={colors.status.error} />
          <Text style={s.errorTitle}>Failed to load bookmarks</Text>
          <Text style={s.errorText}>{error}</Text>
          <TouchableOpacity style={s.retryButton} onPress={() => void handleRefresh()}>
            <RefreshCw size={18} color={colors.text.inverse} />
            <Text style={s.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      ) : content}

      <Modal
        visible={!!menuArticle}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuArticle(null)}
      >
        <View style={s.sheetOverlay}>
          <TouchableOpacity style={s.sheetBackdrop} activeOpacity={1} onPress={() => setMenuArticle(null)} />
          <View style={s.sheetCard}>
            <Text style={s.sheetTitle} numberOfLines={2}>
              {menuArticle?.title}
            </Text>
            <TouchableOpacity style={s.sheetButton} onPress={handleMoveToFolder}>
              <FolderOpen size={18} color={colors.text.primary} />
              <Text style={s.sheetButtonText}>Move to folder</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.sheetButton} onPress={() => void handleArchiveToggle()}>
              <Archive size={18} color={colors.text.primary} />
              <Text style={s.sheetButtonText}>
                {menuArticle?.bookmark_archived_at ? 'Unarchive' : 'Archive'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.sheetButtonDanger} onPress={() => void handleRemoveBookmark()}>
              <Text style={s.sheetButtonDangerText}>Remove bookmark</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={isFolderPickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsFolderPickerOpen(false)}
      >
        <View style={s.sheetOverlay}>
          <TouchableOpacity style={s.sheetBackdrop} activeOpacity={1} onPress={() => setIsFolderPickerOpen(false)} />
          <View style={s.sheetCard}>
            <Text style={s.sheetTitle}>Move to folder</Text>
            <TouchableOpacity style={s.sheetButton} onPress={() => void handleSelectFolder(null)}>
              <Text style={s.sheetButtonText}>No folder</Text>
            </TouchableOpacity>
            <ScrollView style={s.folderPickerList} showsVerticalScrollIndicator={false}>
              {filteredFolders.map((folder) => (
                <TouchableOpacity
                  key={folder.id}
                  style={s.sheetButton}
                  onPress={() => void handleSelectFolder(folder)}
                >
                  <Text style={s.sheetButtonText}>{folder.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={s.sheetButton} onPress={openFolderCreator}>
              <FolderPlus size={18} color={colors.text.primary} />
              <Text style={s.sheetButtonText}>New folder…</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={isFolderModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsFolderModalOpen(false)}
      >
        <View style={s.sheetOverlay}>
          <TouchableOpacity style={s.sheetBackdrop} activeOpacity={1} onPress={() => setIsFolderModalOpen(false)} />
          <View style={s.sheetCard}>
            <Text style={s.sheetTitle}>Create folder</Text>
            <TextInput
              value={newFolderName}
              onChangeText={(text) => {
                setNewFolderName(text);
                if (newFolderError) setNewFolderError(null);
              }}
              placeholder="Folder name"
              placeholderTextColor={colors.text.tertiary}
              style={s.folderInput}
              autoFocus
            />
            {newFolderError ? <Text style={s.folderError}>{newFolderError}</Text> : null}
            <View style={s.sheetActions}>
              <TouchableOpacity style={s.sheetSecondaryButton} onPress={() => setIsFolderModalOpen(false)}>
                <Text style={s.sheetSecondaryButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.sheetPrimaryButton} onPress={() => void handleCreateFolder()}>
                <Text style={s.sheetPrimaryButtonText}>Create</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {isMobile ? (
        <>
          {showMenu ? (
            <TouchableOpacity
              style={s.sidebarBackdrop}
              activeOpacity={1}
              onPress={toggleMenu}
            />
          ) : null}
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
                onPress={toggleMenu}
                style={{ padding: spacing.sm }}
                accessibilityLabel="Close menu"
              >
                <X size={24} color={colors.text.primary} />
              </TouchableOpacity>
            </View>
            <Sidebar onNavigate={toggleMenu} />
          </Animated.View>
        </>
      ) : null}
    </View>
  );
}

const styles = (colors: any, isMobile: boolean = false) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background.primary,
    },
    filtersContainer: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
      paddingBottom: spacing.sm,
      gap: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border.DEFAULT,
      backgroundColor: colors.background.primary,
    },
    searchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      backgroundColor: colors.background.secondary,
      borderWidth: 1,
      borderColor: colors.border.DEFAULT,
      borderRadius: borderRadius.lg,
      paddingHorizontal: spacing.md,
      height: 48,
    },
    searchInput: {
      flex: 1,
      color: colors.text.primary,
      fontSize: 15,
      fontWeight: '600',
    },
    equalPillContainer: {
      width: '100%',
    },
    equalPillRow: {
        gap: spacing.sm,
    },
    activeFilterRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.sm,
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
    activeFilterChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
        borderRadius: borderRadius.full,
        backgroundColor: colors.background.secondary,
        borderWidth: 1,
        borderColor: colors.primary.DEFAULT,
        maxWidth: 220,
    },
    activeFilterChipText: {
        flexShrink: 1,
        fontSize: 12,
        fontWeight: '700',
        color: colors.text.primary,
    },
    folderScroll: {
        gap: spacing.sm,
        alignItems: 'center',
        paddingVertical: 2,
    },
    folderChip: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      borderRadius: borderRadius.full,
      backgroundColor: colors.background.secondary,
      borderWidth: 1,
      borderColor: colors.border.DEFAULT,
    },
    folderChipActive: {
      backgroundColor: colors.primary.DEFAULT,
      borderColor: colors.primary.DEFAULT,
    },
    folderChipText: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.text.secondary,
    },
    folderChipTextActive: {
      color: colors.text.inverse,
    },
    newFolderChip: {
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
    newFolderChipText: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.primary.DEFAULT,
    },
    list: {
      padding: spacing.lg,
      paddingBottom: spacing.xl,
    },
    loadingContainer: {
      flex: 1,
      paddingTop: spacing.sm,
    },
    articleCard: {
      backgroundColor: colors.background.secondary,
      borderRadius: borderRadius.lg,
      padding: spacing.md,
    },
    articleRead: {
      opacity: 0.6,
    },
    articleArchived: {
      borderWidth: 1,
      borderColor: colors.border.DEFAULT,
      backgroundColor: colors.background.elevated,
    },
    articleActive: {
      backgroundColor: colors.primary.soft || `${colors.primary.DEFAULT}15`,
      borderWidth: 1,
      borderColor: colors.primary.DEFAULT,
    },
    articleRowLayout: {
      flexDirection: 'row',
      gap: spacing.md,
    },
    articleColumnLayout: {
      flexDirection: 'column',
    },
    articleContent: {
      flex: 1,
    },
    articleHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: spacing.sm,
      marginBottom: spacing.xs,
    },
    articleHeaderLeft: {
      flex: 1,
      gap: spacing.xs,
    },
    articleHeaderActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      flexShrink: 0,
    },
    feedName: {
      fontSize: 11,
      color: colors.secondary.DEFAULT,
      fontWeight: '700',
      flexShrink: 1,
    },
    folderBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: spacing.xs,
      paddingVertical: 2,
      borderRadius: borderRadius.full,
      backgroundColor: `${colors.primary.DEFAULT}18`,
      alignSelf: 'flex-start',
      maxWidth: 140,
    },
    folderBadgeText: {
      fontSize: 10,
      fontWeight: '700',
      color: colors.primary.DEFAULT,
      maxWidth: 110,
    },
    archivedBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: spacing.xs,
      paddingVertical: 2,
      borderRadius: borderRadius.full,
      backgroundColor: colors.background.tertiary,
    },
    archivedBadgeText: {
      fontSize: 10,
      color: colors.text.secondary,
      fontWeight: '700',
    },
    moreButton: {
      padding: 4,
      borderRadius: borderRadius.full,
    },
    articleTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text.primary,
      lineHeight: 22,
      marginBottom: spacing.xs,
    },
    articleTitleRead: {
      color: colors.text.secondary,
    },
    articleSummary: {
      fontSize: 14,
      color: colors.text.secondary,
      lineHeight: 20,
      marginBottom: spacing.xs,
    },
    articleNote: {
      fontSize: 12,
      color: colors.text.tertiary,
      lineHeight: 18,
      marginBottom: spacing.xs,
      fontStyle: 'italic',
    },
    articleMeta: {
      fontSize: 12,
      color: colors.text.tertiary,
      fontWeight: '600',
    },
    thumbnailContainerDesktop: {
      width: 96,
      marginLeft: spacing.sm,
      position: 'relative',
    },
    thumbnailDesktop: {
      width: 96,
      height: 72,
      borderRadius: borderRadius.md,
    },
    thumbnailContainerMobile: {
      marginTop: spacing.sm,
      position: 'relative',
    },
    thumbnailMobile: {
      width: '100%',
      height: 180,
      borderRadius: borderRadius.md,
    },
    playOverlay: {
      position: 'absolute',
      top: '50%',
      left: '50%',
      transform: [{ translateX: -24 }, { translateY: -24 }],
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: 'rgba(0,0,0,0.4)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    playOverlaySmall: {
      position: 'absolute',
      right: 8,
      bottom: 8,
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: 'rgba(0,0,0,0.4)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    separator: {
      height: spacing.md,
    },
    empty: {
      alignItems: 'center',
      paddingVertical: 100,
      paddingHorizontal: spacing.xxl,
    },
    emptyTitle: {
      fontSize: 22,
      fontWeight: '800',
      color: colors.text.primary,
      marginBottom: spacing.sm,
      letterSpacing: -0.5,
    },
    emptyText: {
      fontSize: 15,
      color: colors.text.tertiary,
      textAlign: 'center',
      lineHeight: 24,
      fontWeight: '500',
      maxWidth: 320,
    },
    errorContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing.xl,
      gap: spacing.md,
    },
    errorTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text.primary,
    },
    errorText: {
      fontSize: 14,
      color: colors.text.secondary,
      textAlign: 'center',
    },
    retryButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      backgroundColor: colors.primary.DEFAULT,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      borderRadius: borderRadius.full,
    },
    retryButtonText: {
      color: colors.text.inverse,
      fontWeight: '700',
    },
    sidebarBackdrop: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)',
      zIndex: 10,
    },
    sidebarContainer: {
      position: 'absolute',
      top: 0,
      left: 0,
      bottom: 0,
      zIndex: 11,
      backgroundColor: colors.background.primary,
      borderRightWidth: 1,
      borderRightColor: colors.border.DEFAULT,
    },
    sheetOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.55)',
      justifyContent: 'flex-end',
    },
    sheetBackdrop: {
      flex: 1,
    },
    sheetCard: {
      backgroundColor: colors.background.primary,
      borderTopLeftRadius: borderRadius.xl,
      borderTopRightRadius: borderRadius.xl,
      padding: spacing.lg,
      gap: spacing.md,
      borderTopWidth: 1,
      borderColor: colors.border.DEFAULT,
    },
    sheetTitle: {
      fontSize: 18,
      fontWeight: '800',
      color: colors.text.primary,
    },
    sheetButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.sm,
      borderRadius: borderRadius.lg,
      backgroundColor: colors.background.secondary,
    },
    sheetButtonText: {
      fontSize: 15,
      color: colors.text.primary,
      fontWeight: '700',
    },
    sheetButtonDanger: {
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.sm,
      borderRadius: borderRadius.lg,
      backgroundColor: `${colors.status.error}18`,
      alignItems: 'center',
    },
    sheetButtonDangerText: {
      color: colors.status.error,
      fontWeight: '800',
      fontSize: 15,
    },
    sheetActions: {
      flexDirection: 'row',
      gap: spacing.sm,
      justifyContent: 'flex-end',
    },
    sheetSecondaryButton: {
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      borderRadius: borderRadius.full,
      backgroundColor: colors.background.secondary,
    },
    sheetSecondaryButtonText: {
      color: colors.text.primary,
      fontWeight: '700',
    },
    sheetPrimaryButton: {
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      borderRadius: borderRadius.full,
      backgroundColor: colors.primary.DEFAULT,
    },
    sheetPrimaryButtonText: {
      color: colors.text.inverse,
      fontWeight: '800',
    },
    folderPickerList: {
      maxHeight: 240,
    },
    folderInput: {
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
    folderError: {
      color: colors.status.error,
      fontSize: 12,
      fontWeight: '600',
    },
  });
