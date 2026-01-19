# FeedStream: YouTube icons, article images, and Reader View reuse

This note explains (1) how YouTube channel icons are extracted, (2) how images are chosen and displayed in the article timelines and in the reader, and (3) how to copy the elegant Reader View into another app.

## 1) YouTube channel icon extraction

### When icons are fetched
- On feed add, the API detects the feed type and fetches an icon before inserting the feed record.
  - See `api/src/routes/feeds.ts` ("Add feed endpoint"): it calls `fetchFeedIcon(url, kind)` and stores `icon_url` in the `feeds` table.
- The feed refresh path does **not** routinely re-scrape YouTube icons (it only tries to update podcast icons).
  - See `api/src/services/feed-service.ts` around `fetchFeed()`.

### How YouTube icons are scraped
- `fetchFeedIcon()` is the central helper.
  - File: `api/src/services/feed-service.ts`
- For YouTube feeds:
  1) Extracts the YouTube channel ID from the feed URL `https://www.youtube.com/feeds/videos.xml?channel_id=...`.
  2) If not present, tries to get the channel ID from the feed data (e.g., `item.ytChannelId`).
  3) Requests `https://www.youtube.com/channel/{channelId}` with a browser-like User-Agent.
  4) Scrapes the HTML using multiple regex patterns to find the avatar URL (e.g., `"avatar"...`, `channelMetadataRenderer`, `yt-img-shadow`, or `og:image`).
  5) Normalizes the size by replacing `=s{size}` with `=s176-c-k-c0x00ffffff-no-rj-mo` for a consistent high-res avatar.
  6) If scraping fails or no channel ID is found, it falls back to the Google favicon service (domain-based).

### YouTube search thumbnails
- The YouTube search endpoint (`api/src/feed-search.ts`) scrapes the channel page and returns a `thumbnail` field (from `og:image`) so the Add Feed modal can show a preview.
- This is *separate* from the stored `feeds.icon_url` used in the timeline.

## 2) How images are displayed in article timelines and articles

### A) Backend: where media thumbnails come from
- During feed parsing, item media is normalized and stored as `items.media_thumbnail`.
  - File: `api/src/services/feed-service.ts`
- YouTube items:
  - If `ytVideoId` is present, the thumbnail is `https://i.ytimg.com/vi/{id}/maxresdefault.jpg`.
  - If a YouTube URL is detected, it extracts the ID and uses the same `i.ytimg.com` thumbnail.
  - Fallback: `media:thumbnail` from the RSS item.
- Reddit items:
  - Extracts image URLs from content, upgrades Reddit preview URLs, and skips thumbnails for video posts.
- Generic items:
  - `extractHeroImage()` checks, in order: `media:thumbnail`, enclosure images, `og:image`, `twitter:image`, and the first `<img>` tag that is not an icon/logo/avatar/spinner.

### B) Timeline display (list + card views)

#### List timeline (compact rows)
- Component: `web/src/lib/components/FeedListItem.svelte`
- Feed icon (left):
  - Uses `item.feed_icon_url` (from `feeds.icon_url`), else a type icon (RSS/YouTube/Reddit/Podcast).
- Media thumbnail (right):
  - YouTube: uses `https://img.youtube.com/vi/{id}/maxresdefault.jpg` and falls back to `hqdefault` on error.
  - Podcast: uses `item.feed_icon_url` first, then `item.media_thumbnail`.
  - All others: uses `item.media_thumbnail`.

#### Grid timeline (card layout)
- Component: `web/src/lib/components/FeedCard.svelte`
- Thumbnail choice:
  - YouTube: `https://img.youtube.com/vi/{id}/mqdefault.jpg`.
  - Reddit videos: hides the image tile entirely (because the media is not playable).
  - Podcast: `item.feed_icon_url || item.media_thumbnail`.
  - All others: `item.media_thumbnail`.

### C) Reader (article view)
- API endpoint: `GET /api/reader` in `api/src/routes/reader.ts`.
- Image selection logic:
  1) `og:image` if present, else `twitter:image`.
  2) If missing, the first “usable” `<img>` in the Readability content (skipping data URLs and icon/logo/avatar).
  3) For YouTube URLs: uses `https://img.youtube.com/vi/{id}/maxresdefault.jpg`.
- Reader content is sanitized and **does not allow inline `<img>` tags**.
  - `sanitize-html` allowlist excludes `img`, so images in the body are intentionally stripped.
- UI composition:
  - The hero uses `readerData.imageUrl` (from the API) as a blurred background and badge.
  - If that fails, it falls back to `item.media_thumbnail`, and finally `item.feed_icon_url`.
  - For podcasts, the feed icon is preferred for the hero image.
  - Reddit reader content has inline images stripped in the UI (`stripInlineImages()`), even before sanitization.
- Components:
  - `web/src/lib/components/ReaderView.svelte` handles the modal layout and theme variables.
  - `web/src/lib/components/reader/ArticleContent.svelte` renders the hero and body text.
  - `web/src/lib/components/reader/YouTubePlayer.svelte` is used for video playback inside the reader.

## 3) How to copy the elegant Reader View to another app

Below is the minimum set of backend and frontend pieces to lift intact.

### Targeting the Expo web frontend
- Since your front-end already lives in the Expo monorepo (exported as web), you can re-use the React-oriented Reader View by:
  1. Consuming `GET /api/reader?url=...` via your current React Query hooks or a new hook that mirrors `ReaderView`’s data shape.
  2. Recreating the hero/body layout with React components that emit the same DOM structure (hero background, chips, action buttons). You can even wrap the existing CSS vars (`--hero-image`, `--bg`, `--text`) as CSS custom properties on a `div` or via a CSS module in Expo Web.
  3. Porting the YouTube embed logic from `web/src/lib/components/reader/YouTubePlayer.svelte` into a React `iframe` component. Since Expo is already building for web, the iframe usage is identical (just handle hydration by conditionally rendering on the client).
  4. Matching typography/spacing by copying the Svelte component’s CSS into your Expo styles (Tailwind classes can be approximated via utility-based styling or custom components that share the same class names).

If you prefer, you can wrap the existing Svelte Reader components in a micro frontend or iframe served by the Expo web app, but porting to pure React keeps things cohesive with your Zustand/React Query frontend.

### Backend pieces
1) **Reader endpoint + caching**
   - Copy `api/src/routes/reader.ts`.
   - Add the `reader_cache` table from `api/src/db/migrations/001_initial.sql`.
   - Ensure your DB client setup (`db.prepare`) matches this code’s SQLite usage.

2) **Readability + sanitization dependencies**
   - Install: `@mozilla/readability`, `jsdom`, and `sanitize-html`.
   - Keep the sanitization allowlist if you want a text-centric reader view.

3) **YouTube + Reddit special handling (optional but recommended)**
   - The endpoint contains dedicated logic for YouTube embeds and Reddit cleanup.
   - If you skip this, YouTube pages will behave like normal articles and may fail to parse cleanly.

### Frontend pieces
1) **Reader modal shell and themes**
   - Copy `web/src/lib/components/ReaderView.svelte`.
   - The theme tokens live in the component itself (CSS vars: `--bg`, `--text`, `--divider`).

2) **Reader hero + typography layout**
   - Copy `web/src/lib/components/reader/ArticleContent.svelte`.
   - This includes the “studio hero” background blur effect and the content typography.

3) **YouTube embed block**
   - Copy `web/src/lib/components/reader/YouTubePlayer.svelte`.
   - Wire it to the same `readerData.url` detection used in `ReaderView.svelte`.

4) **Reader settings (optional but part of the polish)**
   - The font size, font family, and width controls are driven by `web/src/lib/stores/readerSettings.ts`.
   - You can hardcode those values if you don’t want the settings UI.

### Minimal integration checklist
- Backend route: `/api/reader?url=...` returns `{ title, byline, excerpt, siteName, imageUrl, contentHtml }`.
- Frontend:
  - Fetches `/api/reader` into a `readerData` store.
  - Passes `readerData` + current item metadata into `ArticleContent`.
  - Applies the theme class and uses the hero background via `--hero-image`.

### Why this looks “elegant”
- The hero uses the article image as a *blurred backdrop* plus a sharp badge, which feels premium.
- The content body is text-focused; inline images are removed, so typography stays clean.
- The modal uses subtle radial gradients and smooth scale/fade animations for calm motion.

---
If you want, tell me which target app/framework you’re moving this to, and I can map the exact pieces to that stack.
