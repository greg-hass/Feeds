# Feed Refresh Performance Improvements

## Problem
Feed refresh was extremely slow, especially with 240+ feeds. Each refresh cycle involved hundreds of redundant database queries and conservative concurrency limits.

## Optimizations Applied

### 1. **Bulk Icon Status Prefetching** (feeds-stream.ts:66-79)
**Before**: Each feed made an individual database query to check icon cache status
```typescript
// Inside refreshFeed() - called 240 times
const existingIcon = queryOne('SELECT icon_url, icon_cached_path FROM feeds WHERE id = ?', [feed.id]);
```

**After**: Single bulk query fetches all icon statuses upfront
```typescript
// In feeds-stream.ts - called once
const feeds = queryAll(`
  SELECT id, title, url, type, refresh_interval_minutes, user_id, icon_url, icon_cached_path
  FROM feeds WHERE user_id = ? AND deleted_at IS NULL
`, [userId]);
```

**Impact**: Eliminated 240+ database roundtrips

---

### 2. **Increased Batch Concurrency** (feeds-stream.ts:132)
**Before**: Processed 20 feeds concurrently per batch
```typescript
const BATCH_SIZE = 20;
```

**After**: Processes 50 feeds concurrently
```typescript
const BATCH_SIZE = 50; // Increased from 20
```

**Why safe now**: Icon lookups no longer create database contention, content is lazy-loaded, thumbnails are fire-and-forget.

**Impact**: 2.5x more concurrent network requests

---

### 3. **Faster Failure Recovery** (feeds-stream.ts:39)
**Before**: Waited 30 seconds for slow/dead feeds to timeout
```typescript
const FEED_REFRESH_TIMEOUT = 30_000; // 30 seconds
```

**After**: Fails fast after 15 seconds
```typescript
const FEED_REFRESH_TIMEOUT = 15_000; // 15 seconds
```

**Impact**: Slow feeds don't block entire batches as long

---

### 4. **Backward Compatible Architecture** (feed-refresh.ts:85-88)
Extended interface allows both optimized batch refresh and traditional single-feed refresh:

```typescript
export interface FeedToRefreshWithCache extends FeedToRefresh {
    hasValidIcon?: boolean;  // Pre-fetched from batch query
    userId?: number;          // Pre-fetched from batch query
}
```

Single feed refreshes (via API endpoint) still work with fallback queries.

---

## Performance Expectations

### For 240 Feeds:
- **Database Queries**: 241 → 1 (99.6% reduction)
- **Max Concurrent Feeds**: 20 → 50 (2.5x increase)
- **Timeout Per Slow Feed**: 30s → 15s (2x faster failure)

### Estimated Speedup:
**~60-70% faster** for large feed collections (100+ feeds)

### Bottleneck Shifted To:
- **Network latency** (fetching RSS/Atom/JSON feeds)
- **Feed server response times**
- **XML/JSON parsing** (CPU-bound)

---

## Previous Optimizations (Already In Place)

From commits fd25287, 971c004:
1. ✅ **Lazy content fetching** - Full article content fetched on-demand when opened
2. ✅ **Background thumbnail caching** - Fire-and-forget, doesn't block refresh
3. ✅ **Icon scraping elimination** - Skip icon fetch if already cached
4. ✅ **Batch thumbnail caching** - Process thumbnails in batches of 50

---

## Testing Recommendations

### Before/After Benchmark:
```bash
# Time a full refresh of all feeds
time curl 'http://localhost:3000/api/v1/feeds-stream/refresh-multiple' \
  -H 'Accept: text/event-stream'
```

### Monitor Database Queries:
```typescript
// In db/index.ts, enable verbose mode temporarily
const db = new Database(dbPath, {
    verbose: console.log  // Logs every SQL query
});
```

### Check Feed Distribution:
```bash
cd backend
sqlite3 data/feeds.db "
  SELECT
    COUNT(*) as total_feeds,
    COUNT(CASE WHEN icon_cached_path IS NOT NULL THEN 1 END) as with_cached_icons,
    COUNT(CASE WHEN icon_cached_path IS NULL THEN 1 END) as without_cached_icons
  FROM feeds
  WHERE deleted_at IS NULL
"
```

---

## Future Optimization Ideas

If still too slow after these changes:

1. **HTTP/2 Connection Pooling** - Reuse connections to the same domains
2. **Feed Fingerprinting** - Skip parsing if ETag/Last-Modified unchanged
3. **Stale-While-Revalidate** - Show old content immediately, refresh in background
4. **Database Connection Pool** - Reduce SQLite lock contention
5. **Worker Threads** - Offload XML parsing to separate threads

---

## Code Changes Summary

**Modified Files:**
- `backend/src/services/feed-refresh.ts` - Extended interface, smarter icon querying
- `backend/src/routes/feeds-stream.ts` - Bulk prefetch, higher concurrency, faster timeout

**Lines Changed:** ~50 lines
**Breaking Changes:** None (backward compatible)
**Database Schema Changes:** None
