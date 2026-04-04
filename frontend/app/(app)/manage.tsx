import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useShallow } from 'zustand/react/shallow';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useArticleStore } from '@/stores/articleStore';
import { useFeedStore } from '@/stores/feedStore';
import { useToastStore } from '@/stores/toastStore';
import { borderRadius, spacing, useColors } from '@/theme';
import { Feed } from '@/services/api';

const quickFeeds = [
  { label: 'Hacker News', url: 'https://news.ycombinator.com/rss' },
  { label: 'The Verge', url: 'https://www.theverge.com/rss/index.xml' },
  { label: 'TechCrunch', url: 'https://techcrunch.com/feed/' },
  { label: 'Reddit Frontpage', url: 'https://www.reddit.com/.rss' },
];

export default function ManageScreen() {
  const router = useRouter();
  const colors = useColors();
  const s = useMemo(() => styles(colors), [colors]);
  const [url, setUrl] = useState('');
  const [adding, setAdding] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [feeds, folders, isLoading, fetchFeeds, fetchFolders, addFeed, deleteFeed] = useFeedStore(
    useShallow((state) => [
      state.feeds,
      state.folders,
      state.isLoading,
      state.fetchFeeds,
      state.fetchFolders,
      state.addFeed,
      state.deleteFeed,
    ])
  );
  const setFilter = useArticleStore((state) => state.setFilter);
  const showToast = useToastStore((state) => state.show);

  const load = useCallback(async () => {
    await Promise.all([fetchFeeds(), fetchFolders()]);
  }, [fetchFeeds, fetchFolders]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  const handleAdd = useCallback(
    async (candidate?: string) => {
      const nextUrl = (candidate ?? url).trim();
      if (!nextUrl) {
        showToast('Enter a feed URL', 'error');
        return;
      }

      setAdding(true);
      try {
        await addFeed(nextUrl);
        setUrl('');
        await load();
        showToast('Feed added', 'success');
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to add feed';
        showToast(message, 'error');
      } finally {
        setAdding(false);
      }
    },
    [addFeed, load, showToast, url]
  );

  const openFeed = useCallback(
    (feed: Feed) => {
      setFilter({
        feed_id: feed.id,
        folder_id: undefined,
        type: undefined,
        unread_only: true,
      });
      router.push('/(app)');
    },
    [router, setFilter]
  );

  const confirmDelete = useCallback(
    (feed: Feed) => {
      Alert.alert('Delete feed', `Remove "${feed.title}"?`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteFeed(feed.id);
              await load();
            } catch (error) {
              const message = error instanceof Error ? error.message : 'Failed to delete feed';
              showToast(message, 'error');
            }
          },
        },
      ]);
    },
    [deleteFeed, load, showToast]
  );

  return (
    <View style={s.screen}>
      <ScreenHeader title="Feeds" showBackButton={false} />
      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary.DEFAULT}
          />
        }
      >
        <View style={s.section}>
          <Text style={s.sectionTitle}>Add feed</Text>
          <Text style={s.helper}>
            Basic mode only. This screen is stripped back to stable feed add, load, and open actions.
          </Text>
          <Input
            value={url}
            onChangeText={setUrl}
            placeholder="Paste feed, channel, subreddit, or site URL"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Button
            title="Add Feed"
            onPress={() => void handleAdd()}
            loading={adding}
            style={s.addButton}
          />
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>Quick add</Text>
          <View style={s.quickGrid}>
            {quickFeeds.map((item) => (
              <TouchableOpacity
                key={item.url}
                style={s.quickCard}
                onPress={() => void handleAdd(item.url)}
                activeOpacity={0.8}
              >
                <Text style={s.quickLabel}>{item.label}</Text>
                <Text style={s.quickUrl} numberOfLines={1}>
                  {item.url}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={s.section}>
          <View style={s.sectionHeaderRow}>
            <Text style={s.sectionTitle}>Library</Text>
            <Text style={s.libraryMeta}>
              {feeds.length} feeds • {folders.length} folders
            </Text>
          </View>

          {isLoading && feeds.length === 0 ? (
            <Text style={s.helper}>Loading feeds…</Text>
          ) : feeds.length === 0 ? (
            <Text style={s.helper}>No feeds loaded yet.</Text>
          ) : (
            <View style={s.feedList}>
              {feeds.map((feed) => (
                <View key={feed.id} style={s.feedRow}>
                  <TouchableOpacity
                    style={s.feedMain}
                    onPress={() => openFeed(feed)}
                    activeOpacity={0.75}
                  >
                    <Text style={s.feedTitle} numberOfLines={1}>
                      {feed.title}
                    </Text>
                    <Text style={s.feedMeta} numberOfLines={1}>
                      {feed.type.toUpperCase()} • {feed.unread_count} unread
                    </Text>
                  </TouchableOpacity>
                  <Button
                    title="Delete"
                    variant="ghost"
                    onPress={() => confirmDelete(feed)}
                    textStyle={s.deleteText}
                  />
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = (colors: any) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: colors.background.primary,
    },
    scroll: {
      flex: 1,
    },
    content: {
      padding: spacing.lg,
      paddingBottom: spacing.xxl,
      gap: spacing.lg,
    },
    section: {
      backgroundColor: colors.background.secondary,
      borderWidth: 1,
      borderColor: colors.border.DEFAULT,
      borderRadius: borderRadius.lg,
      padding: spacing.lg,
      gap: spacing.md,
    },
    sectionTitle: {
      color: colors.text.primary,
      fontSize: 16,
      fontWeight: '700',
    },
    helper: {
      color: colors.text.secondary,
      fontSize: 13,
      lineHeight: 18,
    },
    addButton: {
      marginTop: spacing.xs,
    },
    quickGrid: {
      gap: spacing.sm,
    },
    quickCard: {
      backgroundColor: colors.background.elevated,
      borderWidth: 1,
      borderColor: colors.border.DEFAULT,
      borderRadius: borderRadius.md,
      padding: spacing.md,
      gap: spacing.xs,
    },
    quickLabel: {
      color: colors.text.primary,
      fontSize: 14,
      fontWeight: '600',
    },
    quickUrl: {
      color: colors.text.tertiary,
      fontSize: 12,
    },
    sectionHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: spacing.sm,
    },
    libraryMeta: {
      color: colors.text.tertiary,
      fontSize: 12,
      fontWeight: '500',
    },
    feedList: {
      gap: spacing.sm,
    },
    feedRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      backgroundColor: colors.background.elevated,
      borderWidth: 1,
      borderColor: colors.border.DEFAULT,
      borderRadius: borderRadius.md,
      paddingLeft: spacing.md,
      paddingRight: spacing.xs,
      paddingVertical: spacing.sm,
    },
    feedMain: {
      flex: 1,
      gap: 2,
      minWidth: 0,
    },
    feedTitle: {
      color: colors.text.primary,
      fontSize: 14,
      fontWeight: '600',
    },
    feedMeta: {
      color: colors.text.secondary,
      fontSize: 12,
    },
    deleteText: {
      color: colors.error,
    },
  });
