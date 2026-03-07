# Manual QA Worksheet

Use this worksheet before calling any Feeds release production-ready.

Release under test:

- Frontend version:
- Frontend build SHA:
- Backend version:
- Backend build SHA:
- Test date:
- Tester:

## Platforms

- [ ] iPhone Safari
- [ ] iPhone installed PWA
- [ ] Android Chrome
- [ ] Android installed PWA
- [ ] Desktop browser

## Core Checks

For each platform, mark pass/fail and record notes.

### 1. Boot And Auth

- [ ] App opens without crash
- [ ] Existing session restores correctly
- [ ] Login works
- [ ] Setup-required flow works if applicable
- [ ] Expired session flow behaves correctly

Notes:

### 2. Timeline Navigation

- [ ] Scroll deep in timeline
- [ ] Open article
- [ ] Return to timeline
- [ ] Same article block remains visible
- [ ] No visible jump on return

Notes:

### 3. Refresh Behavior

- [ ] Manual refresh works
- [ ] Refresh icon/status behaves correctly
- [ ] Deep-scrolled timeline does not jump during refresh
- [ ] New articles pill appears only when appropriate
- [ ] No stale-state crash or bad header state after relaunch

Notes:

### 4. Reader Experience

- [ ] Reader view opens correctly
- [ ] Reader typography matches app styling
- [ ] Reddit article cleanup looks acceptable
- [ ] Share/bookmark/unread behavior still works from article flow

Notes:

### 5. Backgrounding And Resume

- [ ] Background app for a short interval and return
- [ ] Background app for a longer interval and return
- [ ] App resumes without crash
- [ ] Refresh state is sensible after resume

Notes:

### 6. PWA Update Flow

Run this only after a newer build is deployed while the app is already installed/opened on the device.

- [ ] Existing app detects update
- [ ] In-app update prompt appears
- [ ] Tapping `Reload` activates the new build
- [ ] Settings shows the new build id
- [ ] No hard refresh, cache clearing, or reinstall required

Notes:

## Failures

List every failure with:

- Platform
- Step
- Observed behavior
- Expected behavior
- Build id

## Signoff

- [ ] All critical checks passed
- [ ] No blocking regressions found
- [ ] Release is acceptable for production

Final notes:
