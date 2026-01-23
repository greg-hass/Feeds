# Feature Roadmap - Comprehensive Enhancement Plan

## Overview
This document outlines the implementation plan for major feature enhancements across analytics, automation, search, reader experience, and UX polish.

## Phase 1: Database Schema & Foundation (Week 1)

### New Tables

#### 1.1 Reading Analytics
```sql
-- Track reading sessions and engagement
CREATE TABLE reading_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    article_id INTEGER NOT NULL,
    started_at TEXT NOT NULL,
    ended_at TEXT,
    duration_seconds INTEGER,
    scroll_depth_percent INTEGER DEFAULT 0,
    completed BOOLEAN DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (article_id) REFERENCES articles(id)
);

CREATE INDEX idx_reading_sessions_article ON reading_sessions(article_id);
CREATE INDEX idx_reading_sessions_user_date ON reading_sessions(user_id, started_at);

-- Aggregate statistics
CREATE TABLE article_stats (
    article_id INTEGER PRIMARY KEY,
    total_read_time_seconds INTEGER DEFAULT 0,
    read_count INTEGER DEFAULT 0,
    avg_scroll_depth INTEGER DEFAULT 0,
    last_read_at TEXT,
    FOREIGN KEY (article_id) REFERENCES articles(id)
);

-- Feed engagement metrics
CREATE TABLE feed_stats (
    feed_id INTEGER PRIMARY KEY,
    total_articles_read INTEGER DEFAULT 0,
    avg_read_time_seconds INTEGER DEFAULT 0,
    engagement_score REAL DEFAULT 0, -- calculated metric
    last_engagement_at TEXT,
    FOREIGN KEY (feed_id) REFERENCES feeds(id)
);
```

#### 1.2 Automation Rules
```sql
-- User-defined automation rules
CREATE TABLE automation_rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    enabled BOOLEAN DEFAULT 1,
    trigger_type TEXT NOT NULL, -- 'new_article', 'keyword_match', 'feed_match'
    conditions TEXT NOT NULL, -- JSON: [{field, operator, value}]
    actions TEXT NOT NULL, -- JSON: [{type, params}]
    priority INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX idx_automation_rules_user_enabled ON automation_rules(user_id, enabled);

-- Track rule executions
CREATE TABLE rule_executions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    rule_id INTEGER NOT NULL,
    article_id INTEGER NOT NULL,
    executed_at TEXT DEFAULT (datetime('now')),
    success BOOLEAN DEFAULT 1,
    actions_taken TEXT, -- JSON array of actions executed
    error_message TEXT,
    FOREIGN KEY (rule_id) REFERENCES automation_rules(id),
    FOREIGN KEY (article_id) REFERENCES articles(id)
);

CREATE INDEX idx_rule_executions_rule ON rule_executions(rule_id);
CREATE INDEX idx_rule_executions_article ON rule_executions(article_id);
```

#### 1.3 Advanced Search
```sql
-- Saved searches
CREATE TABLE saved_searches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    query TEXT NOT NULL,
    filters TEXT, -- JSON: {date_range, authors, feeds, types}
    created_at TEXT DEFAULT (datetime('now')),
    last_used_at TEXT,
    use_count INTEGER DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX idx_saved_searches_user ON saved_searches(user_id);

-- Search history (auto-tracked)
CREATE TABLE search_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    query TEXT NOT NULL,
    filters TEXT,
    results_count INTEGER,
    searched_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX idx_search_history_user_date ON search_history(user_id, searched_at);
```

#### 1.4 Reader Enhancements
```sql
-- Text highlights and annotations
CREATE TABLE highlights (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    article_id INTEGER NOT NULL,
    text_content TEXT NOT NULL,
    start_offset INTEGER NOT NULL,
    end_offset INTEGER NOT NULL,
    color TEXT DEFAULT '#ffeb3b', -- yellow default
    note TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (article_id) REFERENCES articles(id)
);

CREATE INDEX idx_highlights_article ON highlights(article_id);
CREATE INDEX idx_highlights_user ON highlights(user_id);

-- Reading progress tracking
CREATE TABLE reading_progress (
    user_id INTEGER NOT NULL,
    article_id INTEGER NOT NULL,
    scroll_position INTEGER DEFAULT 0,
    progress_percent INTEGER DEFAULT 0,
    updated_at TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (user_id, article_id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (article_id) REFERENCES articles(id)
);
```

#### 1.5 Article Tags (for rules)
```sql
-- Auto and manual tags
CREATE TABLE article_tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    article_id INTEGER NOT NULL,
    tag TEXT NOT NULL,
    source TEXT DEFAULT 'manual', -- 'manual', 'rule', 'ai'
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (article_id) REFERENCES articles(id)
);

CREATE INDEX idx_article_tags_article ON article_tags(article_id);
CREATE INDEX idx_article_tags_tag ON article_tags(tag);
```

## Phase 2: Reading Analytics Implementation (Week 2)

### 2.1 Backend Analytics Service
**File:** `backend/src/services/analytics.ts`

Features:
- Track reading sessions (start/stop)
- Calculate engagement scores per feed
- Generate reading statistics
- Aggregate daily/weekly/monthly metrics
- Export analytics data

### 2.2 Analytics API Routes
**File:** `backend/src/routes/analytics.ts`

Endpoints:
- `GET /analytics/overview` - Dashboard summary
- `GET /analytics/feeds` - Per-feed engagement
- `GET /analytics/reading-time` - Time-based charts
- `GET /analytics/topics` - Topic distribution
- `GET /analytics/trends` - Historical trends
- `POST /analytics/session/start` - Start tracking
- `PATCH /analytics/session/end` - End tracking

### 2.3 Frontend Analytics Dashboard
**File:** `frontend/app/(app)/analytics/index.tsx`

Components:
- `AnalyticsSummary` - Key metrics overview
- `ReadingTimeChart` - Daily/weekly reading time
- `FeedEngagementList` - Top feeds by engagement
- `TopicDistribution` - Pie/bar chart of topics
- `ReadingStreaks` - Consecutive reading days
- `TimeOfDayHeatmap` - When you read most

### 2.4 Session Tracking Hook
**File:** `frontend/hooks/useReadingSession.ts`

Features:
- Auto-start session on article open
- Track scroll depth via IntersectionObserver
- Calculate reading speed
- Send analytics on unmount
- Debounce updates to reduce API calls

## Phase 3: Automation Rules Engine (Week 3)

### 3.1 Rules Engine Backend
**File:** `backend/src/services/rules-engine.ts`

Features:
- Rule condition evaluator (AND/OR logic)
- Action executor (move, tag, notify)
- Rule priority system
- Dry-run mode for testing
- Error handling and rollback

### 3.2 Rule Actions
Supported actions:
- **Move to Folder** - Auto-organize articles
- **Add Tag** - Auto-categorize
- **Mark as Read** - Auto-dismiss certain content
- **Bookmark** - Auto-save important articles
- **Delete** - Auto-cleanup unwanted content
- **Notify** - Alert on keyword matches (future: webhooks)

### 3.3 Rule Triggers
Supported triggers:
- **New Article** - On article creation
- **Keyword Match** - Content/title contains keywords
- **Feed Match** - Specific feed(s)
- **Author Match** - Specific authors
- **Combined** - Multiple conditions with AND/OR

### 3.4 Rules Management UI
**File:** `frontend/app/(app)/rules/index.tsx`

Components:
- `RulesList` - All rules with enable/disable toggles
- `RuleEditor` - Visual rule builder
- `ConditionBuilder` - Drag-drop condition creator
- `ActionSelector` - Choose actions
- `RulePreview` - Test against existing articles

## Phase 4: Advanced Search & Saved Searches (Week 4)

### 4.1 Enhanced Search API
**File:** `backend/src/routes/search.ts`

Features:
- Date range filtering (last 7 days, 30 days, custom)
- Author filtering (multi-select)
- Feed filtering (multi-select)
- Type filtering (RSS, YouTube, Podcast, Reddit)
- Tag filtering
- Bookmark-only filter
- Unread-only filter
- Search result snippets with highlights

### 4.2 Saved Searches UI
**File:** `frontend/app/(app)/search/index.tsx`

Features:
- Save current search as named query
- Quick access to saved searches
- Edit/delete saved searches
- Search usage statistics
- Recent searches dropdown

### 4.3 Search Result Enhancements
Components:
- `SearchResultSnippet` - Highlighted matching text
- `SearchFilters` - Advanced filter panel
- `SearchSuggestions` - Auto-complete based on history

## Phase 5: Reader Enhancements (Week 5)

### 5.1 Text Highlighting System
**File:** `frontend/components/HighlightableContent.tsx`

Features:
- Text selection → highlight menu
- Color picker (5 preset colors)
- Add notes to highlights
- Export highlights as markdown
- Share individual highlights

### 5.2 Reading Progress Indicator
**File:** `frontend/components/ReadingProgressBar.tsx`

Features:
- Top progress bar (0-100%)
- Scroll depth tracking
- Estimated time remaining
- "Resume reading" from last position

### 5.3 Table of Contents
**File:** `frontend/components/ArticleTableOfContents.tsx`

Features:
- Auto-generate from H2/H3 headers
- Sticky sidebar navigation
- Click to jump to section
- Current section highlighting

### 5.4 Enhanced Reader Settings
Add to reader:
- Line height adjustment
- Letter spacing adjustment
- Reading width (narrow/medium/wide)
- Dyslexic-friendly font option

## Phase 6: Mobile UX Enhancements (Week 6)

### 6.1 Swipe Gestures
**File:** `frontend/hooks/useSwipeGestures.ts`

Gestures:
- Swipe right → Go back
- Swipe left → Next article
- Swipe down → Refresh
- Long press → Article options menu

### 6.2 Haptic Feedback
**File:** `frontend/utils/haptics.ts`

Feedback types:
- Light - Button taps
- Medium - Toggle switches
- Heavy - Delete actions
- Success - Mark as read
- Warning - Error states

### 6.3 Pull-to-Refresh Enhancement
Features:
- Custom pull animation
- Haptic feedback on trigger
- Progress indicator
- Release to refresh hint

## Phase 7: UX Polish (Week 7)

### 7.1 Breadcrumb Navigation
**File:** `frontend/components/Breadcrumbs.tsx`

Display:
- Home > Folder > Feed > Article
- Clickable navigation
- Mobile: Compact mode
- Desktop: Full breadcrumbs

### 7.2 Keyboard Shortcuts
**File:** `frontend/hooks/useKeyboardShortcuts.ts`

Shortcuts:
- `j/k` - Next/previous article
- `o` - Open article
- `s` - Star/bookmark
- `m` - Mark as read
- `r` - Refresh
- `/` - Focus search
- `g h` - Go home
- `?` - Show shortcuts help

### 7.3 Shortcuts Help Modal
**File:** `frontend/components/KeyboardShortcutsHelp.tsx`

Features:
- Grouped by category
- Search shortcuts
- Visual key representations
- Customizable bindings (future)

### 7.4 Article Navigation
**File:** `frontend/components/ArticleNavigation.tsx`

Features:
- Next/Previous buttons in article view
- Keyboard shortcuts integration
- Auto-mark as read on navigate
- Preserve scroll position on back

## Phase 8: Integration & Testing (Week 8)

### 8.1 Migration Scripts
**File:** `backend/src/db/migrations/add-enhanced-features.sql`

Run migrations for all new tables and indexes.

### 8.2 Settings Integration
Add to settings:
- Analytics preferences (enable/disable tracking)
- Default highlight color
- Gesture sensitivity
- Haptic feedback toggle
- Keyboard shortcuts enable/disable

### 8.3 Documentation
Create docs:
- `ANALYTICS.md` - Analytics system overview
- `AUTOMATION.md` - Rules engine guide
- `SHORTCUTS.md` - Keyboard shortcuts reference

### 8.4 Performance Testing
Test:
- Analytics query performance (with 10k+ articles)
- Rule execution speed (with 50+ rules)
- Search performance (with date range filters)
- Mobile gesture responsiveness

## Implementation Order

### Immediate (This Week)
1. Database schema migration
2. Analytics tracking backend
3. Basic analytics dashboard

### High Priority (Next 2 Weeks)
4. Automation rules engine
5. Rules management UI
6. Advanced search filters

### Medium Priority (Weeks 4-6)
7. Text highlighting
8. Reading progress
9. Swipe gestures
10. Haptic feedback

### Polish (Weeks 7-8)
11. Breadcrumbs
12. Keyboard shortcuts
13. Article navigation
14. Testing & optimization

## Success Metrics

**Analytics:**
- Track 95%+ of reading sessions
- Dashboard loads in <500ms
- Accurate engagement scoring

**Rules:**
- Execute rules in <50ms per article
- Support 100+ concurrent rules
- 99%+ success rate

**Search:**
- Return results in <200ms
- Support complex multi-filter queries
- Accurate snippet highlighting

**UX:**
- Gesture recognition in <100ms
- Smooth haptic feedback
- Zero layout shift on navigation

## Technical Considerations

### Database
- Add indexes carefully (balance query speed vs write speed)
- Use background jobs for aggregation (don't slow down article fetching)
- Archive old analytics data (keep last 90 days hot)

### Frontend
- Lazy load analytics components
- Cache search results
- Debounce analytics updates
- Optimize re-renders with React.memo

### Backend
- Rate limit analytics endpoints
- Use transactions for rule executions
- Queue rule processing (don't block article creation)
- Add circuit breakers for AI features

## Notes

- All features respect privacy (local-only, no external tracking)
- Analytics data can be exported/deleted
- Rules can be imported/exported for sharing
- Keyboard shortcuts follow common conventions (Gmail, Reddit, etc.)
- Mobile gestures are optional (can be disabled in settings)
