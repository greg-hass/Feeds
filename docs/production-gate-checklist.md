# Production Gate Checklist

Do not call Feeds production-ready until every item below is explicitly passed.

## 1. Release And Update Reliability

- Deploy a new version over an existing installed PWA.
- The app detects the new service worker.
- The user sees an in-app update prompt.
- Reload activates the new build cleanly.
- No hard refresh, cache clearing, or reinstall is required.

## 2. Persisted State Upgrades

- Older persisted Zustand state shapes migrate without runtime errors.
- Missing fields in hydrated state are normalized safely.
- Upgrades across the latest store schema changes are covered by tests.

## 3. Timeline Navigation Integrity

- Deep-scroll the timeline.
- Open an article.
- Return to the timeline.
- The same article block remains visible.
- No jump occurs after refresh, unread toggle, bookmark toggle, or background sync.

## 4. Boot And Auth Determinism

- Fresh install works.
- Existing session works.
- Expired session works.
- Setup-required state works.
- Web/PWA boot has no SSR or client-only initialization crashes.

## 5. Reader Quality

- Reader typography matches the rest of the app.
- Reddit cleanup handles known junk fixtures.
- Poor readability inputs degrade gracefully.

## 6. Deployment Identity

- Settings shows frontend version and build SHA.
- Settings shows backend version and build SHA.
- A user-reported issue can be tied to the exact deployed build immediately.

## 7. Warning Backlog

- No unresolved hook/state warnings remain in core auth, timeline, refresh, or PWA flows.
- Remaining warnings are low-risk and explicitly understood.

## 8. Automated Regression Coverage

- Login/setup/auth status flow is covered.
- Timeline restore after article open/back is covered.
- Prepend refresh while deep-scrolled is covered.
- Refresh presentation logic is covered.
- Persisted refresh-state migration is covered.

## 9. Mobile/PWA Manual QA

Run the following on each supported class:

- iPhone Safari/PWA
- Android Chrome/PWA
- Desktop browser

Verify:

- login
- refresh
- article open/back
- upgrade to new build
- relaunch after backgrounding

## 10. Release Process

- Build command is documented.
- Deploy command is documented.
- Build metadata injection is documented.
- Running-version verification is documented.
- Rollback approach is documented.

## Current Status

As of March 7, 2026:

- Structural progress is strong.
- The app should be treated as a production candidate in stabilization, not production-ready.
- The remaining gate is mostly validation, migration safety, warning cleanup, and release-process hardening.
