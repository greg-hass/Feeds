# Refresh Architecture

This document explains how data refreshing works in the Feeds application.

## Overview

The app uses a **centralized refresh system** via the `useRefresh` hook to ensure consistent data fetching across all screens and scenarios.

## Architecture Components

### 1. `useRefresh` Hook (Primary Coordinator)

**Location:** `frontend/hooks/useRefresh.ts`

**Responsibilities:**
- Coordinates all data fetching (feeds, folders, articles)
- Handles sync changes for cross-device consistency
- Manages foreground/background refresh logic
- Prevents duplicate refreshes
- Tracks staleness to avoid unnecessary API calls

**Usage:**
```typescript
// In app/(app)/index.tsx
useRefresh({
    staleThreshold: 5 * 60 * 1000, // 5 minutes
    enableForegroundRefresh: true,
    fetchOnMount: true,
});
```

**Refresh Types:**
- **Initial Load:** Runs once on mount, always fetches data
- **Foreground Refresh:** Runs when app becomes active, respects staleness
- **Manual Refresh:** User-triggered (pull-to-refresh, refresh button), always runs

### 2. Store-Level Refresh Functions

**FeedStore (`useFeedStore`):**
- `fetchFeeds()` - Get all feeds
- `fetchFolders()` - Get folders and smart folders
- `refreshAllFeeds(ids?)` - Refresh feed content with progress tracking
- `refreshFeed(id)` - Refresh single feed

**ArticleStore (`useArticleStore`):**
- `fetchArticles(reset)` - Get articles with pagination
  - `reset: true` - Start from beginning
  - `reset: false` - Load next page

**Sync System (`lib/sync.ts`):**
- `fetchChanges()` - Get server changes since last sync
- `applySyncChanges()` - Apply changes to local stores

### 3. Component-Level Usage

**Timeline/useTimeline:**
- Uses `refreshAllFeeds()` from feedStore for manual feed refresh
- Displays progress via `refreshProgress` state
- Auto-refreshes when scheduled time arrives
- Shows loading indicators during refresh

**Sidebar:**
- Triggers `refreshAllFeeds()` when user clicks refresh button
- Can refresh specific feed via `refreshFeed(id)`

## Data Flow

### Initial App Load

```
1. useRefresh (index.tsx)
   └─> fetchFeeds(), fetchFolders(), fetchArticles(true) [parallel]
   └─> fetchChanges() → applySyncChanges()
```

### Foreground Refresh (App Becomes Active)

```
1. useRefresh detects AppState change
2. Check staleness (< 5 minutes = skip)
3. If stale:
   └─> fetchFeeds(), fetchFolders(), fetchArticles(true) [parallel]
   └─> fetchChanges() → applySyncChanges()
```

### Manual Feed Refresh (User Clicks Refresh Button)

```
1. User clicks refresh in Timeline/Sidebar
2. refreshAllFeeds() [from feedStore]
   └─> SSE stream to backend /feeds-stream/refresh-multiple
   └─> Progress updates (feed_refreshing, feed_complete)
   └─> Incremental article fetches as new articles arrive
   └─> Final fetch: fetchFeeds(), fetchFolders(), fetchArticles(true)
   └─> fetchChanges() → applySyncChanges()
```

### Pull-to-Refresh (Timeline)

```
1. User pulls down on Timeline
2. Timeline triggers refreshAllFeeds()
3. [Same flow as Manual Feed Refresh above]
```

## Key Features

### 1. Deduplication
- `isRefreshingRef` in useRefresh prevents overlapping refreshes
- Only one refresh runs at a time

### 2. Staleness Tracking
- `lastRefreshRef` tracks when last refresh completed
- Silent refreshes skip if data fresh (< 5 minutes)
- Manual refreshes always run (force: true)

### 3. Progress Tracking
- `refreshProgress` in feedStore shows:
  - Total feeds to refresh
  - Completed count
  - Current feed title
- Real-time updates via SSE stream
- Throttled UI updates (300ms) to reduce re-renders

### 4. Incremental Updates
- During feed refresh, new articles appear immediately
- First new article: instant fetch for user feedback
- Subsequent articles: debounced (1s) to reduce load
- Final fetch ensures full sync

### 5. Cross-Device Sync
- After every refresh, `fetchChanges()` is called
- Server sends changes since last sync:
  - New/updated/deleted feeds
  - New/updated/deleted folders
  - New articles
  - Read state changes
- Changes applied to local stores
- Sync cursor saved for next sync

### 6. Error Handling
- Network errors logged but don't crash app
- Stores maintain their own error states
- Failed refreshes don't prevent future refreshes
- Abort errors (user lock/background) handled gracefully

## Timeline Behavior

### Automatic Refresh Timer

The Timeline shows a countdown timer for the next scheduled refresh:

```typescript
// In useTimeline.ts
useEffect(() => {
  setInterval(() => {
    // Find earliest next_fetch_at across all feeds
    // Display countdown: "2m 30s" or "1h 5m"
    // Auto-refresh when countdown hits 0
  }, 1000);
}, [feeds]);
```

When countdown reaches 0 and app is active:
1. Timer triggers `refreshAllFeeds()`
2. Progress dialog appears
3. Feeds refresh with real-time updates
4. Timeline updates as new articles arrive

## Best Practices

### For Components
✅ **DO:**
- Use `useRefresh()` for initial/foreground refresh
- Use `refreshAllFeeds()` for manual user-triggered refresh
- Show loading states during refresh
- Handle errors gracefully

❌ **DON'T:**
- Create custom refresh logic
- Fetch data without checking staleness
- Forget to call sync after refresh
- Trigger multiple refreshes in parallel

### For New Features
When adding new data types:
1. Add fetch function to appropriate store
2. Update `useRefresh` to include new fetch
3. Add sync handler for cross-device consistency
4. Update this documentation

## Debugging

### Common Issues

**Problem:** Data not refreshing
- Check: Is `useRefresh` enabled in index.tsx?
- Check: Network connectivity
- Check: Console logs for "[useRefresh]" messages

**Problem:** Duplicate fetches
- Check: Multiple `useRefresh` calls?
- Check: Components fetching independently?

**Problem:** Stale data after sync
- Check: Is `applySyncChanges` called after `fetchChanges`?
- Check: Sync cursor persisting correctly?

**Problem:** Refresh not triggered on foreground
- Check: `enableForegroundRefresh: true`?
- Check: Data staleness threshold

### Debug Logs

All refresh operations log to console with `[useRefresh]` prefix:
- `[useRefresh] Initial fetch on mount`
- `[useRefresh] App returned to foreground`
- `[useRefresh] Data is fresh, skipping`
- `[useRefresh] Starting refresh`
- `[useRefresh] Applying sync changes`
- `[useRefresh] Refresh completed successfully`

## Future Improvements

Potential enhancements to consider:

1. **Optimistic Updates:** Update UI before API confirms
2. **Offline Support:** Queue changes when offline, sync when online
3. **Selective Refresh:** Only refresh changed feeds
4. **Background Fetch:** Use native background fetch on iOS/Android
5. **WebSocket:** Real-time updates instead of polling
6. **Cache Invalidation:** Smart cache with TTL per data type

## Related Files

- `frontend/hooks/useRefresh.ts` - Main refresh coordinator
- `frontend/hooks/useTimeline.ts` - Timeline-specific refresh logic
- `frontend/stores/feedStore.ts` - Feed refresh and sync
- `frontend/stores/articleStore.ts` - Article fetching
- `frontend/lib/sync.ts` - Cross-device sync system
- `frontend/app/(app)/index.tsx` - App-level refresh setup
