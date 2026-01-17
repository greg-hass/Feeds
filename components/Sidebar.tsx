import React, { useState } from 'react';
import { 
  Rss, 
  Youtube, 
  MessageSquare, 
  Mic2, 
  Settings, 
  Plus, 
  Inbox, 
  Search,
  BookOpen,
  Folder as FolderIcon,
  ChevronRight,
  ChevronDown,
  Bookmark,
  X
} from 'lucide-react';
import { Feed, FeedType, Folder, ActiveView } from '../types';

interface SidebarProps {
  feeds: Feed[];
  folders: Folder[];
  activeView: ActiveView;
  isSidebarOpen: boolean;
  onViewChange: (view: ActiveView) => void;
  onOpenSettings: () => void;
  onOpenAdd: () => void;
  onToggleSidebar: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ 
  feeds, 
  folders,
  activeView, 
  isSidebarOpen,
  onViewChange, 
  onOpenSettings, 
  onOpenAdd,
  onToggleSidebar
}) => {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());

  const getUnreadCount = (feedType?: FeedType) => {
    return feeds
      .filter(f => !feedType || f.type === feedType)
      .reduce((acc, f) => acc + f.unreadCount, 0);
  };

  const smartFolders: Array<{ id: string; icon: any; label: string; type: 'all' | 'folder' | 'feed' | 'smart' | 'search'; feedType?: FeedType }> = [
    { id: 'all', icon: Inbox, label: 'All Feeds', type: 'all' },
    { id: 'bookmarks', icon: Bookmark, label: 'Bookmarks', type: 'smart' },
    { id: 'rss', icon: Rss, label: 'RSS', type: 'smart', feedType: 'RSS' },
    { id: 'youtube', icon: Youtube, label: 'YouTube', type: 'smart', feedType: 'YOUTUBE' },
    { id: 'reddit', icon: MessageSquare, label: 'Reddit', type: 'smart', feedType: 'REDDIT' },
    { id: 'podcast', icon: Mic2, label: 'Podcasts', type: 'smart', feedType: 'PODCAST' }
  ];

  const toggleFolder = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const next = new Set(expandedFolders);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpandedFolders(next);
  };

  const renderFeedButton = (feed: Feed, depth = 0) => (
    <button
      key={feed.id}
      onClick={() => onViewChange({ type: 'feed', id: feed.id, title: feed.title })}
      className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-sm transition-all group ${
        activeView.id === feed.id 
          ? 'bg-indigo-600 dark:bg-emerald-600 text-white shadow-lg shadow-indigo-200 dark:shadow-none' 
          : 'text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800/50'
      }`}
      style={{ paddingLeft: `${depth * 12 + 12}px` }}
    >
      <div className="flex items-center gap-2 truncate">
        <div className="w-4 h-4 flex-shrink-0 flex items-center justify-center opacity-70 group-hover:opacity-100 transition-opacity">
          {feed.type === 'YOUTUBE' ? <Youtube className="w-3 h-3"/> : 
           feed.type === 'REDDIT' ? <MessageSquare className="w-3 h-3"/> :
           feed.type === 'PODCAST' ? <Mic2 className="w-3 h-3"/> :
           <Rss className="w-3 h-3"/>}
        </div>
        <span className="truncate font-medium">{feed.title}</span>
      </div>
      {feed.unreadCount > 0 && (
        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-black ${
          activeView.id === feed.id ? 'bg-indigo-500 dark:bg-emerald-500 text-white' : 'bg-slate-200 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400'
        }`}>
          {feed.unreadCount}
        </span>
      )}
    </button>
  );

  return (
    <aside className={`
      fixed inset-y-0 left-0 z-50 w-72 bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 flex flex-col h-full border-r border-slate-100 dark:border-zinc-800
      transition-transform duration-300 ease-in-out md:translate-x-0 md:static md:w-64
      ${isSidebarOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'}
    `}>
      <div className="p-6 flex items-center justify-between">
        <div className="flex items-center gap-2 font-black text-slate-900 dark:text-white text-xl tracking-tighter">
          <div className="p-1.5 bg-indigo-600 dark:bg-emerald-600 text-white rounded-xl">
            <BookOpen className="w-5 h-5" />
          </div>
          <span>FEEDS</span>
        </div>
        <div className="flex items-center gap-1">
          <button 
            onClick={onOpenAdd}
            className="p-2 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-xl transition-colors text-slate-500 dark:text-zinc-400"
            title="Add New Feed"
          >
            <Plus className="w-5 h-5" />
          </button>
          <button 
            onClick={onToggleSidebar}
            className="p-2 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-xl transition-colors md:hidden text-slate-500 dark:text-zinc-400"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="px-4 mb-6">
        <button 
          onClick={() => onViewChange({ type: 'search', title: 'Search' })}
          className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm transition-all border ${
            activeView.type === 'search' 
              ? 'bg-indigo-50 dark:bg-emerald-900/20 border-indigo-200 dark:border-emerald-800 text-indigo-600 dark:text-emerald-400' 
              : 'bg-slate-50 dark:bg-zinc-800/50 hover:bg-slate-100 dark:hover:bg-zinc-800 border-transparent text-slate-400 dark:text-zinc-500'
          }`}
        >
          <Search className="w-4 h-4" />
          <span className="font-bold">Search Articles...</span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 space-y-8 pb-8 scrollbar-hide">
        <div>
          <h3 className="px-3 text-[10px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-[0.2em] mb-3">Library</h3>
          <div className="space-y-1">
            {smartFolders.map(folder => {
              const count = folder.id === 'bookmarks' ? 0 : getUnreadCount(folder.feedType);
              const isActive = activeView.id === folder.id;
              return (
                <button
                  key={folder.id}
                  onClick={() => onViewChange({ type: folder.type, id: folder.id, title: folder.label })}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm transition-all group ${
                    isActive 
                      ? 'bg-indigo-600 dark:bg-emerald-600 text-white shadow-lg shadow-indigo-200 dark:shadow-none' 
                      : 'text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800/50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <folder.icon className={`w-4 h-4 ${isActive ? 'text-white' : folder.id === 'bookmarks' ? 'text-indigo-500 dark:text-purple-500' : 'text-slate-400 dark:text-zinc-500'}`} />
                    <span className="font-bold">{folder.label}</span>
                  </div>
                  {count > 0 && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-black ${
                      isActive ? 'bg-indigo-500 dark:bg-emerald-500 text-white' : 'bg-slate-200 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400'
                    }`}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between px-3 mb-3">
            <h3 className="text-[10px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-[0.2em]">Subscriptions</h3>
          </div>
          
          <div className="space-y-1">
            {folders.map(folder => {
              const isExpanded = expandedFolders.has(folder.id);
              const folderFeeds = feeds.filter(f => f.folderId === folder.id);
              const totalUnread = folderFeeds.reduce((acc, f) => acc + f.unreadCount, 0);
              const isActive = activeView.id === folder.id;

              return (
                <div key={folder.id} className="space-y-1">
                  <button
                    onClick={() => onViewChange({ type: 'folder', id: folder.id, title: folder.name })}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm transition-all group ${
                      isActive 
                        ? 'bg-indigo-600/10 dark:bg-emerald-600/10 text-indigo-600 dark:text-emerald-400 border border-indigo-100 dark:border-emerald-900/50' 
                        : 'text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800/50 border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div 
                        onClick={(e) => toggleFolder(e, folder.id)}
                        className="p-1 hover:bg-indigo-100 dark:hover:bg-emerald-900/50 rounded-lg transition-colors text-slate-400"
                      >
                        {isExpanded ? <ChevronDown className="w-3 h-3"/> : <ChevronRight className="w-3 h-3"/>}
                      </div>
                      <FolderIcon className={`w-3.5 h-3.5 ${isActive ? 'text-indigo-600 dark:text-emerald-400' : 'text-slate-400 dark:text-zinc-500'}`} />
                      <span className="truncate font-bold">{folder.name}</span>
                    </div>
                    {totalUnread > 0 && (
                      <span className="text-[10px] bg-slate-200 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 px-1.5 py-0.5 rounded-full font-black">
                        {totalUnread}
                      </span>
                    )}
                  </button>
                  {isExpanded && (
                    <div className="mt-1 space-y-0.5 border-l-2 border-slate-100 dark:border-zinc-800 ml-5 pl-2 animate-in slide-in-from-top-1 duration-200">
                      {folderFeeds.map(f => renderFeedButton(f, 0))}
                    </div>
                  )}
                </div>
              );
            })}

            {feeds.filter(f => !f.folderId).map(feed => renderFeedButton(feed))}
          </div>
        </div>
      </div>

      <div className="p-4 border-t border-slate-100 dark:border-zinc-800">
        <button 
          onClick={onOpenSettings}
          className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-bold text-slate-500 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
        >
          <Settings className="w-4 h-4" />
          <span>System Settings</span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;