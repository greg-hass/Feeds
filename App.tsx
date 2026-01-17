import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Sidebar from './components/Sidebar';
import ArticleList from './components/ArticleList';
import ReaderView from './components/ReaderView';
import ManagementUI from './components/ManagementUI';
import Documentation from './components/Documentation';
import Onboarding from './components/Onboarding';
import SettingsUI from './components/SettingsUI';
import { Feed, Article, Folder, ActiveView, AppSettings } from './types';
import { ApiService } from './services/apiService';
import { HelpCircle, Loader2, RefreshCw, CheckCircle2, X } from 'lucide-react';

const App: React.FC = () => {
  const [isOnboarded, setIsOnboarded] = useState<boolean | null>(null);
  const [feeds, setFeeds] = useState<Feed[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [activeView, setActiveView] = useState<ActiveView>({ type: 'all', id: 'all', title: 'All Feeds' });
  const [selectedArticle, setSelectedArticle] = useState<Article | undefined>();
  const [isManagementOpen, setIsManagementOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isDocOpen, setIsDocOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Sync State
  const [syncStatus, setSyncStatus] = useState<{ 
    isSyncing: boolean; 
    current: number; 
    total: number; 
    newArticles: number;
    showNotification: boolean;
  }>({
    isSyncing: false,
    current: 0,
    total: 0,
    newArticles: 0,
    showNotification: false
  });

  const ARTICLES_PER_PAGE = 20;
  const syncTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Theme Handling
  useEffect(() => {
    if (!settings) return;

    const applyTheme = () => {
      const root = window.document.documentElement;
      const theme = settings.theme;
      
      root.classList.remove('light', 'dark');

      if (theme === 'system') {
        const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        root.classList.add(isDark ? 'dark' : 'light');
      } else {
        root.classList.add(theme);
      }
    };

    applyTheme();

    if (settings.theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const listener = () => applyTheme();
      mediaQuery.addEventListener('change', listener);
      return () => mediaQuery.removeEventListener('change', listener);
    }
  }, [settings?.theme]);

  const loadInitialData = useCallback(async () => {
    setIsLoading(true);
    try {
      const onboardedStatus = ApiService.isOnboarded();
      setIsOnboarded(onboardedStatus);

      if (onboardedStatus) {
        const [f, fol, artResponse, s] = await Promise.all([
          ApiService.getFeeds(),
          ApiService.getFolders(),
          ApiService.getArticles({ limit: ARTICLES_PER_PAGE, offset: 0 }),
          ApiService.getSettings()
        ]);
        setFeeds(f);
        setFolders(fol);
        setArticles(artResponse.articles);
        setHasMore(artResponse.hasMore);
        setSettings(s);
      }
    } catch (err) {
      console.error("Failed to load data", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // Handle auto-sync timer
  useEffect(() => {
    if (isOnboarded && settings?.refreshInterval) {
      if (syncTimerRef.current) clearInterval(syncTimerRef.current);
      
      const intervalMs = settings.refreshInterval * 60 * 1000;
      syncTimerRef.current = setInterval(() => {
        handleRefreshAll();
      }, intervalMs);
      
      return () => {
        if (syncTimerRef.current) clearInterval(syncTimerRef.current);
      };
    }
  }, [isOnboarded, settings?.refreshInterval]);

  // Handle view changes - reset articles and pagination
  useEffect(() => {
    const refreshArticles = async () => {
      if (!isOnboarded) return;
      setIsLoading(true);
      let options: any = { limit: ARTICLES_PER_PAGE, offset: 0 };
      
      if (activeView.type === 'feed') options.feedId = activeView.id;
      if (activeView.type === 'folder') options.folderId = activeView.id;
      if (activeView.type === 'smart' && activeView.id === 'bookmarks') options.bookmarked = true;

      const artResponse = await ApiService.getArticles(options);
      setArticles(artResponse.articles);
      setHasMore(artResponse.hasMore);
      setIsLoading(false);
    };
    
    if (isOnboarded && !isLoading) { 
       refreshArticles();
    }
  }, [activeView.id, activeView.type, isOnboarded]);

  const loadMoreArticles = useCallback(async () => {
    if (isLoadingMore || !hasMore) return;
    setIsLoadingMore(true);
    
    try {
      let options: any = { limit: ARTICLES_PER_PAGE, offset: articles.length };
      if (activeView.type === 'feed') options.feedId = activeView.id;
      if (activeView.type === 'folder') options.folderId = activeView.id;
      if (activeView.type === 'smart' && activeView.id === 'bookmarks') options.bookmarked = true;

      const artResponse = await ApiService.getArticles(options);
      
      setArticles(prev => [...prev, ...artResponse.articles]);
      setHasMore(artResponse.hasMore);
    } catch (err) {
      console.error("Failed to load more", err);
    } finally {
      setIsLoadingMore(false);
    }
  }, [isLoadingMore, hasMore, activeView, articles.length]);

  const handleRefreshFeed = useCallback(async (feedId: string) => {
    setFeeds(prev => prev.map(f => f.id === feedId ? { ...f, isRefreshing: true } : f));
    try {
      const { feed: updatedFeed, newArticles } = await ApiService.refreshFeed(feedId);
      setFeeds(prev => prev.map(f => f.id === feedId ? { ...updatedFeed, isRefreshing: false } : f));
      
      if (activeView.type === 'feed' && activeView.id === feedId) {
        setArticles(prev => [...newArticles, ...prev]);
      } else if (activeView.type === 'all' || activeView.type === 'folder') {
        const artResponse = await ApiService.getArticles({ limit: ARTICLES_PER_PAGE, offset: 0 });
        setArticles(artResponse.articles);
      }
      return newArticles.length;
    } catch (err: any) {
      console.error("Refresh failed", err);
      if (err.feed) {
        setFeeds(prev => prev.map(f => f.id === feedId ? { ...err.feed, isRefreshing: false } : f));
      }
      return 0;
    }
  }, [activeView]);

  const handleRefreshAll = async () => {
    if (syncStatus.isSyncing) return;
    const feedsToSync = feeds;
    if (feedsToSync.length === 0) return;

    setSyncStatus({
      isSyncing: true,
      current: 0,
      total: feedsToSync.length,
      newArticles: 0,
      showNotification: false
    });

    let cumulativeNew = 0;
    for (let i = 0; i < feedsToSync.length; i++) {
      const count = await handleRefreshFeed(feedsToSync[i].id);
      cumulativeNew += count;
      setSyncStatus(prev => ({ ...prev, current: i + 1, newArticles: cumulativeNew }));
    }

    setSyncStatus(prev => ({ ...prev, isSyncing: false, showNotification: true }));
    
    // Auto-hide notification
    setTimeout(() => {
      setSyncStatus(prev => ({ ...prev, showNotification: false }));
    }, 5000);
  };

  const handleToggleRead = async (articleId: string) => {
    const article = articles.find(a => a.id === articleId);
    if (!article) return;

    const newReadStatus = !article.read;
    const updatedArticles = articles.map(a => a.id === articleId ? { ...a, read: newReadStatus } : a);
    setArticles(updatedArticles);
    
    setFeeds(prev => prev.map(f => {
      if (f.id === article.feedId) {
        const change = newReadStatus ? -1 : 1;
        return { ...f, unreadCount: Math.max(0, f.unreadCount + change) };
      }
      return f;
    }));

    if (selectedArticle?.id === articleId) {
      setSelectedArticle({ ...selectedArticle, read: newReadStatus });
    }
    
    await ApiService.markAsRead(articleId, newReadStatus);
  };

  const handleToggleBookmark = async (articleId: string) => {
    const article = articles.find(a => a.id === articleId);
    if (!article) return;

    const newBookmarkStatus = !article.bookmarked;
    const updatedArticles = articles.map(a => a.id === articleId ? { ...a, bookmarked: newBookmarkStatus } : a);
    setArticles(updatedArticles);

    if (selectedArticle?.id === articleId) {
      setSelectedArticle({ ...selectedArticle, bookmarked: newBookmarkStatus });
    }
    
    await ApiService.toggleBookmark(articleId, newBookmarkStatus);

    if (activeView.type === 'smart' && activeView.id === 'bookmarks' && !newBookmarkStatus) {
      setArticles(prev => prev.filter(a => a.id !== articleId));
    }
  };

  const handleAddFeed = async (feedData: Partial<Feed>) => {
    try {
      const newFeed = await ApiService.addFeed(feedData);
      setFeeds(prev => [...prev, { ...newFeed, isRefreshing: true }]);
      handleRefreshFeed(newFeed.id);
    } catch (err) {
      console.error("Failed to add feed", err);
      alert("Error adding feed.");
    }
  };

  const handleImportData = async (folderNames: string[], feedsToImport: Partial<Feed>[]) => {
    try {
      const updatedFolders = await ApiService.addFolders(folderNames);
      setFolders(updatedFolders);
      
      const feedsWithResolvedFolders = feedsToImport.map(f => {
        if (f.folderId) {
          const match = updatedFolders.find(fold => fold.name === f.folderId);
          return { ...f, folderId: match?.id };
        }
        return f;
      });

      const newFeeds = await ApiService.addFeeds(feedsWithResolvedFolders);
      setFeeds(prev => [...prev, ...newFeeds.map(f => ({ ...f, isRefreshing: true }))]);
      
      newFeeds.forEach(f => handleRefreshFeed(f.id));
    } catch (err) {
      console.error("Bulk import failed", err);
      alert("Import failed. Please try again.");
    }
  };

  const handleUpdateFeed = async (feedId: string, updates: Partial<Feed>) => {
    try {
      await ApiService.updateFeed(feedId, updates);
      setFeeds(prev => prev.map(f => f.id === feedId ? { ...f, ...updates } : f));
    } catch (err) {
      console.error("Failed to update feed", err);
      alert("Failed to update feed.");
    }
  };

  const handleUpdateFeedFolder = async (feedId: string, folderId: string | undefined) => {
    try {
      await ApiService.updateFeedFolder(feedId, folderId);
      setFeeds(prev => prev.map(f => f.id === feedId ? { ...f, folderId } : f));
    } catch (err) {
      console.error("Failed to update feed folder", err);
      alert("Failed to move feed.");
    }
  };

  const handleCreateFolder = async (name: string): Promise<Folder | undefined> => {
    try {
      const newFolder = await ApiService.createFolder(name);
      setFolders(prev => {
        if (prev.some(p => p.id === newFolder.id)) return prev;
        return [...prev, newFolder];
      });
      return newFolder;
    } catch (err) {
      console.error("Failed to create folder", err);
      alert("Failed to create folder.");
      return undefined;
    }
  };

  const handleDeleteFeed = async (feedId: string) => {
    try {
      await ApiService.deleteFeed(feedId);
      setFeeds(prev => prev.filter(f => f.id !== feedId));
      setArticles(prev => prev.filter(a => a.feedId !== feedId));
      
      if (activeView.type === 'feed' && activeView.id === feedId) {
        setActiveView({ type: 'all', id: 'all', title: 'All Feeds' });
      }

      if (selectedArticle && selectedArticle.feedId === feedId) {
        setSelectedArticle(undefined);
      }
    } catch (err) {
      console.error("Failed to delete feed", err);
      alert("Failed to delete feed.");
    }
  };

  const filteredArticles = useMemo(() => {
    let filtered = articles;

    if (activeView.type === 'smart' && activeView.id !== 'bookmarks') {
      const targetType = activeView.id?.toUpperCase();
      filtered = filtered.filter(art => {
        const feed = feeds.find(f => f.id === art.feedId);
        return feed?.type === targetType;
      });
    }

    if (activeView.type === 'search' && searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(art => 
        art.title.toLowerCase().includes(q) || 
        art.summary.toLowerCase().includes(q) ||
        art.author?.toLowerCase().includes(q)
      );
    } else if (activeView.type === 'search' && !searchQuery) {
      return []; 
    }

    return filtered;
  }, [articles, feeds, activeView, searchQuery]);

  if (isOnboarded === null || (isLoading && articles.length === 0 && isOnboarded)) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-slate-50 dark:bg-zinc-950 gap-6 transition-colors duration-300">
        <div className="p-4 bg-indigo-600 dark:bg-emerald-600 text-white rounded-[1.5rem] shadow-2xl shadow-indigo-100 dark:shadow-none animate-bounce">
          <HelpCircle className="w-8 h-8" />
        </div>
        <div className="text-center space-y-2">
          <p className="font-black text-slate-900 dark:text-zinc-100 uppercase tracking-[0.2em] text-sm">Feeds Engine</p>
          <p className="text-xs text-slate-400 dark:text-zinc-500 font-bold uppercase tracking-widest animate-pulse">Establishing Secure Connection...</p>
        </div>
      </div>
    );
  }

  if (!isOnboarded) {
    return <Onboarding onComplete={() => loadInitialData()} />;
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-white dark:bg-zinc-950 relative transition-colors duration-300">
      <Sidebar 
        feeds={feeds}
        folders={folders}
        activeView={activeView}
        isSidebarOpen={isSidebarOpen}
        onViewChange={(view) => {
          setActiveView(view);
          setSelectedArticle(undefined);
          if (view.type !== 'search') setSearchQuery('');
          setIsSidebarOpen(false);
        }}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenAdd={() => {
          setIsManagementOpen(true);
          setIsSidebarOpen(false);
        }}
        onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
      />
      
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/40 dark:bg-zinc-950/60 backdrop-blur-sm z-40 md:hidden transition-opacity duration-300"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}
      
      <main className={`flex-1 flex overflow-hidden relative transition-all duration-300`}>
        <ArticleList 
          articles={filteredArticles}
          feeds={feeds}
          selectedArticleId={selectedArticle?.id}
          activeView={activeView}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          onSelect={setSelectedArticle}
          onToggleRead={handleToggleRead}
          onToggleBookmark={handleToggleBookmark}
          onLoadMore={loadMoreArticles}
          hasMore={hasMore}
          isLoadingMore={isLoadingMore}
          onMenuClick={() => setIsSidebarOpen(true)}
        />
        
        <ReaderView 
          article={selectedArticle} 
          onToggleBookmark={handleToggleBookmark}
          onToggleRead={handleToggleRead}
          onBackToList={() => setSelectedArticle(undefined)}
        />

        {/* Global Sync Notification / Progress Pill */}
        {(syncStatus.isSyncing || syncStatus.showNotification) && (
          <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[100] animate-in slide-in-from-bottom-4 fade-in duration-300">
            <div className="bg-slate-900/90 dark:bg-zinc-800/90 backdrop-blur-xl border border-slate-700/50 dark:border-zinc-700/50 shadow-2xl rounded-2xl px-6 py-4 flex flex-col gap-3 min-w-[280px]">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  {syncStatus.isSyncing ? (
                    <RefreshCw className="w-4 h-4 text-indigo-400 dark:text-emerald-400 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  )}
                  <span className="text-sm font-bold text-white">
                    {syncStatus.isSyncing 
                      ? `Syncing feeds (${syncStatus.current}/${syncStatus.total})` 
                      : `Sync complete: ${syncStatus.newArticles} new articles`}
                  </span>
                </div>
                {!syncStatus.isSyncing && (
                  <button 
                    onClick={() => setSyncStatus(prev => ({ ...prev, showNotification: false }))}
                    className="p-1 hover:bg-white/10 rounded-md text-slate-400 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              
              {syncStatus.isSyncing && (
                <div className="w-full h-1.5 bg-slate-800 dark:bg-zinc-700 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-indigo-500 dark:bg-emerald-500 transition-all duration-500 ease-out" 
                    style={{ width: `${(syncStatus.current / syncStatus.total) * 100}%` }}
                  />
                </div>
              )}
            </div>
          </div>
        )}

        <button 
          onClick={() => setIsDocOpen(true)}
          className="fixed bottom-8 right-8 p-5 bg-indigo-600 dark:bg-purple-600 text-white rounded-[1.5rem] shadow-2xl shadow-indigo-500/20 dark:shadow-purple-500/20 hover:bg-indigo-700 dark:hover:bg-purple-700 active:scale-90 transition-all z-30 flex items-center gap-2 group"
          aria-label="Open Documentation"
        >
          <HelpCircle className="w-6 h-6" />
          <span className="font-black text-sm max-w-0 overflow-hidden group-hover:max-w-xs transition-all duration-300 whitespace-nowrap px-0 group-hover:px-2">System Architecture</span>
        </button>
      </main>

      {isManagementOpen && (
        <ManagementUI 
          feeds={feeds}
          folders={folders}
          onAddFeed={handleAddFeed}
          onRefreshFeed={handleRefreshFeed}
          onImportData={handleImportData}
          onUpdateFeed={handleUpdateFeed}
          onDeleteFeed={handleDeleteFeed}
          onUpdateFeedFolder={handleUpdateFeedFolder}
          onCreateFolder={handleCreateFolder}
          onClose={() => setIsManagementOpen(false)}
        />
      )}

      {isSettingsOpen && (
        <SettingsUI 
          onClose={() => setIsSettingsOpen(false)} 
          onSettingsUpdate={(s) => setSettings(s)}
        />
      )}

      {isDocOpen && (
        <Documentation onClose={() => setIsDocOpen(false)} />
      )}
    </div>
  );
};

export default App;