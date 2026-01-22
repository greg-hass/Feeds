# AGENTS.md

This document helps agents work effectively in the Feeds codebase.

## Project Overview

Feeds is a self-hosted RSS/Atom feed reader with support for YouTube channels, Reddit, and Podcasts. It's a full-stack application with:

- **Backend**: Node.js, Fastify, SQLite (better-sqlite3), TypeScript
- **Frontend**: React Native Web via Expo, Zustand for state management
- **Deployment**: Docker with nginx reverse proxy
- **Key Features**: Background feed refresh, full-text search, OPML import/export, digest generation, AI-powered feed discovery

## Development Commands

### Backend

```bash
cd backend

# Development (watch mode with tsx)
npm run dev

# Build TypeScript
npm run build

# Start production server
npm run start

# Run database migrations
npm run migrate

# Run tests
npm run test
```

**Important**: Backend runs on port 3001 by default (configurable via `PORT` env var). Frontend expects API at `/api/v1` relative path when served from nginx.

### Frontend

```bash
cd frontend

# Development (web)
npm run web

# Build for production (static web)
npm run build:web

# Development (iOS)
npm run ios

# Development (Android)
npm run android

# Lint
npm run lint
```

**Note**: The `expo export --platform web` command (used in `build:web`) generates a static site in `frontend/dist/` that nginx serves.

### Docker

```bash
# Build and start with docker-compose
docker-compose up -d

# View logs
docker-compose logs -f

# Stop
docker-compose down

# Rebuild after changes
docker-compose up -d --build
```

**Environment Variables** (see `.env.example`):
- `JWT_SECRET`: Required for authentication (CHANGE IN PRODUCTION)
- `GEMINI_API_KEY`: For AI-powered feed discovery
- `YOUTUBE_API_KEY`: Optional - improves YouTube feed parsing
- `LOG_LEVEL`: debug, info, warn, error (default: info)
- `CORS_ORIGIN`: Set to frontend domain in production

## Code Organization

### Backend Structure

```
backend/src/
├── app.ts              # Fastify app builder, CORS, security headers
├── index.ts            # Entry point, starts server
├── config/
│   └── constants.ts    # HTTP timeouts, content limits, strings
├── controllers/        # Request handlers (minimal - mostly inline in routes)
├── db/
│   ├── index.ts        # Database connection, query helpers (run, queryOne, queryAll)
│   ├── migrate.ts      # Migration runner
│   └── migrations/     # SQL migration files (numbered: 001_*, 002_*, etc.)
├── middleware/
│   └── rate-limit.ts   # Rate limiting middleware
├── routes/            # Fastify route definitions
│   ├── articles.ts     # Article CRUD, bookmarks, readability
│   ├── discovery.ts    # Feed discovery endpoints
│   ├── digest.ts      # Digest generation and retrieval
│   ├── feeds-stream.ts # SSE streaming for feed refresh
│   ├── feeds.ts       # Feed CRUD operations
│   ├── folders.ts     # Folder management
│   ├── icons.ts       # Icon serving
│   ├── opml-stream.ts # OPML import with progress (SSE)
│   ├── opml.ts        # OPML export
│   ├── search.ts      # Full-text search
│   ├── settings.ts    # User settings
│   ├── sync.ts        # Sync endpoints for frontend
│   └── thumbnails.ts  # Thumbnail serving
├── services/
│   ├── ai.ts          # Gemini AI integration
│   ├── digest.ts      # Digest generation logic
│   ├── discovery/     # Feed discovery implementations
│   ├── feed-parser.ts # RSS/Atom parsing with feedparser
│   ├── feed-refresh.ts # Core refresh logic with error handling
│   ├── icon-cache.ts   # Local icon caching
│   ├── image-cache.ts  # Image proxy/caching
│   ├── interest-analyzer.ts # AI interest analysis
│   ├── opml-parser.ts  # OPML import/export
│   ├── readability.ts  # Mozilla Readability integration
│   ├── scheduler.ts   # Background job scheduler
│   ├── settings.ts    # Settings management
│   └── thumbnail-cache.ts # Local thumbnail caching
├── types/
│   └── rss-extensions.ts # Type extensions for feedparser
└── utils/             # Utility functions
```

**Key Patterns**:

1. **Database Access**: All DB operations go through `src/db/index.js` exports:
   - `queryOne<T>(sql, params)` - Returns single row or null
   - `queryAll<T>(sql, params)` - Returns array of rows
   - `run(sql, params)` - Executes INSERT/UPDATE/DELETE, returns `{ changes }`

2. **Single User Architecture**: The app is single-user, `user_id` is always `1`. Hardcoded in routes.

3. **Route Registration**: Routes are registered in `app.ts` with prefixes:
   ```typescript
   await app.register(feedsRoutes, { prefix: '/api/v1/feeds' });
   await app.register(articlesRoutes, { prefix: '/api/v1/articles' });
   ```

4. **Input Validation**: Uses `zod` for request validation:
   ```typescript
   const listArticlesSchema = z.object({
       feed_id: z.coerce.number().optional(),
       limit: z.coerce.number().min(1).max(200).default(50),
   });
   const query = listArticlesSchema.parse(request.query);
   ```

5. **Error Handling**: Routes return error responses with `{ error: string }`:
   ```typescript
   return reply.status(404).send({ error: 'Article not found' });
   ```

### Frontend Structure

```
frontend/
├── app/
│   ├── +html.tsx              # HTML template wrapper
│   ├── _layout.tsx            # Root layout
│   └── (app)/                # Main app group
│       ├── _layout.tsx         # App layout
│       ├── index.tsx           # Home (article list)
│       ├── article/[id].tsx    # Article detail view
│       ├── bookmarks.tsx       # Bookmarks page
│       ├── manage.tsx          # Feed/folder management
│       ├── discovery.tsx       # Feed discovery
│       ├── digest.tsx          # Digest view
│       ├── search.tsx          # Search page
│       └── settings.tsx       # Settings page
├── components/
│   ├── Timeline.tsx            # Article feed component
│   ├── TimelineArticle.tsx     # Individual article card
│   ├── Sidebar.tsx             # Navigation sidebar
│   ├── ArticleCard.tsx         # Article preview card
│   ├── ArticleContent.tsx      # Article content viewer
│   ├── DigestCard.tsx          # Digest preview card
│   ├── DigestView.tsx          # Full digest view
│   ├── DiscoveryPage.tsx        # Discovery UI
│   ├── PodcastPlayer.tsx        # Audio player for podcasts
│   ├── YouTubePlayer.tsx        # YouTube video player
│   └── ... (more UI components)
├── stores/
│   ├── index.ts               # Store exports
│   ├── feedStore.ts           # Feeds/folders state
│   ├── articleStore.ts         # Articles state
│   ├── settingsStore.ts        # Settings state
│   ├── digestStore.ts          # Digest state
│   ├── audioStore.ts          # Audio player state
│   └── types.ts               # Store TypeScript types
├── services/
│   ├── api.ts                 # API client with type definitions
│   └── errorHandler.ts        # Centralized error handling
├── hooks/
│   ├── useTimeline.ts         # Timeline data fetching logic
│   ├── useTimelineScroll.ts   # Scroll position management
│   └── useKeyboardShortcuts.ts
├── lib/
│   └── sync.ts               # Client-side sync logic
├── config/
│   └── constants.ts           # App constants
├── theme/
│   ├── theme.tsx              # Color definitions
│   ├── animations.ts          # Animation constants
│   └── shadows.ts             # Shadow utilities
├── utils/
│   ├── formatters.ts          # Date/text formatters
│   └── youtube.ts            # YouTube utilities
└── types/
    └── react-native-markdown-display.d.ts
```

**Key Patterns**:

1. **State Management**: Uses `zustand` with `persist` middleware for persistence:
   ```typescript
   export const useFeedStore = create<FeedState>()(
       persist(
           (set, get) => ({
               feeds: [],
               fetchFeeds: async () => { /* ... */ },
           }),
           {
               name: 'feeds-list',
               storage: createJSONStorage(() => AsyncStorage),
               partialize: (state) => ({ feeds: state.feeds }),
           }
       )
   );
   ```

2. **API Client**: Centralized in `services/api.ts` with TypeScript types:
   ```typescript
   const API_URL = process.env.EXPO_PUBLIC_API_URL || '/api/v1';
   async request<T>(endpoint: string, options: RequestOptions = {}): Promise<T>
   ```

3. **Routing**: Uses `expo-router` (file-based routing):
   - `(app)` group wraps all screens with shared layout
   - Dynamic routes: `article/[id].tsx`
   - `useRouter()` for navigation

4. **Styling**: Uses custom theme system (no styled-components):
   ```typescript
   const colors = useColors();
   const s = styles(colors, isMobile);
   ```

5. **SSE Streaming**: Custom implementation for long-running operations:
   - OPML import: `api.importOpmlWithProgress(file, onEvent, onError)`
   - Feed refresh: `api.refreshFeedsWithProgress(ids, onEvent, onError)`

## Database Schema

### Core Tables

- **users**: Single user (id=1), admin flag, settings_json
- **folders**: Organize feeds, user_id foreign key
- **feeds**: Feed subscriptions, type (rss/youtube/reddit/podcast), refresh intervals, error tracking
- **articles**: Parsed articles, feed_id foreign key, readability_content, bookmark flag
- **read_state**: Per-article read status (user_id + article_id composite key)

### Additional Tables

- **sync_cursors**: Sync protocol state
- **articles_fts**: Full-text search (FTS5 virtual table) with triggers
- **digests**: Generated digests
- **digest_settings**: User digest preferences
- **feed_recommendations**: AI-discovered feeds
- **user_interests**: User interests for discovery

### Migration Pattern

Migrations are numbered SQL files in `backend/src/db/migrations/`:
```
001_initial_schema.sql
002_add_settings_json.sql
003_add_bookmarks.sql
...
```

Run with `npm run migrate` in backend directory. Migrations are idempotent and use `IF NOT EXISTS`.

## Feed Types and Special Handling

### RSS/Atom
- Standard web feeds parsed via `feedparser`
- Icon: extracted from favicon or feed metadata
- Thumbnails: scraped from `<img>` tags in content

### YouTube
- Feed format: `https://www.youtube.com/feeds/videos.xml?channel_id=UC...`
- Video ID extracted from GUID format: `yt:video:XXXXXXXXXXX` or `video:XXXXXXXXXXX`
- Thumbnails: `https://img.youtube.com/vi/{videoId}/hqdefault.jpg`
- Icon: Scraped from channel page (multiple regex patterns)
- User agent: Browser UA required (YouTube blocks default UA)

### Reddit
- Feed format: `https://www.reddit.com/r/{subreddit}/.rss`
- Author prefix: Auto-adds `u/` if missing
- Content: Strips Reddit footer table
- Thumbnails: Upgraded to optimized preview URLs (width=640, auto=webp)
- Icon: Fetched from `r/{subreddit}/about.json`

### Podcasts
- Detected by `enclosures` with `audio/*` type or iTunes namespace
- Enclosures: `enclosure_url`, `enclosure_type` stored
- Duration: `duration_seconds` when available
- Audio player: Dedicated `PodcastPlayer` component

## Important Gotchas

### Backend

1. **Single User Architecture**: `user_id` is always `1`. Don't add user selection logic.

2. **Soft Deletes**: Feeds use `deleted_at IS NULL` filter. Always include this in queries.

3. **Cursor Pagination**: Articles use cursor-based pagination:
   ```typescript
   const decoded = JSON.parse(Buffer.from(query.cursor, 'base64').toString());
   // Next cursor: Buffer.from(JSON.stringify({ published_at, id })).toString('base64')
   ```

4. **YouTube Channel ID Format**: Must be 24 chars starting with `UC`. Validate before scraping.

5. **Feed Refresh Concurrency**: Background scheduler processes in batches (BATCH_SIZE=5) with delays to avoid 429 errors.

6. **Error Backoff**: Failed feeds use exponential backoff (2x interval, max 5 min). `error_count` and `last_error` tracked.

7. **Readability Content**: Lazy-loaded on-demand. Stored in `readability_content` column. May fail for paywalled sites.

8. **Icon/Thumbnail Caching**: 
   - Icons: `/api/v1/icons/{feedId}` - local files in `backend/data/icons/`
   - Thumbnails: `/api/v1/thumbnails/{articleId}` - local files in `backend/data/thumbnails/`
   - Cached paths stored: `icon_cached_path`, `thumbnail_cached_path`

9. **Digest Generation**: Uses Gemini AI. Requires `GEMINI_API_KEY` env var. Runs twice daily (configurable).

10. **SQLite Transaction Mode**: better-sqlite3 WAL mode enabled for concurrent reads/writes during refresh.

11. **Cleanup Cycle**: Runs daily to delete articles older than `retention_days`. **Bookmarked articles are never deleted.**

### Frontend

1. **API URL Config**: Use `EXPO_PUBLIC_API_URL` env var for custom backend URL. Defaults to `/api/v1` (same origin).

2. **Platform Detection**: Responsive design breaks at 1024px width:
   ```typescript
   const { width } = useWindowDimensions();
   const isMobile = width < 1024;
   ```

3. **Refresh Abort**: Feed refresh can be aborted. Store `AbortController` reference to cancel:
   ```typescript
   const controller = new AbortController();
   await api.refreshFeedsWithProgress(ids, onEvent, onError, controller.signal);
   ```

4. **State Persistence**: Zustand persists to AsyncStorage. When changing data structures, provide migration or clear persisted data.

5. **FlatList Performance**: Uses aggressive optimization props:
   ```typescript
   removeClippedSubviews={Platform.OS === 'android'}
   initialNumToRender={10}
   maxToRenderPerBatch={5}
   windowSize={11}
   ```

6. **Markdown Rendering**: Uses `react-native-markdown-display` with custom type definitions in `types/`.

7. **Date Formatting**: Uses `date-fns`. Consistent format: `formatRelative`, `format` with patterns.

8. **Image Loading**: Remote images are proxied through API to avoid CORS. Thumbnails may be cached locally.

9. **Sync Protocol**: Client-side sync tracks changes offline, pushes on reconnect. Uses cursor-based incremental sync.

10. **Error Handling**: Centralized in `services/errorHandler.ts`. Use `handleError(error, { context, showToast, fallbackMessage })`.

## Testing

Backend uses Vitest. Test files should be co-located or in `__tests__` directories.

To run tests:
```bash
cd backend
npm test
```

Note: Test coverage appears minimal based on current codebase.

## Deployment

### Docker Build Process

Multi-stage Dockerfile:
1. **backend-builder**: Node 20 Alpine, runs `tsc` to compile TypeScript to `dist/`
2. **frontend-builder**: Node 20 Alpine, runs `expo export --platform web` to `dist/`
3. **production**: Node 20 Alpine with nginx, serves static frontend + backend API

Production image uses nginx as reverse proxy:
- Static files from `frontend/dist/` served at root
- API routes proxied to backend at `http://localhost:3001`
- Healthcheck: `GET /health`

### Entrypoint

`docker/entrypoint.sh` starts both nginx and backend:
- Runs migrations on startup
- Starts backend server (background)
- Starts nginx (foreground)

### Data Persistence

Database and cached files live in `/data/` volume:
- `/data/feeds.db` - SQLite database
- `/data/icons/` - Cached feed icons
- `/data/thumbnails/` - Cached article thumbnails

### GitHub Actions

Docker image built and pushed to GHCR on push to main and tags.
No automated testing in CI (manual only).

## API Patterns

### SSE Endpoints

Server-Sent Events for long-running operations:
- `/api/v1/opml-stream/import` - OPML import with progress
- `/api/v1/feeds-stream/refresh-multiple` - Bulk feed refresh with progress

SSE response format:
```
data: {"type":"start","total_feeds":10}

data: {"type":"feed_refreshing","id":1,"title":"Feed Name"}

data: {"type":"feed_complete","id":1,"title":"Feed Name","new_articles":3}

data: {"type":"complete","stats":{"success":10,"errors":0,"failed_feeds":[]}}
```

### Response Formats

**Success**: JSON with result object
```json
{
  "feed": { "id": 1, "title": "...", ... },
  "articles_added": 5
}
```

**Error**: JSON with error message and HTTP status code
```json
{
  "error": "Feed not found"
}
```

### Cursor Pagination

Articles endpoint supports cursor-based pagination:
```
GET /api/v1/articles?cursor=eyJwdWJsaXNoZWRfYXQiOiIyMDI2LTAxLTIyVDEwOjAwOjAwLjAwMFoiLCJpZCI6MTIzfQ==&limit=50
```

Cursor is base64-encoded JSON: `{ published_at: string, id: number }`

## Common Tasks

### Add a New API Endpoint

1. Create route handler in `backend/src/routes/`
2. Register in `backend/src/app.ts`:
   ```typescript
   await app.register(myRoutes, { prefix: '/api/v1/myresource' });
   ```
3. Add API client methods in `frontend/services/api.ts`
4. Call from stores or components

### Add Database Migration

1. Create SQL file: `backend/src/db/migrations/XXX_feature_name.sql`
2. Use `CREATE TABLE IF NOT EXISTS`, `ALTER TABLE` with column existence check
3. Run `npm run migrate` in backend
4. Test in development before committing

### Add New Feed Type

1. Add type to FeedType enum in `backend/src/services/feed-parser.ts`
2. Implement detection logic in `detectFeedType()`
3. Add normalization in `normalizeArticle()` if needed
4. Update frontend types in `services/api.ts`

### Add UI Component

1. Create component file in `frontend/components/`
2. Use `useColors()` for theme access
3. Follow existing patterns: interface props, use forwardRef if needed
4. Export and use in page components or other components

### Debug Feed Parsing Issues

1. Check logs for `[YouTube]`, `[RSS]`, or `[Reddit]` prefixes
2. Enable `LOG_LEVEL=debug` in `.env`
3. Check feed refresh error messages in database: `SELECT * FROM feeds WHERE error_count > 0`
4. Test feed parsing manually: Use `/api/v1/discovery/url` endpoint

### Update Database Schema

1. Create migration file with ALTER TABLE
2. Update TypeScript interfaces in routes/services
3. Update frontend API types in `services/api.ts`
4. Test migration: `npm run migrate` (idempotent)

## External Dependencies

### Key Libraries

- **Backend**:
  - `fastify`: Web framework
  - `better-sqlite3`: SQLite database
  - `feedparser`: RSS/Atom parsing
  - `@mozilla/readability`: Article content extraction
  - `zod`: Runtime type validation
  - `node-cron`: Scheduled tasks

- **Frontend**:
  - `expo`: React Native framework
  - `expo-router`: File-based routing
  - `zustand`: State management
  - `@tanstack/react-query`: Server state (unused - prefer Zustand)
  - `react-native-reanimated`: Animations
  - `date-fns`: Date manipulation

### APIs Used

- **Gemini AI**: For feed discovery and interest analysis (optional, requires API key)
- **YouTube**: YouTube Data API (optional, improves channel info)
- **Reddit**: Public RSS feeds (no API required)

## Performance Considerations

1. **Database Indexes**: Ensure proper indexes on foreign keys and frequently queried columns
2. **Batch Operations**: Feed refresh processes in batches to avoid overwhelming external servers
3. **Image Caching**: Icons and thumbnails cached locally to reduce external requests
4. **Pagination**: Always use cursor pagination for article lists (never offset)
5. **Lazy Loading**: Readability content fetched on-demand, not during feed refresh
6. **SSE Keepalive**: SSE endpoints send keepalive every 15s to prevent timeout

## Security Notes

1. **JWT Secret**: Must be set in production via `JWT_SECRET` env var
2. **CORS**: Restrict in production via `CORS_ORIGIN` env var
3. **Content Security Policy**: Strict CSP headers set in `app.ts`
4. **SQL Injection**: Always use parameterized queries (no string concatenation)
5. **Rate Limiting**: Implement rate limiting for API endpoints (middleware exists, check usage)
6. **Input Validation**: All inputs validated via Zod schemas
7. **Secrets**: Never commit `.env` or real API keys

## Troubleshooting

### Feed Not Refreshing

1. Check feed `error_count` and `last_error` in database
2. Verify feed URL is accessible (test manually)
3. Check `next_fetch_at` - feed may not be due for refresh
4. Review backend logs for timeout or parsing errors

### Frontend Build Fails

1. Clear node_modules: `rm -rf node_modules && npm install`
2. Check EXPO_PUBLIC_API_URL is set correctly
3. Verify TypeScript types in `services/api.ts` match backend

### Database Migration Fails

1. Check migration file syntax
2. Verify migration doesn't conflict with existing schema
3. Run `npm run migrate` with fresh database to test

### Docker Container Crashes

1. Check logs: `docker-compose logs feeds`
2. Verify `JWT_SECRET` is set
3. Check database permissions on volume mount
4. Verify port 3080 is not already in use

### YouTube Feed Issues

1. Check `YOUTUBE_API_KEY` env var (optional but recommended)
2. Verify channel ID format (UC + 22 chars)
3. YouTube blocks default UA - code retries with browser UA
4. Check logs for `[YouTube Icon]` errors

### Slow Feed Refresh

1. Too many feeds refreshing concurrently - scheduler batches them
2. External site slow - check feed `last_fetched_at`
3. Thumbnail caching slow - disable temporarily for testing
4. Readability extraction slow - may timeout for paywalled sites

## File Naming Conventions

- Backend: `kebab-case.ts` (e.g., `feed-parser.ts`, `article-store.ts`)
- Frontend: `PascalCase.tsx` for components (e.g., `Timeline.tsx`, `ArticleCard.tsx`)
- Utilities: `camelCase.ts` (e.g., `formatters.ts`, `youtube.ts`)
- Stores: `camelCase.ts` (e.g., `feedStore.ts`, `articleStore.ts`)
- Migrations: `NNN_description.sql` (e.g., `001_initial_schema.sql`)

## Code Style Notes

- **TypeScript strict mode**: Enabled for both backend and frontend
- **ESLint**: Configured in frontend (`npm run lint`)
- **No formatting tools**: Prettier not configured (manual formatting)
- **Import style**: Prefer named exports, absolute imports via `@/` alias in frontend
- **Error messages**: User-facing messages in error objects, technical logs via `console.log/error`
- **Comments**: Minimal, prefer self-documenting code. Add JSDoc only for complex functions.

## Environment-Specific Behavior

### Development
- Backend runs with `tsx watch` for hot reloading
- Frontend runs with Expo dev server
- Database file in `backend/data/` (local file system)
- CORS enabled for all origins

### Production (Docker)
- Backend runs compiled JavaScript from `dist/`
- Frontend served as static files by nginx
- Database in `/data/` volume (persistent)
- CORS restricted to configured origin
- Healthcheck enabled
- Graceful shutdown handles SIGTERM/SIGINT
