# OPML Import Progress & Feed Refresh Design

**Date:** 2026-01-18
**Status:** Approved
**Author:** Design Session with User

## Overview

This design addresses three critical issues with OPML import and feed refresh:

1. **File Selection Bug** - .opml files appear grayed out and unselectable across all platforms (macOS, iOS, iPad)
2. **Missing Progress Feedback** - No visual indication during import/refresh operations
3. **OPML Structure** - Must respect folder hierarchy from OPML files

The solution implements Server-Sent Events (SSE) for real-time progress tracking with detailed per-feed status updates, auto-refresh of imported feeds, and theme-aware progress UI.

---

## Problem Statement

### Current Issues

**File Selection:**
- OPML files cannot be selected in document picker on macOS (Safari/Chrome), iOS, and iPad
- Current MIME type filters too restrictive: `['text/xml', 'application/xml', 'application/x-opml+xml']`

**Missing Progress Indicators:**
- Import shows only a spinner, no progress details
- No feedback on which feeds are being processed
- No visibility into errors until completion
- Refresh provides minimal feedback (just toast messages)

**User Requirements:**
- Detailed progress bar showing X of Y feeds
- List of folders/feeds as they're created/refreshed
- Status icons: ✓ (success), ⊘ (skipped), ✗ (error), ⟳ (in progress)
- Auto-refresh imported feeds immediately
- Retry failed feeds after completion
- Theme-aware UI (dark/light modes)
- Responsive positioning (bottom-right desktop, centered above nav mobile)

---

## Architecture

### Technology Choice: Server-Sent Events (SSE)

**Why SSE over alternatives:**

| Approach | Pros | Cons | Verdict |
|----------|------|------|---------|
| **SSE** ✓ | Real-time, efficient, standard web tech, auto-reconnect | Requires new endpoint | **Selected** |
| Polling | Simple, works everywhere | 500ms delay, less efficient, more requests | Not chosen |
| WebSocket | Real-time, bidirectional | Overkill for one-way updates, complex | Not chosen |

**SSE Benefits for this use case:**
- Operations can take 30+ seconds with many feeds
- True real-time feedback builds user confidence
- Single HTTP connection, minimal overhead
- Built-in browser reconnection on network issues

---

## Design Details

### 1. File Picker Fix

**Problem:** Platform-specific MIME type handling prevents .opml selection

**Solution:** Platform-aware file type configuration

```typescript
const result = await DocumentPicker.getDocumentAsync({
  type: Platform.OS === 'web'
    ? ['text/xml', 'application/xml', 'text/x-opml', '*/*']
    : ['text/xml', 'application/xml', 'text/x-opml', '*/*'],
  copyToCacheDirectory: true,
});
```

**Additional Validation:**
- Check file extension after selection (`.opml` or `.xml`)
- Show error if wrong file type selected
- Prevents user confusion on platforms with `*/*` wildcard

**Files to modify:**
- `frontend/app/(app)/manage.tsx` - Update DocumentPicker configuration

---

### 2. Backend SSE Implementation

**New Endpoints:**

#### `POST /api/v1/opml/import/stream` (SSE)
- Accepts OPML file upload (multipart/form-data)
- Returns SSE stream with progress events
- Flow: Parse → Create folders → Create feeds → Refresh each feed

#### `POST /api/v1/feeds/refresh-multiple/stream` (SSE)
- Accepts array of feed IDs (query param or body)
- Returns SSE stream with refresh progress
- Used for: bulk refresh, retry failed feeds

**SSE Event Structure:**

```typescript
type ProgressEvent =
  | { type: 'start', total_folders: number, total_feeds: number }
  | { type: 'folder_created', name: string, id: number }
  | { type: 'feed_created', title: string, id: number, folder?: string, status: 'created' | 'duplicate' }
  | { type: 'feed_refreshing', id: number, title: string }
  | { type: 'feed_complete', id: number, title: string, new_articles: number }
  | { type: 'feed_error', id: number, title: string, error: string }
  | { type: 'complete', stats: ImportStats }

interface ImportStats {
  success: number;
  skipped: number;
  errors: number;
  failed_feeds: Array<{ id: number, title: string, error: string }>;
}
```

**Implementation Notes:**
- Set headers: `Content-Type: text/event-stream`, `Cache-Control: no-cache`, `Connection: keep-alive`
- Send events as: `data: ${JSON.stringify(event)}\n\n`
- Keep connection alive: Send comment every 15s (`: keepalive\n\n`)
- Error handling: Close stream gracefully with `complete` event
- Timeout: 5 minutes safety limit for entire operation

**Files to create:**
- `backend/src/routes/opml-stream.ts` - SSE endpoints
- `backend/src/routes/feeds-stream.ts` - Bulk refresh SSE endpoint

**Files to modify:**
- `backend/src/services/opml-parser.ts` - Add event emission during parse
- `backend/src/services/feed-refresh.ts` - Add event emission during refresh

---

### 3. Frontend SSE Client

**API Service Methods:**

```typescript
// services/api.ts

/**
 * Import OPML with progress tracking via SSE
 * Returns EventSource for listening to progress events
 */
importOpmlWithProgress(file: any): EventSource {
  const formData = new FormData();

  if (Platform.OS === 'web') {
    formData.append('file', file.file);
  } else {
    formData.append('file', {
      uri: file.uri,
      name: file.name,
      type: file.mimeType || 'application/xml',
    } as any);
  }

  // Start SSE connection
  const eventSource = new EventSource(
    `${API_BASE_URL}/opml/import/stream?token=${this.apiToken}`
  );

  // Send file via separate POST (EventSource only supports GET)
  fetch(`${API_BASE_URL}/opml/import/stream`, {
    method: 'POST',
    body: formData,
    headers: { 'Authorization': `Bearer ${this.apiToken}` }
  });

  return eventSource;
}

/**
 * Refresh multiple feeds with progress tracking via SSE
 */
refreshFeedsWithProgress(feedIds: number[]): EventSource {
  const eventSource = new EventSource(
    `${API_BASE_URL}/feeds/refresh-multiple/stream?ids=${feedIds.join(',')}&token=${this.apiToken}`
  );
  return eventSource;
}
```

**Connection Handling:**
- Auto-reconnect: Built into EventSource API
- Timeout: 5 minutes (abort if no events)
- Cleanup: Close EventSource on component unmount
- Error events: Handle connection failures gracefully

**State Management:**

```typescript
interface ProgressState {
  isActive: boolean;
  operation: 'import' | 'refresh';
  items: ProgressItem[];
  current: ProgressItem | null;
  total: number;
  stats: {
    success: number;
    skipped: number;
    errors: number;
  };
  complete: boolean;
  failedFeeds: Array<{ id: number, title: string, error: string }>;
}

interface ProgressItem {
  id: string;
  type: 'folder' | 'feed';
  title: string;
  subtitle?: string; // "3 new articles" or error message
  folder?: string;
  status: 'pending' | 'processing' | 'success' | 'skipped' | 'error';
}
```

**Files to modify:**
- `frontend/services/api.ts` - Add SSE methods
- `frontend/app/(app)/manage.tsx` - Add progress state and SSE listeners

---

### 4. Progress Dialog Component

**Component Hierarchy:**

```
ProgressDialog (themed container)
├─ ProgressBar (emerald green fill)
├─ ScrollView (max 400px height)
│  └─ ProgressItem[] (folders/feeds with status icons)
└─ Summary (completion stats + retry button)
```

**Theme-Aware Styling:**

Using existing theme from `frontend/theme.tsx`:

```typescript
const colors = useColors();

// Dialog
backgroundColor: colors.background.elevated // #0f0f0f dark, #fcfcfc light
borderColor: colors.border.DEFAULT         // #3f3f3f dark, #e4e4e7 light
borderRadius: borderRadius.lg              // 14px

// Status Colors
✓ Success:  colors.primary.DEFAULT  // #10b981 (emerald green)
⊘ Skipped:  colors.text.tertiary    // #737373 dark, #71717a light
✗ Error:    colors.error            // #ef4444 (red)
⟳ Loading:  colors.primary.light    // #34d399 (light emerald, spinning)

// Progress Bar
fillColor: colors.primary.DEFAULT        // #10b981
backgroundColor: colors.background.tertiary
```

**Responsive Positioning:**

```typescript
// Desktop (macOS Safari/Chrome)
{
  position: 'fixed',
  bottom: 20,
  right: 20,
  width: 400,
}

// Mobile (iOS/iPad)
{
  position: 'fixed',
  bottom: 80, // Above navigation bar
  left: '50%',
  transform: [{ translateX: '-50%' }],
  width: '90%',
  maxWidth: 400,
}
```

**Visual Features:**
- Rounded corners (14px)
- Drop shadow for elevation
- Auto-scroll to keep current item visible
- Smooth animations for status changes
- Dismissible (X button) but stays open until user closes
- Can minimize while operation continues (future enhancement)

**Files to create:**
- `frontend/components/ProgressDialog.tsx` - Main dialog container
- `frontend/components/ProgressBar.tsx` - Progress bar component
- `frontend/components/ProgressItem.tsx` - Individual item in list

---

### 5. OPML Import Flow

**Complete User Journey:**

```
1. User clicks "Import OPML"
   ↓
2. File picker opens (with fixed MIME types)
   ↓
3. User selects .opml file
   ↓
4. Validation: Check file extension (.opml or .xml)
   ↓
5. Progress dialog appears
   ├─ Title: "Importing OPML"
   └─ Shows "Starting import..."
   ↓
6. Backend processes:
   ├─ Parse OPML XML
   ├─ Create folders (emit folder_created)
   ├─ Create feeds (emit feed_created, mark duplicates)
   └─ Auto-refresh each feed (emit feed_refreshing → feed_complete/error)
   ↓
7. Progress updates in real-time:
   ├─ Progress bar: "23 of 45 feeds"
   ├─ List shows each item as processed
   └─ Auto-scroll to current item
   ↓
8. Completion:
   ├─ Summary: "✓ 45 feeds, ⊘ 3 duplicates, ✗ 2 errors"
   ├─ "Retry Failed" button (if errors exist)
   └─ Dialog stays open for review
```

**OPML Folder Structure Handling:**

- Parse nested `<outline>` elements from OPML
- Create folders in hierarchical order (parent before children)
- Assign feeds to correct folders based on OPML structure
- Handle feeds without folders (assign to null/root level)
- Skip duplicate folders (by name)
- Duplicate feeds (by URL) shown as ⊘ "Already exists"

**Example Progress List:**

```
✓ Created folder "Tech News"
✓ TechCrunch (Tech News) - 15 new articles
✓ The Verge (Tech News) - 8 new articles
⊘ Ars Technica (Tech News) - Already exists
✗ Invalid Feed (Tech News) - Connection timeout
⟳ Wired (Tech News) - Refreshing...
[Pending feeds grayed out below...]
```

**Files to modify:**
- `frontend/app/(app)/manage.tsx` - Add progress dialog integration
- `backend/src/services/opml-parser.ts` - Emit events during parsing
- `backend/src/routes/opml-stream.ts` - Orchestrate parse + refresh flow

---

### 6. Feed Refresh Flow

**Trigger Points:**

1. **Manual bulk refresh** - New "Refresh All Feeds" button in toolbar
2. **Retry failed feeds** - After import/refresh errors
3. **Per-feed refresh** - Existing button (enhanced with progress dialog)

**Bulk Refresh Journey:**

```
1. User clicks "Refresh All"
   ↓
2. Progress dialog appears
   ├─ Title: "Refreshing Feeds"
   └─ Shows "Starting refresh..."
   ↓
3. Backend processes:
   ├─ Fetch all feed IDs (or specific IDs for retry)
   ├─ Refresh sequentially (1s delay between)
   └─ Emit progress events
   ↓
4. Progress updates:
   ├─ "Refreshing 23 of 45 feeds"
   ├─ Current feed: ⟳ icon (spinning)
   ├─ Completed: ✓ with "X new articles"
   └─ Failed: ✗ with error message
   ↓
5. Completion:
   ├─ Summary: "✓ 43 successful, ✗ 2 errors"
   └─ "Retry Failed" button (if errors)
```

**Example Progress List:**

```
✓ TechCrunch - 5 new articles
✓ The Verge - 0 new articles
✗ Broken Feed - Timeout after 30s
⟳ Wired - Refreshing...
○ Pending Feed 1
○ Pending Feed 2
```

**UI Changes:**

- Add "Refresh All Feeds" button to `manage.tsx` toolbar (next to Import/Export)
- Existing per-feed refresh keeps working, uses same progress dialog
- Dialog title changes based on operation: "Importing OPML" vs "Refreshing Feeds"

**Files to modify:**
- `frontend/app/(app)/manage.tsx` - Add "Refresh All" button, integrate progress
- `backend/src/routes/feeds-stream.ts` - Bulk refresh SSE endpoint

---

### 7. Error Handling & Retry

**Error Categories:**

1. **Network errors** - Timeout, connection failed, DNS lookup failed
2. **Parse errors** - Invalid RSS/Atom XML, malformed feed structure
3. **HTTP errors** - 404 Not Found, 403 Forbidden, 500 Server Error
4. **Validation errors** - Missing feed URL, invalid URL format

**Error Display Format:**

```
✗ Feed Title (Folder Name)
  └─ Error: Connection timeout after 30s
```

**Error Handling Strategy:**

**During Operations:**
- **Continue processing** - Don't stop on first error
- **Collect errors** - Track all failed feeds with details
- **Update progress** - Show running error count in subtitle
  - Example: "23 of 45 (2 errors)"

**After Completion:**

```
Summary:
✓ 43 feeds refreshed successfully
⊘ 3 duplicates skipped
✗ 2 feeds failed

[View Failed Feeds ▼]
  • Broken Feed - Timeout after 30s
  • Invalid Feed - 404 Not Found

[Retry Failed Feeds] button
```

**Retry Mechanism:**

- Click "Retry Failed Feeds" → Opens same progress dialog
- Only processes feeds that failed (passes specific feed IDs)
- Uses same SSE stream for progress tracking
- Can retry multiple times until all succeed or user gives up
- Each retry shows only failed feeds in progress list

**Timeout Configuration:**

```typescript
// Per-feed operation timeout
FEED_REFRESH_TIMEOUT = 30_000; // 30 seconds

// Overall operation timeout
OPERATION_TIMEOUT = 300_000; // 5 minutes

// SSE keepalive interval
KEEPALIVE_INTERVAL = 15_000; // 15 seconds
```

**Connection Loss Handling:**

- **EventSource auto-reconnect** - Built-in browser feature
- **Backend resume** - Continue from last sent event (idempotent operations)
- **Frontend feedback** - Show "Reconnecting..." message if connection drops
- **Graceful degradation** - If reconnect fails, show error with manual retry option

**Files to modify:**
- `backend/src/services/feed-refresh.ts` - Enhanced error tracking
- `frontend/components/ProgressDialog.tsx` - Error summary and retry UI

---

## Implementation Plan

### Phase 1: File Picker Fix (Quick Win)
1. Update `DocumentPicker.getDocumentAsync()` MIME types
2. Add file extension validation
3. Test on macOS, iOS, iPad

### Phase 2: Backend SSE Infrastructure
1. Create `backend/src/routes/opml-stream.ts`
2. Create `backend/src/routes/feeds-stream.ts`
3. Modify `opml-parser.ts` to emit events
4. Modify `feed-refresh.ts` to emit events
5. Add keepalive and timeout handling

### Phase 3: Frontend Components
1. Create `ProgressDialog.tsx` with theme integration
2. Create `ProgressBar.tsx`
3. Create `ProgressItem.tsx`
4. Add SSE methods to `api.ts`

### Phase 4: Integration
1. Integrate progress dialog into `manage.tsx`
2. Connect OPML import to SSE endpoint
3. Add "Refresh All" button
4. Add retry mechanism

### Phase 5: Testing & Polish
1. Test on all platforms (macOS, iOS, iPad, Safari, Chrome)
2. Test large OPML files (100+ feeds)
3. Test error scenarios (network failures, timeouts)
4. Test theme switching during operations
5. Polish animations and transitions

---

## Success Criteria

- [ ] OPML files selectable on all platforms (macOS, iOS, iPad)
- [ ] Real-time progress feedback during import (folders/feeds listed)
- [ ] Real-time progress feedback during refresh
- [ ] Auto-refresh imported feeds with progress tracking
- [ ] OPML folder hierarchy preserved
- [ ] Duplicate feeds skipped and marked in progress
- [ ] Errors collected and retry mechanism works
- [ ] Theme-aware UI (dark/light modes)
- [ ] Responsive positioning (desktop/mobile)
- [ ] Handles 100+ feed imports smoothly
- [ ] Graceful error handling and recovery

---

## Future Enhancements (Out of Scope)

- Minimize dialog while operation continues in background
- Cancel in-progress operations
- Parallel feed refresh (currently sequential with 1s delay)
- Progress persistence across app restarts
- Detailed statistics: total articles added, bandwidth used, etc.
- Export with progress (currently only import has progress)

---

## Files Summary

**New Files:**
- `backend/src/routes/opml-stream.ts` - SSE import endpoint
- `backend/src/routes/feeds-stream.ts` - SSE bulk refresh endpoint
- `frontend/components/ProgressDialog.tsx` - Main progress UI
- `frontend/components/ProgressBar.tsx` - Progress bar component
- `frontend/components/ProgressItem.tsx` - Individual progress item

**Modified Files:**
- `frontend/app/(app)/manage.tsx` - File picker fix, progress integration, "Refresh All" button
- `frontend/services/api.ts` - SSE client methods
- `backend/src/services/opml-parser.ts` - Event emission during parse
- `backend/src/services/feed-refresh.ts` - Event emission during refresh

**Configuration:**
- `frontend/theme.tsx` - Already has all needed colors (no changes)

---

## Design Decisions Log

| Decision | Rationale |
|----------|-----------|
| SSE over polling | Real-time feedback critical for long operations |
| Auto-refresh imports | One-step import process, better UX |
| Skip duplicates | Safer default, prevents accidental overwrites |
| Continue on errors | Complete full operation, then retry failed |
| Theme-aware UI | Consistent with app design, better accessibility |
| Sequential refresh | Avoid hammering servers, matches current scheduler behavior |
| Bottom-right desktop | Non-intrusive, doesn't block content |
| Centered mobile | Prominent feedback on smaller screens |
| Emerald/Purple accents | Matches existing brand colors |
