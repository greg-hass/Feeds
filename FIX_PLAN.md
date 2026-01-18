# Feeds Application - Comprehensive Fix Plan

## Overview
This document tracks all identified issues and their fix status. Issues are organized by severity and will be fixed systematically.

---

## CRITICAL ISSUES (Fix Immediately)

### 1. Native App Article Content Returns NULL
**Status:** TODO
**File:** `frontend/components/ArticleContent.tsx`
**Issue:** Component returns `null` on native platforms, showing blank content
**Fix:** Implement WebView-based rendering for React Native
**Files to modify:**
- `frontend/components/ArticleContent.tsx`
- Add WebView dependency if needed

### 2. Settings Not Persisted
**Status:** TODO
**File:** `frontend/stores/index.ts`
**Issue:** Settings store doesn't use persist middleware, settings lost on refresh
**Fix:** Add persist middleware to useSettingsStore
**Files to modify:**
- `frontend/stores/index.ts`

### 3. Article Navigation Broken with Direct Links
**Status:** TODO
**File:** `frontend/app/(app)/article/[id].tsx`
**Issue:** Keyboard navigation (j/k) relies on articles array being pre-populated
**Fix:** Fetch adjacent articles from API or store navigation context
**Files to modify:**
- `frontend/app/(app)/article/[id].tsx`
- `backend/src/routes/articles.ts` (add endpoint for adjacent articles)

---

## HIGH PRIORITY

### 4. Multi-User Cleanup Using Wrong Settings
**Status:** TODO
**File:** `backend/src/services/scheduler.ts`
**Issue:** Cleanup job uses first user's settings for ALL users
**Fix:** Loop through all users and apply each user's retention settings
**Files to modify:**
- `backend/src/services/scheduler.ts`

### 5. No Search in Article Content / FTS Not Indexing
**Status:** TODO
**Files:** Multiple
**Issue:** Full-text search only indexes title/summary, not full content
**Fix:** Update FTS index to include content and readability_content
**Files to modify:**
- `backend/src/db/migrations/` (new migration)
- `backend/src/routes/search.ts` (update search query)

### 6. Duplicate Headers in Article List
**Status:** TODO
**File:** `frontend/app/(app)/index.tsx`
**Issue:** Article card header rendered twice (desktop + content block)
**Fix:** Remove duplicate header rendering
**Files to modify:**
- `frontend/app/(app)/index.tsx`

### 7. Weak JWT Secret Default
**Status:** TODO
**File:** `backend/src/app.ts`
**Issue:** Uses 'change-me-in-production' as default JWT secret
**Fix:** Throw error if JWT_SECRET not set in production
**Files to modify:**
- `backend/src/app.ts`

### 8. No CSP Headers for HTML Content
**Status:** TODO
**Files:** `frontend/components/ArticleContent.tsx`, `backend/src/app.ts`
**Issue:** Article content rendered with dangerouslySetInnerHTML without CSP
**Fix:** Add CSP headers and sanitize HTML content
**Files to modify:**
- `backend/src/app.ts` (add CSP headers)
- `frontend/components/ArticleContent.tsx` (add sanitization)

---

## MEDIUM PRIORITY (Technical Debt)

### 9. Sync Endpoint Not Used
**Status:** TODO
**Files:** Backend route exists, frontend doesn't use it
**Issue:** Delta sync implemented on backend but not consumed by frontend
**Fix:** Implement periodic sync and offline-first architecture
**Files to modify:**
- `frontend/stores/index.ts` (add sync logic)
- `frontend/services/api.ts` (may need tweaks)
- New sync service or background task

### 10. Duplicate Feed Refresh Code
**Status:** TODO
**Files:** `backend/src/routes/feeds.ts` and `backend/src/services/scheduler.ts`
**Issue:** Feed refresh logic duplicated between manual and scheduled refresh
**Fix:** Extract to shared function
**Files to modify:**
- `backend/src/services/feed-refresh.ts` (new file)
- `backend/src/routes/feeds.ts`
- `backend/src/services/scheduler.ts`

### 11. Inconsistent Error Handling
**Status:** TODO
**Files:** Throughout codebase
**Issue:** Mix of try/catch, alerts, toasts, silent failures
**Fix:** Create centralized error handler
**Files to modify:**
- `frontend/services/errorHandler.ts` (new)
- Update all error handling to use centralized handler

### 12. Type Unsafe Any Casts
**Status:** TODO
**File:** `backend/src/services/feed-parser.ts`
**Issue:** `Record<string, unknown>` casts for RSS extensions
**Fix:** Create proper type definitions for common RSS extensions
**Files to modify:**
- `backend/src/services/feed-parser.ts`
- `backend/src/types/rss-extensions.ts` (new)

### 13. No Rate Limiting
**Status:** TODO
**File:** `backend/src/app.ts`
**Issue:** No rate limiting on expensive operations
**Fix:** Add rate limiting middleware
**Files to modify:**
- `backend/src/app.ts` (add rate limiting)
- Create rate limit configuration

---

## LOW PRIORITY (Polish)

### 14. Empty State Doesn't Differentiate Errors
**Status:** TODO
**File:** `frontend/app/(app)/index.tsx`
**Issue:** Same empty state for "no articles" and "error fetching"
**Fix:** Add error state tracking and different UI
**Files to modify:**
- `frontend/stores/index.ts` (add error state)
- `frontend/app/(app)/index.tsx`

### 15. No Feed Error Recovery UI
**Status:** TODO
**Files:** Multiple
**Issue:** Failed feeds (error_count >= 5) are skipped permanently, no UI indication
**Fix:** Add error status display and manual retry option
**Files to modify:**
- `frontend/app/(app)/manage.tsx` (show error status)
- `frontend/services/api.ts` (add retry endpoint if needed)
- `backend/src/routes/feeds.ts` (reset error count on manual refresh)

### 16. ArticleContent Key Forces Re-render
**Status:** TODO
**File:** `frontend/components/ArticleContent.tsx`
**Issue:** Using `isMobile` as key causes remount on screen resize
**Fix:** Use proper responsive technique without key
**Files to modify:**
- `frontend/components/ArticleContent.tsx`

### 17. Keyboard Shortcuts Not Debounced
**Status:** TODO
**File:** `frontend/app/(app)/article/[id].tsx`
**Issue:** Rapid key presses cause navigation issues
**Fix:** Add debouncing to keyboard handler
**Files to modify:**
- `frontend/app/(app)/article/[id].tsx`

### 18. Magic Numbers and Hardcoded Values
**Status:** TODO
**Files:** Multiple
**Issue:** Various hardcoded values throughout codebase
**Fix:** Extract to configuration constants
**Files to modify:**
- `backend/src/config/constants.ts` (new)
- `frontend/config/constants.ts` (new)
- Update all files with magic numbers

### 19. N+1 Query in Unread Counts
**Status:** TODO
**File:** `backend/src/routes/feeds.ts`
**Issue:** Subquery for each feed's unread count
**Fix:** Use JOIN and GROUP BY for efficient counting
**Files to modify:**
- `backend/src/routes/feeds.ts`

---

## FIX STATUS TRACKING

| # | Issue | Severity | Status | Notes |
|---|-------|----------|--------|-------|
| 1 | Native article content null | CRITICAL | ✅ DONE | WebView implemented |
| 2 | Settings not persisted | CRITICAL | ✅ DONE | Persist middleware added |
| 3 | Article navigation broken | CRITICAL | ✅ DONE | Adjacent article tracking |
| 4 | Multi-user cleanup wrong settings | HIGH | ✅ DONE | Loop through all users |
| 5 | No search in content | HIGH | ✅ DONE | FTS includes content |
| 6 | Duplicate headers | HIGH | ✅ DONE | Removed duplicate render |
| 7 | Weak JWT secret | HIGH | ✅ DONE | JWT_SECRET validation |
| 8 | No CSP headers | HIGH | ✅ DONE | CSP headers added |
| 9 | Sync not used | MEDIUM | ✅ DONE | Sync integrated |
| 10 | Duplicate refresh code | MEDIUM | ✅ DONE | Extracted to shared module |
| 11 | Inconsistent error handling | MEDIUM | ✅ DONE | Centralized error handler |
| 12 | Type unsafe any casts | MEDIUM | ✅ DONE | RSS extension types |
| 13 | No rate limiting | MEDIUM | ✅ DONE | Rate limiter added |
| 14 | Empty state UX | LOW | ✅ DONE | Error state added |
| 15 | No error recovery UI | LOW | ✅ DONE | Retry UI added |
| 16 | Key forces re-render | LOW | ✅ DONE | Proper cleanup |
| 17 | No keyboard debounce | LOW | ✅ DONE | 300ms debounce |
| 18 | Magic numbers | LOW | ✅ DONE | Constants extracted |
| 19 | N+1 query | LOW | ✅ DONE | JOIN/GROUP BY optimization |

---

## EXECUTION ORDER

1. **Phase 1 - Critical Fixes** (Issues 1-3): ✅ Complete
2. **Phase 2 - High Priority Security/Stability** (Issues 4-8): ✅ Complete
3. **Phase 3 - Technical Debt** (Issues 9-13): ✅ Complete
4. **Phase 4 - Polish** (Issues 14-19): ✅ Complete

---

Last Updated: 2025-01-18
