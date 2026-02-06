describe('Feeds App - Critical User Flows', () => {
  beforeAll(async () => {
    await device.launchApp();
  });

  beforeEach(async () => {
    await device.reloadReactNative();
  });

  describe('Authentication Flow', () => {
    it('should display login screen on first launch', async () => {
      await expect(element(by.id('login-screen'))).toBeVisible();
      await expect(element(by.id('password-input'))).toBeVisible();
      await expect(element(by.id('login-button'))).toBeVisible();
    });

    it('should login with valid credentials', async () => {
      // Enter password
      await element(by.id('password-input')).typeText('admin123');
      
      // Tap login button
      await element(by.id('login-button')).tap();
      
      // Should navigate to feeds screen
      await expect(element(by.id('feeds-screen'))).toBeVisible();
    });

    it('should show error for invalid credentials', async () => {
      // Enter wrong password
      await element(by.id('password-input')).typeText('wrongpassword');
      
      // Tap login button
      await element(by.id('login-button')).tap();
      
      // Should show error
      await expect(element(by.text('Invalid password'))).toBeVisible();
    });
  });

  describe('Feed Management Flow', () => {
    beforeEach(async () => {
      // Login first
      await element(by.id('password-input')).typeText('admin123');
      await element(by.id('login-button')).tap();
      await expect(element(by.id('feeds-screen'))).toBeVisible();
    });

    it('should display feed list', async () => {
      await expect(element(by.id('feed-list'))).toBeVisible();
    });

    it('should add a new feed', async () => {
      // Tap add feed button
      await element(by.id('add-feed-button')).tap();
      
      // Should show add feed modal
      await expect(element(by.id('add-feed-modal'))).toBeVisible();
      
      // Enter feed URL
      await element(by.id('feed-url-input')).typeText('https://example.com/feed.xml');
      
      // Tap add button
      await element(by.id('add-feed-submit')).tap();
      
      // Should close modal and show new feed
      await expect(element(by.id('add-feed-modal'))).not.toBeVisible();
    });

    it('should refresh a feed', async () => {
      // Find first feed and tap refresh
      await element(by.id('feed-refresh-button')).atIndex(0).tap();
      
      // Should show loading indicator
      await expect(element(by.id('feed-refresh-spinner'))).toBeVisible();
    });

    it('should delete a feed', async () => {
      // Long press on first feed to show options
      await element(by.id('feed-item')).atIndex(0).longPress();
      
      // Tap delete
      await element(by.text('Delete')).tap();
      
      // Confirm deletion
      await element(by.text('Confirm')).tap();
    });
  });

  describe('Article Reading Flow', () => {
    beforeEach(async () => {
      // Login first
      await element(by.id('password-input')).typeText('admin123');
      await element(by.id('login-button')).tap();
      await expect(element(by.id('feeds-screen'))).toBeVisible();
    });

    it('should display article list', async () => {
      // Tap on first feed
      await element(by.id('feed-item')).atIndex(0).tap();
      
      // Should show article list
      await expect(element(by.id('article-list'))).toBeVisible();
    });

    it('should open and read an article', async () => {
      // Tap on first feed
      await element(by.id('feed-item')).atIndex(0).tap();
      
      // Tap on first article
      await element(by.id('article-item')).atIndex(0).tap();
      
      // Should show article detail
      await expect(element(by.id('article-detail'))).toBeVisible();
      
      // Should show article title
      await expect(element(by.id('article-title'))).toBeVisible();
      
      // Should show article content
      await expect(element(by.id('article-content'))).toBeVisible();
    });

    it('should mark article as read', async () => {
      // Navigate to article
      await element(by.id('feed-item')).atIndex(0).tap();
      await element(by.id('article-item')).atIndex(0).tap();
      
      // Tap mark as read button
      await element(by.id('mark-read-button')).tap();
      
      // Should show confirmation
      await expect(element(by.text('Marked as read'))).toBeVisible();
    });

    it('should bookmark an article', async () => {
      // Navigate to article
      await element(by.id('feed-item')).atIndex(0).tap();
      await element(by.id('article-item')).atIndex(0).tap();
      
      // Tap bookmark button
      await element(by.id('bookmark-button')).tap();
      
      // Button should show bookmarked state
      await expect(element(by.id('bookmark-button-active'))).toBeVisible();
    });
  });

  describe('Search Flow', () => {
    beforeEach(async () => {
      // Login first
      await element(by.id('password-input')).typeText('admin123');
      await element(by.id('login-button')).tap();
      await expect(element(by.id('feeds-screen'))).toBeVisible();
    });

    it('should open search screen', async () => {
      // Tap search button
      await element(by.id('search-button')).tap();
      
      // Should show search screen
      await expect(element(by.id('search-screen'))).toBeVisible();
      
      // Should show search input
      await expect(element(by.id('search-input'))).toBeVisible();
    });

    it('should search for articles', async () => {
      // Open search
      await element(by.id('search-button')).tap();
      
      // Type search query
      await element(by.id('search-input')).typeText('javascript');
      
      // Submit search
      await element(by.id('search-submit')).tap();
      
      // Should show search results
      await expect(element(by.id('search-results'))).toBeVisible();
    });
  });

  describe('Settings Flow', () => {
    beforeEach(async () => {
      // Login first
      await element(by.id('password-input')).typeText('admin123');
      await element(by.id('login-button')).tap();
      await expect(element(by.id('feeds-screen'))).toBeVisible();
    });

    it('should open settings screen', async () => {
      // Tap settings button
      await element(by.id('settings-button')).tap();
      
      // Should show settings screen
      await expect(element(by.id('settings-screen'))).toBeVisible();
    });

    it('should toggle dark mode', async () => {
      // Open settings
      await element(by.id('settings-button')).tap();
      
      // Toggle dark mode
      await element(by.id('dark-mode-toggle')).tap();
      
      // Should apply dark theme
      await expect(element(by.id('dark-theme-active'))).toBeVisible();
    });
  });
});
