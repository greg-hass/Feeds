# AI-Powered Reading Assistant & Feed Discovery

**Date:** 2026-01-18
**Status:** Design - Ready for Implementation

## Overview

This design adds two interconnected AI-powered features to Feeds:

1. **Smart Daily Digest** - An AI-generated morning briefing that summarizes unread articles
2. **Intelligent Feed Discovery** - Personalized recommendations for new feeds (especially YouTube channels) based on reading patterns and interests

### Core Principles

- **User agency first** - AI assists, never filters or hides content
- **Transparency** - Always show what the AI did and why
- **Privacy-focused** - All processing happens on user's instance with their API keys
- **Complementary** - These features enhance existing reading, don't replace it

## High-Level Architecture

```
┌─────────────────────────────────────────────────────┐
│                   Feeds Frontend                     │
│  ┌──────────────┐              ┌─────────────────┐  │
│  │ Daily Digest │              │ Discovery Page  │  │
│  │   Section    │              │   + Nudges      │  │
│  └──────────────┘              └─────────────────┘  │
└─────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────┐
│                  Feeds Backend (Fastify)             │
│  ┌──────────────┐              ┌─────────────────┐  │
│  │   Digest     │              │   Discovery     │  │
│  │   Service    │              │    Engine       │  │
│  └──────────────┘              └─────────────────┘  │
│         │                              │            │
│         ▼                              ▼            │
│  ┌─────────────────────────────────────────────┐   │
│  │     AI Intelligence Layer (Gemini)          │   │
│  │  - Analyze interests                         │   │
│  │  - Generate summaries                        │   │
│  │  - Rank recommendations                      │   │
│  └─────────────────────────────────────────────┘   │
│                        │                            │
└────────────────────────┼────────────────────────────┘
                         │
          ┌──────────────┴──────────────┐
          ▼                             ▼
   ┌──────────────┐            ┌─────────────────┐
   │ YouTube API  │            │ Search APIs +   │
   │              │            │ Feed Validation │
   └──────────────┘            └─────────────────┘
```

## Feature 1: Smart Daily Digest

### User Experience

When users open Feeds, they'll see a **"Daily Digest"** section at the top (similar to a pinned folder). Clicking it shows an AI-generated summary document of their unread articles.

### How It Works

**Generation:**
- Runs automatically on a schedule (e.g., 6 AM daily, configurable)
- Can also be triggered manually ("Generate digest now")
- Collects all unread articles from selected feeds/folders
- Sends article metadata (title, excerpt, source) to Gemini
- Gemini generates a structured summary document

**Summary Format:**
```markdown
Daily Digest - January 18, 2026
Summarized from 47 articles across 12 feeds

## Tech News (15 articles)
• New React framework released - Major performance improvements in server components...
  → Read full article: [Link to article in Feeds]
• AI regulation updates - EU passes new guidelines affecting open source models...
  → Read full article: [Link]

## YouTube - Tech Channels (8 videos)
• "Building microservices with Docker" from Fireship - Covers containerization patterns...
  → Watch in Feeds: [Link]

[... more sections ...]
```

**User Controls (Settings):**
- **Which feeds** - Select feeds/folders to include (default: all)
- **Schedule** - When to generate (morning, evening, on-demand only)
- **Style** - Brief bullets vs. paragraph summaries
- **Enable/disable** - One toggle to turn it off entirely

**Key Implementation Details:**
- Digest is stored as a special article in the database
- Doesn't modify or hide actual articles
- Links point back to article detail pages in Feeds
- Can regenerate anytime if user wants different style

### Why This Approach?

**Problem it solves:** Users subscribe to many feeds but struggle to keep up. They want to know what happened without reading everything.

**Why not algorithmic filtering?** We explicitly avoid hiding or deprioritizing content. The digest is a convenience layer - users still see all articles in their normal feeds. This respects their intentional curation.

**Transparency:** Every summary links to the full article and shows exactly what was summarized ("47 articles across 12 feeds").

## Feature 2: Intelligent Feed Discovery

### User Experience

**Discovery Page:**
- New "Discover" section in the sidebar
- Shows personalized feed recommendations with preview cards:
  - Feed title, description, sample recent posts
  - Why it's recommended ("Based on your interest in...")
  - Subscriber/follower count, last updated date
  - "Subscribe" button
- Refreshes with new recommendations periodically

**Periodic Nudges:**
- Once a week (configurable), if good matches are found
- In-app notification: "Found 5 new feeds you might like"
- Clicking opens the Discovery page with those recommendations highlighted

### How Discovery Works

#### Step 1: Interest Analysis (Gemini)

Analyzes user's reading behavior:
- Articles they read (not just added to feed)
- Time spent on articles
- Articles starred/saved
- Topics across all their feeds

Extracts topic clusters: `["AI/ML", "web development", "indie hacking", ...]`

User can also explicitly add interests in settings.

#### Step 2: Feed Search (Multi-strategy)

**For YouTube Channels:**
- Gemini generates search queries from interests
- YouTube Data API searches for channels:
  - Topic-based search: "machine learning tutorials"
  - Related channels: Find similar to subscribed channels via API
- Fetch metadata: subscriber count, upload frequency, description
- Filter: Must have uploaded in last 30 days (configurable)

**For RSS/Atom Feeds:**
- Gemini generates search queries
- Use search API (Google Custom Search or similar)
- Validate each feed:
  - Fetch the feed URL
  - Parse successfully
  - Has published content in last 60 days
  - Extract metadata (title, description, update frequency)

#### Step 3: Ranking & Filtering (Gemini)

- Gemini scores each feed against user's interests (0-100)
- Removes feeds user is already subscribed to (check against DB)
- Ranks by relevance score
- Returns top 20-30 recommendations

#### Step 4: Storage & Presentation

- Cache recommendations in database (table: `feed_recommendations`)
- Mark when shown to user, when dismissed, when subscribed
- Periodically refresh (weekly) with new recommendations

### Why This Approach?

**Gemini as intelligence, APIs as data sources:** Gemini understands context and interests but needs structured data sources (YouTube API, search APIs) to find actual feeds.

**Multi-strategy discovery:** Different feed types need different discovery methods. YouTube has a great official API; RSS feeds need search + validation.

**Validation is critical:** Users emphasized wanting "live" feeds that actually exist and are active. We validate everything before showing it.

**Learning from behavior:** Instead of just asking "what are you interested in?", we learn from what users actually read. More accurate and requires less manual input.

## Technical Implementation

### Database Schema Changes

```sql
-- Store digest settings and generated digests
CREATE TABLE digests (
  id INTEGER PRIMARY KEY,
  user_id INTEGER,
  generated_at TIMESTAMP,
  content TEXT,  -- HTML formatted summary
  article_count INTEGER,
  feed_count INTEGER,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE digest_settings (
  user_id INTEGER PRIMARY KEY,
  enabled BOOLEAN DEFAULT true,
  schedule TEXT DEFAULT '06:00',  -- Time to generate
  included_feeds TEXT,  -- JSON array of feed IDs, null = all
  style TEXT DEFAULT 'bullets',  -- 'bullets' or 'paragraphs'
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Store discovered feeds and recommendations
CREATE TABLE feed_recommendations (
  id INTEGER PRIMARY KEY,
  user_id INTEGER,
  feed_url TEXT,
  feed_type TEXT,  -- 'rss', 'youtube', 'podcast'
  title TEXT,
  description TEXT,
  relevance_score REAL,  -- 0-100 from Gemini
  reason TEXT,  -- "Based on your interest in..."
  metadata TEXT,  -- JSON: subscriber count, last updated, etc.
  status TEXT DEFAULT 'pending',  -- 'pending', 'subscribed', 'dismissed'
  discovered_at TIMESTAMP,
  shown_at TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Track user interests (explicit and derived)
CREATE TABLE user_interests (
  id INTEGER PRIMARY KEY,
  user_id INTEGER,
  topic TEXT,
  source TEXT,  -- 'explicit', 'derived', 'content_analysis'
  confidence REAL,  -- 0-1
  created_at TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

### API Requirements

**Environment Variables:**
```bash
# Already have
GEMINI_API_KEY=<existing>

# New additions
YOUTUBE_API_KEY=<youtube-data-api-key>
GOOGLE_SEARCH_API_KEY=<optional-for-rss-discovery>
GOOGLE_SEARCH_ENGINE_ID=<optional-for-rss-discovery>
```

**API Quotas & Costs:**
- **Gemini:** Already have, minimal cost increase (digest + analysis)
- **YouTube Data API:** 10,000 units/day free (plenty for discovery)
- **Google Search API:** 100 queries/day free tier (sufficient for RSS discovery)

### Backend Services

**New Services to Create:**

1. **`DigestService`** (`backend/services/digest.js`)
   - Generate daily digest for user
   - Fetch unread articles from selected feeds
   - Call Gemini to generate summary
   - Store in database

2. **`InterestAnalyzer`** (`backend/services/interestAnalyzer.js`)
   - Analyze user's reading patterns
   - Extract topics from read articles
   - Update `user_interests` table
   - Called weekly by background job

3. **`DiscoveryEngine`** (`backend/services/discovery.js`)
   - Orchestrates feed discovery
   - Calls Gemini for interest analysis
   - Calls YouTube/Search APIs for feed discovery
   - Validates and ranks results

4. **`YouTubeDiscovery`** (`backend/services/discovery/youtube.js`)
   - Search YouTube channels by topic
   - Find related channels
   - Validate channel activity
   - Return structured results

5. **`RSSDiscovery`** (`backend/services/discovery/rss.js`)
   - Search for RSS feeds
   - Validate feed URLs
   - Check feed activity
   - Extract metadata

### Background Jobs

**New Scheduled Tasks:**

1. **Digest Generator** - Runs daily at configured time per user
2. **Interest Analyzer** - Runs weekly, analyzes reading patterns
3. **Discovery Engine** - Runs weekly, finds new feed recommendations
4. **Feed Validator** - Runs daily, checks recommended feeds still active

Implementation: Use existing job scheduler or add one (e.g., `node-cron`)

### API Endpoints

**Digest:**
- `GET /api/digest` - Get latest digest for user
- `POST /api/digest/generate` - Manually trigger digest generation
- `GET /api/digest/settings` - Get digest settings
- `PUT /api/digest/settings` - Update digest settings

**Discovery:**
- `GET /api/discovery/recommendations` - Get personalized recommendations
- `POST /api/discovery/refresh` - Manually refresh recommendations
- `POST /api/discovery/:id/subscribe` - Subscribe to recommended feed
- `POST /api/discovery/:id/dismiss` - Dismiss recommendation
- `GET /api/discovery/interests` - Get user interests
- `PUT /api/discovery/interests` - Update explicit interests

### Error Handling

**Digest Generation:**
- If Gemini fails: Retry 3x, then show cached previous digest with notice
- If no unread articles: Show "All caught up!" message
- If API quota exceeded: Queue for next available slot

**Discovery:**
- If YouTube API fails: Fall back to RSS-only recommendations
- If feed validation fails: Mark as invalid, don't show to user
- If Gemini analysis fails: Use simple keyword matching as fallback

**Graceful Degradation:**
- All features are optional - app works normally without them
- Settings to disable individual features
- Clear error messages when API keys missing

## Frontend Changes

### New Components

1. **`DigestView`** - Display the daily digest
2. **`DiscoveryPage`** - Feed recommendation browser
3. **`FeedRecommendationCard`** - Individual recommendation display
4. **`DigestSettings`** - Configure digest preferences
5. **`InterestsManager`** - Manage explicit interests

### Navigation Changes

Add two new sections:
- "Daily Digest" - Shows digest icon with unread indicator
- "Discover" - Shows discovery icon with new recommendations count

## Implementation Phases

### Phase 1: Smart Daily Digest (Week 1-2)
1. Create database schema for digests
2. Implement `DigestService`
3. Create digest API endpoints
4. Build `DigestView` component
5. Add digest settings UI
6. Implement background job
7. Test with real feeds

### Phase 2: Interest Analysis (Week 2-3)
1. Create `user_interests` table
2. Implement `InterestAnalyzer`
3. Build interest tracking system
4. Add explicit interests UI
5. Test interest extraction

### Phase 3: Feed Discovery (Week 3-5)
1. Set up YouTube Data API integration
2. Implement `YouTubeDiscovery` service
3. Implement `RSSDiscovery` service
4. Create `DiscoveryEngine` orchestrator
5. Build discovery database tables
6. Create discovery API endpoints
7. Implement background discovery job

### Phase 4: Discovery UI (Week 5-6)
1. Build `DiscoveryPage` component
2. Create `FeedRecommendationCard`
3. Implement subscribe/dismiss actions
4. Add periodic nudges/notifications
5. Polish and refine UX

### Phase 5: Testing & Refinement (Week 6-7)
1. End-to-end testing
2. Performance optimization
3. Error handling validation
4. User feedback and iteration

## Success Metrics

**Engagement:**
- % of users who enable digest
- Daily digest open rate
- % of users who subscribe to recommended feeds

**Quality:**
- User ratings on digest quality (optional feedback)
- Recommendation relevance score (subscribe vs. dismiss rate)
- Feed activity rate (recommended feeds that stay active)

**Performance:**
- Digest generation time
- Discovery refresh time
- API cost per user per month

## Future Enhancements

- **Multi-language support** - Translate summaries and discover non-English feeds
- **Collaborative filtering** - "Users like you also follow..."
- **Audio digests** - Text-to-speech version of daily digest
- **Smart notifications** - Alert when important topics appear
- **Export digests** - Send via email or RSS

## Risks & Mitigations

**Risk:** API costs spiral with many users
**Mitigation:** Rate limiting, caching, quota monitoring

**Risk:** Poor recommendation quality frustrates users
**Mitigation:** Explicit feedback mechanism, confidence thresholds

**Risk:** Gemini generates inappropriate summaries
**Mitigation:** Content filtering, user reporting, review samples

**Risk:** Users perceive this as algorithmic filtering
**Mitigation:** Clear messaging that nothing is hidden, transparency in design

## Open Questions

- Should digest support custom templates?
- Should we support feed discovery for podcasts separately?
- Do we need collaborative filtering for recommendations?
- Should interests be shareable/importable?

---

**Next Steps:** Ready to implement Phase 1 (Smart Daily Digest)
