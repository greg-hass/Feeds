import React, { useRef, useEffect, useCallback } from 'react';
import { Article, ActiveView, Feed } from '../types';
import { 
  CheckCircle, 
  Circle, 
  Clock, 
  Search, 
  Ghost, 
  Youtube, 
  MessageSquare, 
  Rss, 
  Mic2, 
  Loader2, 
  Bookmark,
  Menu,
  BookOpen
} from 'lucide-react';

interface ArticleListProps {
  articles: Article[];
  feeds: Feed[];
  selectedArticleId?: string;
  onSelect: (article: Article) => void;
  onToggleRead: (articleId: string) => void;
  onToggleBookmark: (articleId: string) => void;
  activeView: ActiveView;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  onLoadMore: () => void;
  hasMore: boolean;
  isLoadingMore: boolean;
  onMenuClick: () => void;
}

const ArticleList: React.FC<ArticleListProps> = ({ 
  articles, 
  feeds,
  selectedArticleId, 
  onSelect, 
  onToggleRead,
  onToggleBookmark,
  activeView,
  searchQuery,
  setSearchQuery,
  onLoadMore,
  hasMore,
  isLoadingMore,
  onMenuClick
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  const lastArticleRef = useCallback((node: HTMLDivElement | null) => {
    if (isLoadingMore) return;
    if (observerRef.current) observerRef.current.disconnect();
    
    observerRef.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) {
        onLoadMore();
      }
    });
    
    if (node) observerRef.current.observe(node);
  }, [isLoadingMore, hasMore, onLoadMore]);

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    if (diff < 86400000) { 
      const hours = Math.floor(diff / 3600000);
      if (hours === 0) return 'Just now';
      return `${hours}h ago`;
    }
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  const getFeedIcon = (feedId: string) => {
    const feed = feeds.find(f => f.id === feedId);
    const FallbackIcon = <Rss className="w-3.5 h-3.5 text-indigo-500" />;
    
    if (!feed) return FallbackIcon;
    
    switch (feed.type) {
      case 'YOUTUBE': 
        return <Youtube className="w-3.5 h-3.5 text-red-500" />;
      case 'REDDIT': 
        return <MessageSquare className="w-3.5 h-3.5 text-orange-500" />;
      case 'PODCAST': 
        return <Mic2 className="w-3.5 h-3.5 text-purple-500" />;
      default: 
        if (feed.siteUrl) {
          return (
            <img 
              src={`https://www.google.com/s2/favicons?domain=${new URL(feed.siteUrl).hostname}&sz=32`} 
              className="w-3.5 h-3.5 rounded-sm object-contain" 
              alt=""
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
                if (target.parentElement) {
                  target.parentElement.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-3.5 h-3.5 text-indigo-500"><path d="M4 11a9 9 0 0 1 9 9"></path><path d="M4 4a16 16 0 0 1 16 16"></path><circle cx="5" cy="19" r="1"></circle></svg>';
                }
              }}
            />
          );
        }
        return FallbackIcon;
    }
  };

  return (
    <div className={`w-full md:w-96 flex-shrink-0 border-r border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex flex-col h-full overflow-hidden transition-colors duration-300 ${selectedArticleId ? 'hidden md:flex' : 'flex'}`}>
      <div className="p-4 border-b border-slate-100 dark:border-zinc-800 bg-slate-50/80 dark:bg-zinc-900/80 backdrop-blur-sm sticky top-0 z-10 space-y-3 shadow-sm">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <button 
              onClick={onMenuClick}
              className="p-1 -ml-1 hover:bg-slate-200 dark:hover:bg-zinc-800 rounded-md md:hidden transition-colors"
            >
              <Menu className="w-5 h-5 text-slate-600 dark:text-zinc-300" />
            </button>
            <h2 className="font-bold text-slate-900 dark:text-zinc-100 tracking-tight">{activeView.title}</h2>
          </div>
          <button className="text-[11px] uppercase tracking-wider text-indigo-600 dark:text-emerald-400 font-bold hover:text-indigo-800 dark:hover:text-emerald-300 transition-colors">
            Mark all read
          </button>
        </div>
        
        {activeView.type === 'search' && (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-zinc-500" />
            <input 
              autoFocus
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search in all subscriptions..."
              className="w-full pl-9 pr-3 py-2 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm text-slate-900 dark:text-zinc-100 focus:ring-2 focus:ring-indigo-500 dark:focus:ring-emerald-500 focus:border-indigo-500 dark:focus:border-emerald-500 outline-none shadow-sm transition-all placeholder:text-slate-400"
            />
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto" ref={scrollRef}>
        {articles.length === 0 ? (
          <div className="p-12 text-center text-slate-400 flex flex-col items-center gap-4">
            <Ghost className="w-12 h-12 opacity-10 dark:opacity-5" />
            <div>
              <p className="font-bold text-slate-600 dark:text-zinc-400">{activeView.type === 'search' && !searchQuery ? 'Search feeds...' : 'Nothing to read'}</p>
              <p className="text-xs opacity-60">You're all caught up for now.</p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col">
            {articles.map((article, index) => {
              const isLast = index === articles.length - 1;
              return (
                <div
                  key={article.id}
                  ref={isLast ? lastArticleRef : null}
                  onClick={() => onSelect(article)}
                  className={`px-5 py-4 border-b border-slate-50 dark:border-zinc-800/50 cursor-pointer transition-all relative group flex flex-col gap-1.5 ${
                    selectedArticleId === article.id ? 'bg-indigo-50/60 dark:bg-emerald-900/20 shadow-[inset_4px_0_0_0_#4f46e5] dark:shadow-[inset_4px_0_0_0_#10b981]' : 'hover:bg-slate-50 dark:hover:bg-zinc-800/40'
                  } ${!article.read ? 'bg-white dark:bg-zinc-900' : 'opacity-60 bg-slate-50/20 dark:bg-zinc-900/20'}`}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2 overflow-hidden mr-4">
                      <div className="flex-shrink-0 flex items-center justify-center w-4 h-4">
                        {getFeedIcon(article.feedId)}
                      </div>
                      <span className="text-[10px] font-black text-slate-500 dark:text-zinc-400 uppercase tracking-widest truncate">
                        {article.author || 'Anonymous'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {article.bookmarked && <Bookmark className="w-3 h-3 text-indigo-500 dark:text-purple-500 fill-indigo-500 dark:fill-purple-500" />}
                      <span className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 whitespace-nowrap">
                        {formatDate(article.publishedAt)}
                      </span>
                    </div>
                  </div>
                  
                  <h3 className={`text-[15px] leading-snug tracking-tight transition-colors duration-300 ${!article.read ? 'font-bold text-slate-900 dark:text-zinc-100' : 'font-medium text-slate-600 dark:text-zinc-400'}`}>
                    {article.title}
                  </h3>
                  
                  <p className="text-xs text-slate-500 dark:text-zinc-400 line-clamp-2 leading-relaxed font-medium">
                    {article.summary}
                  </p>

                  <div className="mt-1 flex items-center justify-between">
                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleBookmark(article.id);
                        }}
                        className={`opacity-0 group-hover:opacity-100 transition-all p-1.5 bg-white dark:bg-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-700 rounded-lg shadow-sm border border-slate-200 dark:border-zinc-700 ${article.bookmarked ? 'text-indigo-600 dark:text-purple-400' : 'text-slate-400 dark:text-zinc-500'}`}
                        title={article.bookmarked ? 'Remove bookmark' : 'Bookmark'}
                      >
                        <Bookmark className={`w-4 h-4 ${article.bookmarked ? 'fill-indigo-600 dark:fill-purple-400' : ''}`} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleRead(article.id);
                        }}
                        className="opacity-0 group-hover:opacity-100 transition-all p-1.5 bg-white dark:bg-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-700 rounded-lg shadow-sm border border-slate-200 dark:border-zinc-700"
                        title={article.read ? 'Mark as unread' : 'Mark as read'}
                      >
                        {article.read ? <Circle className="w-4 h-4 text-slate-400 dark:text-zinc-500" /> : <CheckCircle className="w-4 h-4 text-indigo-500 dark:text-emerald-500" />}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
            
            {(isLoadingMore || hasMore) && (
              <div className="p-8 flex justify-center">
                {isLoadingMore ? (
                  <Loader2 className="w-6 h-6 text-indigo-400 dark:text-emerald-400 animate-spin" />
                ) : (
                  <span className="text-xs text-slate-400 dark:text-zinc-500 font-bold uppercase tracking-widest cursor-pointer hover:text-indigo-600 dark:hover:text-emerald-400 transition-colors" onClick={onLoadMore}>Load more</span>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ArticleList;