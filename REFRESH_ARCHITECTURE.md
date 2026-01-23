# Refresh Architecture

This document explains how data refreshing works in the Feeds application.

## Philosophy

**Server-side scheduled refreshes + Client-side manual refresh only**

The backend scheduler handles all automatic feed refreshing at configured intervals. The frontend simply:
1. Loads data on app start
2. Allows manual refresh when user requests it
3. Syncs cross-device changes

## Architecture

### Backend Scheduler (Automatic Refreshes)

**Location:** `backend/src/services/scheduler.ts`

The backend runs a continuous scheduler that:
- Checks feeds every 60 seconds
- Refreshes feeds when their `next_fetch_at` time arrives
- Respects per-feed `refresh_interval_minutes` setting
- Processes feeds in batches (30 feeds at a time)
- Has circuit breaker for error handling

**This is the ONLY automatic refresh mechanism.** Feeds refresh automatically on the server at their configured intervals.

### Frontend (Initial Load + Manual Refresh)

**Initial Data Load:**
- `frontend/app/(app)/index.tsx` loads data once on mount
- Fetches feeds, folders, articles in parallel
- Applies sync changes for cross-device consistency
- No timers, no automatic refresh

**Manual Refresh:**
- User clicks refresh button in Timeline header
- User uses pull-to-refresh gesture
- Calls `refreshAllFeeds()` from feedStore
- Shows progress dialog with real-time updates via SSE
- Articles appear incrementally as feeds refresh
- Final sync ensures consistency

## Data Flow

### App Launch

```
1. index.tsx useEffect (runs once)
   └─> fetchFeeds(), fetchFolders(), fetchArticles(true) [parallel]
   └─> fetchChanges() → applySyncChanges()
2. User sees data
3. NO automatic refresh, NO timers, NO foreground refresh
```

### Manual Refresh (User Clicks Refresh Button)

```
1. User clicks refresh in Timeline header
2. refreshAllFeeds() [from feedStore]
   └─> SSE stream to backend /feeds-stream/refresh-multiple
   └─> Progress dialog appears
   └─> Progress updates (feed_refreshing, feed_complete)
   └─> Incremental article fetches as new articles arrive
   └─> Final fetch: fetchFeeds(), fetchFolders(), fetchArticles(true)
   └─> fetchChanges() → applySyncChanges()
```

### Background Server Refresh (Automatic)

```
1. Backend scheduler checks feeds every 60s
2. For each feed where current_time >= next_fetch_at:
   └─> Fetch RSS/Atom feed from source
   └─> Parse new articles
   └─> Save to database
   └─> Update feed.last_fetched_at
   └─> Calculate feed.next_fetch_at based on refresh_interval_minutes
3. Client sees new articles on next manual refresh or app restart
```

## Components

### Stores

**FeedStore (`useFeedStore`):**
- `fetchFeeds()` - Get all feeds from server
- `fetchFolders()` - Get folders and smart folders
- `refreshAllFeeds(ids?)` - Manual refresh with progress tracking (SSE)
- `refreshFeed(id)` - Refresh single feed

**ArticleStore (`useArticleStore`):**
- `fetchArticles(reset)` - Get articles with pagination

**Sync System (`lib/sync.ts`):**
- `fetchChanges()` - Get server changes since last sync
- `applySyncChanges()` - Apply changes to local stores

### Components

**Timeline:**
- Displays articles
- Refresh button in header
- Pull-to-refresh gesture
- Both trigger `refreshAllFeeds()`

**Sidebar:**
- Can refresh specific feed via context menu
- Calls `refreshFeed(id)`

## What Changed

### Before (Complex)
- ❌ `useRefresh` hook with automatic foreground refresh
- ❌ Client-side timer checking feed intervals every second
- ❌ Auto-refresh when countdown hits 0
- ❌ Foreground refresh with staleness tracking
- ❌ Multiple refresh entry points
- ❌ Complex coordination logic

### After (Simple)
- ✅ Single initial data load on mount
- ✅ Manual refresh only (button click, pull-to-refresh)
- ✅ Backend scheduler handles all automatic refreshes
- ✅ Client syncs changes from server
- ✅ No timers, no automatic client-side refresh
- ✅ Clear and simple

## Benefits

1. **Simpler Code:** No complex timer logic, no foreground refresh tracking
2. **Server Control:** All automatic refreshes controlled by backend scheduler
3. **Battery Efficient:** No client-side timers running continuously
4. **Predictable:** Backend refreshes feeds at configured intervals regardless of client state
5. **Reliable:** Server refresh continues even when app is closed

## How to Configure Refresh Intervals

1. **Backend Settings:** `backend/src/services/scheduler.ts`
   - `CHECK_INTERVAL`: How often scheduler checks (default: 60s)
   - `BATCH_SIZE`: How many feeds to process at once (default: 30)

2. **Per-Feed Intervals:** Each feed has `refresh_interval_minutes` setting
   - Backend uses this to calculate `next_fetch_at`
   - Default values set when feed is added

3. **Global Settings:** User can set default refresh interval in settings
   - Applied to new feeds when added
   - Can override per-feed later

## Debugging

**Backend Logs:**
```
[Scheduler] Running cycle (failures: 0)
[Scheduler] Refreshing feed: <feed_title>
[Scheduler] Feed refreshed successfully
```

**Frontend Logs:**
```
[App] Loading initial data...
[App] Initial data loaded
```

## Related Files

- `backend/src/services/scheduler.ts` - Backend scheduler (automatic refresh)
- `backend/src/services/feed-refresh.ts` - Feed fetching logic
- `frontend/app/(app)/index.tsx` - Initial data load
- `frontend/hooks/useTimeline.ts` - Timeline logic (manual refresh only)
- `frontend/stores/feedStore.ts` - Feed state and refresh functions
- `frontend/lib/sync.ts` - Cross-device sync system
