import React, { useState, useRef, useEffect } from 'react';
import { 
  X, 
  Upload, 
  Download, 
  FolderPlus, 
  Search, 
  Loader2,
  Trash2,
  Move,
  Check,
  Folder as FolderIcon,
  ChevronRight,
  Globe,
  Youtube,
  MessageSquare,
  Rss,
  Edit2,
  AlertCircle,
  ExternalLink,
  RefreshCw,
  Plus
} from 'lucide-react';
import { Feed, Folder } from '../types';
import { GeminiService } from '../services/geminiService';

interface ManagementUIProps {
  onClose: () => void;
  feeds: Feed[];
  folders: Folder[];
  onAddFeed: (feed: Partial<Feed>) => Promise<void>;
  onRefreshFeed: (feedId: string) => Promise<number | void>;
  onImportData: (folderNames: string[], feeds: Partial<Feed>[]) => Promise<void>;
  onUpdateFeed: (feedId: string, updates: Partial<Feed>) => Promise<void>;
  onDeleteFeed: (feedId: string) => Promise<void>;
  onUpdateFeedFolder: (feedId: string, folderId: string | undefined) => Promise<void>;
  onCreateFolder: (name: string) => Promise<Folder | undefined>;
}

const ManagementUI: React.FC<ManagementUIProps> = ({ 
  onClose, 
  feeds, 
  folders, 
  onAddFeed,
  onRefreshFeed,
  onImportData,
  onUpdateFeed,
  onDeleteFeed, 
  onUpdateFeedFolder,
  onCreateFolder 
}) => {
  const [activeTab, setActiveTab] = useState<'add' | 'manage' | 'import'>('add');
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [addedUrls, setAddedUrls] = useState<Set<string>>(new Set());
  const [draggedFeedId, setDraggedFeedId] = useState<string | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(['uncategorized']));
  const [selectedFeedId, setSelectedFeedId] = useState<string | null>(null);
  
  // Folder Creation State
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  
  const selectedFeed = feeds.find(f => f.id === selectedFeedId);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isCreatingFolder && folderInputRef.current) {
      folderInputRef.current.focus();
    }
  }, [isCreatingFolder]);

  const isUrl = (str: string) => {
    try {
      new URL(str);
      return true;
    } catch {
      return false;
    }
  };

  const handleDiscovery = async () => {
    if (!query.trim()) return;
    setIsSearching(true);
    setSuggestions([]);
    
    try {
      let results;
      if (isUrl(query)) {
        results = await GeminiService.discoverFeedFromUrl(query);
      } else {
        results = await GeminiService.suggestFeedsByKeyword(query);
      }
      setSuggestions(results);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSearching(false);
    }
  };

  const handleAddAction = async (item: any) => {
    try {
      await onAddFeed({
        title: item.title,
        url: item.url,
        type: item.type
      });
      setAddedUrls(prev => new Set([...prev, item.url]));
    } catch (err) {
      alert("Failed to add feed.");
    }
  };

  const handleDelete = async (feedId: string, title: string) => {
    if (window.confirm(`Are you sure you want to delete "${title}"? All its articles will be removed.`)) {
      setDeletingId(feedId);
      await onDeleteFeed(feedId);
      setDeletingId(null);
    }
  };

  const handleCreateFolderSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newFolderName.trim()) {
      setIsCreatingFolder(false);
      return;
    }
    
    await onCreateFolder(newFolderName.trim());
    setNewFolderName('');
    setIsCreatingFolder(false);
  };

  const handleExportOPML = () => {
    const escapeXml = (unsafe: string) => {
        return unsafe.replace(/[<>&"']/g, (c) => {
            switch (c) {
                case '<': return '&lt;';
                case '>': return '&gt;';
                case '&': return '&amp;';
                case '"': return '&quot;';
                case "'": return '&apos;';
                default: return c;
            }
        });
    };

    let opml = `<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <head>
    <title>Feeds Export</title>
    <dateCreated>${new Date().toUTCString()}</dateCreated>
  </head>
  <body>`;

    folders.forEach(folder => {
      const folderFeeds = feeds.filter(f => f.folderId === folder.id);
      opml += `\n    <outline text="${escapeXml(folder.name)}" title="${escapeXml(folder.name)}">`;
      folderFeeds.forEach(f => {
        opml += `\n      <outline type="rss" text="${escapeXml(f.title)}" title="${escapeXml(f.title)}" xmlUrl="${escapeXml(f.url)}" htmlUrl="${escapeXml(f.siteUrl || '')}"/>`;
      });
      opml += `\n    </outline>`;
    });

    feeds.filter(f => !f.folderId).forEach(f => {
      opml += `\n    <outline type="rss" text="${escapeXml(f.title)}" title="${escapeXml(f.title)}" xmlUrl="${escapeXml(f.url)}" htmlUrl="${escapeXml(f.siteUrl || '')}"/>`;
    });

    opml += `\n  </body>\n</opml>`;

    const blob = new Blob([opml], { type: 'text/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `feeds-export-${new Date().toISOString().split('T')[0]}.opml`;
    a.click();
  };

  const handleImportOPML = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const xml = event.target?.result as string;
        const parser = new DOMParser();
        const doc = parser.parseFromString(xml, "text/xml");
        const body = doc.querySelector('body');
        
        if (!body) throw new Error("Invalid OPML structure");

        const gatheredFeeds: Partial<Feed>[] = [];
        const gatheredFolderNames = new Set<string>();

        const processOutline = (element: Element, currentFolderName?: string) => {
          const children = Array.from(element.children).filter(c => c.tagName.toLowerCase() === 'outline');
          const xmlUrl = element.getAttribute('xmlUrl');
          const text = element.getAttribute('text') || element.getAttribute('title') || 'Untitled';

          if (xmlUrl) {
            gatheredFeeds.push({
              title: text,
              url: xmlUrl,
              type: 'RSS',
              folderId: currentFolderName
            });
          }

          if (children.length > 0) {
            let nextFolderName = currentFolderName;
            if (!xmlUrl) {
              nextFolderName = text;
              gatheredFolderNames.add(nextFolderName);
            }
            
            for (const child of children) {
              processOutline(child, nextFolderName);
            }
          }
        };

        const topLevelOutlines = Array.from(body.children).filter(c => c.tagName.toLowerCase() === 'outline');
        for (const outline of topLevelOutlines) {
          processOutline(outline);
        }

        await onImportData(Array.from(gatheredFolderNames), gatheredFeeds);
        alert(`Import Complete! Processed ${gatheredFeeds.length} feeds across ${gatheredFolderNames.size} folders.`);
      } catch (err) {
        console.error(err);
        alert("Failed to parse OPML. Please check the file format.");
      } finally {
        setIsImporting(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  const toggleFolder = (folderId: string) => {
    const next = new Set(expandedFolders);
    if (next.has(folderId)) next.delete(folderId);
    else next.add(folderId);
    setExpandedFolders(next);
  };

  const onDragStart = (e: React.DragEvent, feedId: string) => {
    setDraggedFeedId(feedId);
    e.dataTransfer.setData('feedId', feedId);
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const onDrop = async (e: React.DragEvent, folderId: string | undefined) => {
    e.preventDefault();
    const feedId = e.dataTransfer.getData('feedId') || draggedFeedId;
    if (feedId) {
      await onUpdateFeedFolder(feedId, folderId);
    }
    setDraggedFeedId(null);
  };

  const renderFeedItem = (feed: Feed) => (
    <div 
      key={feed.id}
      draggable
      onDragStart={(e) => onDragStart(e, feed.id)}
      className={`flex items-center justify-between p-3 bg-white dark:bg-zinc-800 rounded-xl group border border-slate-100 dark:border-zinc-700 hover:border-indigo-200 dark:hover:border-emerald-800 hover:shadow-sm transition-all cursor-grab active:cursor-grabbing ${draggedFeedId === feed.id ? 'opacity-40' : ''}`}
    >
      <div className="flex items-center gap-3 overflow-hidden">
        <div className="w-8 h-8 flex-shrink-0 bg-slate-50 dark:bg-zinc-700 rounded-lg flex items-center justify-center text-slate-400 dark:text-zinc-500 group-hover:bg-indigo-50 dark:group-hover:bg-emerald-900/30 group-hover:text-indigo-600 dark:group-hover:text-emerald-400 transition-colors">
          {feed.isRefreshing ? <Loader2 className="w-4 h-4 animate-spin text-indigo-600 dark:text-emerald-400" /> : <Move className="w-4 h-4 opacity-50" />}
        </div>
        <div className="overflow-hidden">
          <span className="font-bold text-xs text-slate-800 dark:text-zinc-100 block truncate">{feed.title}</span>
          <span className="text-[9px] text-slate-400 dark:text-zinc-500 truncate block">{feed.url}</span>
        </div>
      </div>
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button 
          onClick={() => setSelectedFeedId(feed.id)}
          className="p-1.5 hover:bg-indigo-50 dark:hover:bg-zinc-700 rounded-lg text-slate-400 dark:text-zinc-400 hover:text-indigo-600 dark:hover:text-emerald-400"
          title="Edit Details"
        >
          <Edit2 className="w-3.5 h-3.5" />
        </button>
        <button 
          onClick={() => handleDelete(feed.id, feed.title)}
          className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg text-slate-400 dark:text-zinc-400 hover:text-red-500 dark:hover:text-red-400"
          disabled={deletingId === feed.id}
          title="Delete Feed"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 dark:bg-zinc-950/80 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-zinc-900 w-full max-w-4xl h-[80vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 transition-colors duration-300">
        <div className="p-6 border-b border-slate-100 dark:border-zinc-800 flex items-center justify-between bg-white dark:bg-zinc-900 transition-colors duration-300">
          <h2 className="text-xl font-bold text-slate-800 dark:text-zinc-100">Feed Management</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-full text-slate-400 dark:text-zinc-500 transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex border-b border-slate-100 dark:border-zinc-800 px-6 bg-slate-50/50 dark:bg-zinc-900/50 transition-colors duration-300">
          <button 
            onClick={() => setActiveTab('add')}
            className={`px-6 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'add' ? 'border-indigo-600 dark:border-emerald-600 text-indigo-600 dark:text-emerald-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-zinc-300'}`}
          >
            Add New Feed
          </button>
          <button 
            onClick={() => setActiveTab('manage')}
            className={`px-6 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'manage' ? 'border-indigo-600 dark:border-emerald-600 text-indigo-600 dark:text-emerald-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-zinc-300'}`}
          >
            Manage Library
          </button>
          <button 
            onClick={() => setActiveTab('import')}
            className={`px-6 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'import' ? 'border-indigo-600 dark:border-emerald-600 text-indigo-600 dark:text-emerald-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-zinc-300'}`}
          >
            Import / Export
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-8 bg-slate-50/20 dark:bg-zinc-950/10 transition-colors duration-300">
          {activeTab === 'add' && (
            <div className="max-w-xl mx-auto space-y-8">
              <div className="space-y-4 text-center">
                <div className="p-4 bg-indigo-50 dark:bg-emerald-900/20 rounded-3xl inline-block mb-4 transition-colors">
                  {isUrl(query) ? <Globe className="w-10 h-10 text-indigo-600 dark:text-emerald-400" /> : <Search className="w-10 h-10 text-indigo-600 dark:text-emerald-400" />}
                </div>
                <h3 className="text-2xl font-black text-slate-900 dark:text-zinc-100 transition-colors">
                  {isUrl(query) ? 'Analyze URL' : 'Discover Content'}
                </h3>
                <p className="text-slate-500 dark:text-zinc-400 text-sm">Paste a blog URL, YouTube channel, or just a topic.</p>
                
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input 
                      autoFocus
                      type="text" 
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleDiscovery()}
                      placeholder="e.g., Space Exploration or https://theverge.com"
                      className="w-full pl-6 pr-4 py-4 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-2xl text-slate-900 dark:text-zinc-100 shadow-sm focus:ring-2 focus:ring-indigo-500 dark:focus:ring-emerald-500 focus:border-indigo-500 dark:focus:border-emerald-500 outline-none transition-all font-medium placeholder:text-slate-400"
                    />
                  </div>
                  <button 
                    onClick={handleDiscovery}
                    disabled={isSearching || !query.trim()}
                    className="bg-indigo-600 dark:bg-emerald-600 text-white px-8 py-4 rounded-2xl font-bold hover:bg-indigo-700 dark:hover:bg-emerald-700 active:scale-95 transition-all flex items-center gap-2 disabled:opacity-50 shadow-lg shadow-indigo-200 dark:shadow-none"
                  >
                    {isSearching ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Search'}
                  </button>
                </div>
              </div>

              {suggestions.length > 0 && (
                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="flex items-center justify-between px-1">
                    <h3 className="text-xs font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest">
                      {isUrl(query) ? 'Found Feed' : 'Top Matches'}
                    </h3>
                  </div>
                  {suggestions.map((s, i) => {
                    const isAdded = addedUrls.has(s.url) || feeds.some(f => f.url === s.url);
                    return (
                      <div key={i} className="flex items-center justify-between p-5 bg-white dark:bg-zinc-800 border border-slate-100 dark:border-zinc-700 rounded-3xl shadow-sm hover:border-indigo-200 dark:hover:border-emerald-800 transition-all group transition-colors duration-300">
                        <div className="flex items-center gap-5">
                          <div className="w-14 h-14 bg-slate-50 dark:bg-zinc-700 rounded-2xl flex items-center justify-center text-slate-400 dark:text-zinc-500 group-hover:bg-indigo-50 dark:group-hover:bg-emerald-900/30 group-hover:text-indigo-600 dark:group-hover:text-emerald-400 transition-colors">
                            {s.type === 'YOUTUBE' ? <Youtube className="w-6 h-6" /> : 
                             s.type === 'REDDIT' ? <MessageSquare className="w-6 h-6" /> :
                             <Rss className="w-6 h-6" />}
                          </div>
                          <div className="overflow-hidden">
                            <p className="font-black text-slate-800 dark:text-zinc-100 text-sm truncate transition-colors">{s.title}</p>
                            <p className="text-xs text-slate-400 dark:text-zinc-500 truncate mb-1 transition-colors">{s.url}</p>
                            <span className="text-[9px] px-1.5 py-0.5 bg-slate-100 dark:bg-zinc-700 text-slate-500 dark:text-zinc-400 font-bold rounded uppercase tracking-tighter transition-colors">{s.type}</span>
                          </div>
                        </div>
                        <button 
                          onClick={() => handleAddAction(s)}
                          disabled={isAdded}
                          className={`px-6 py-3 text-xs font-black rounded-2xl transition-all flex items-center gap-2 ${
                            isAdded ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 cursor-default' : 'bg-slate-900 dark:bg-emerald-600 text-white hover:bg-slate-800 dark:hover:bg-emerald-700 active:scale-95 shadow-lg shadow-slate-200 dark:shadow-none'
                          }`}
                        >
                          {isAdded ? <><Check className="w-3.5 h-3.5" /> Added</> : 'Add Feed'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === 'manage' && (
            <div className="space-y-8 animate-in fade-in duration-300">
              <div className="flex justify-between items-center bg-white dark:bg-zinc-800 p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-zinc-700 transition-colors">
                <div>
                  <h3 className="font-black text-slate-900 dark:text-zinc-100 text-lg">Organize Library</h3>
                  <p className="text-sm text-slate-500 dark:text-zinc-400">Drag subscriptions into folders or edit details</p>
                </div>
                
                {!isCreatingFolder ? (
                  <button 
                    onClick={() => setIsCreatingFolder(true)}
                    className="flex items-center gap-2 px-5 py-3 bg-indigo-600 dark:bg-emerald-600 text-white text-sm font-bold rounded-2xl shadow-lg shadow-indigo-100 dark:shadow-none hover:bg-indigo-700 dark:hover:bg-emerald-700 transition-all active:scale-95"
                  >
                    <FolderPlus className="w-4 h-4" /> New Folder
                  </button>
                ) : (
                  <form onSubmit={handleCreateFolderSubmit} className="flex items-center gap-2 animate-in slide-in-from-right-2 duration-200">
                    <input 
                      ref={folderInputRef}
                      type="text"
                      placeholder="Folder Name"
                      value={newFolderName}
                      onChange={(e) => setNewFolderName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') {
                          setIsCreatingFolder(false);
                          setNewFolderName('');
                        }
                      }}
                      className="px-4 py-2.5 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 dark:focus:ring-emerald-500 outline-none w-48"
                    />
                    <button 
                      type="submit"
                      disabled={!newFolderName.trim()}
                      className="p-2.5 bg-indigo-600 dark:bg-emerald-600 text-white rounded-xl hover:bg-indigo-700 dark:hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button 
                      type="button"
                      onClick={() => {
                        setIsCreatingFolder(false);
                        setNewFolderName('');
                      }}
                      className="p-2.5 bg-slate-100 dark:bg-zinc-700 text-slate-500 dark:text-zinc-400 rounded-xl hover:bg-slate-200 dark:hover:bg-zinc-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </form>
                )}
              </div>

              <div className="space-y-6">
                {folders.map(folder => {
                  const folderFeeds = feeds.filter(f => f.folderId === folder.id);
                  const isExpanded = expandedFolders.has(folder.id);
                  return (
                    <div 
                      key={folder.id}
                      onDragOver={onDragOver}
                      onDrop={(e) => onDrop(e, folder.id)}
                      className={`rounded-3xl border transition-all duration-300 ${isExpanded ? 'bg-slate-50 dark:bg-zinc-800 border-slate-200 dark:border-zinc-700' : 'bg-white dark:bg-zinc-900 border-slate-100 dark:border-zinc-800 hover:border-indigo-100 dark:hover:border-emerald-900 shadow-sm'}`}
                    >
                      <button 
                        onClick={() => toggleFolder(folder.id)}
                        className="w-full flex items-center justify-between p-5"
                      >
                        <div className="flex items-center gap-4">
                          <div className={`transition-transform duration-300 ${isExpanded ? 'rotate-90' : ''}`}>
                            <ChevronRight className="w-4 h-4 text-slate-400 dark:text-zinc-500" />
                          </div>
                          <FolderIcon className={`w-6 h-6 ${isExpanded ? 'text-indigo-600 dark:text-emerald-400 fill-indigo-50 dark:fill-emerald-900/20' : 'text-slate-400 dark:text-zinc-500'}`} />
                          <span className="font-black text-slate-800 dark:text-zinc-100 transition-colors">{folder.name}</span>
                          <span className="text-[10px] bg-white dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 px-2.5 py-1 rounded-full font-black border border-slate-100 dark:border-zinc-700 transition-colors">
                            {folderFeeds.length}
                          </span>
                        </div>
                      </button>
                      {isExpanded && (
                        <div className="px-5 pb-5 grid grid-cols-1 md:grid-cols-2 gap-4 animate-in slide-in-from-top-2 duration-300">
                          {folderFeeds.length === 0 ? (
                            <div className="col-span-2 py-10 text-center text-slate-400 dark:text-zinc-500 text-xs border-2 border-dashed border-slate-200 dark:border-zinc-700 rounded-3xl">
                              Folder is empty. Drag feeds from Uncategorized here.
                            </div>
                          ) : (
                            folderFeeds.map(renderFeedItem)
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}

                <div 
                  onDragOver={onDragOver}
                  onDrop={(e) => onDrop(e, undefined)}
                  className={`rounded-3xl border transition-all duration-300 ${expandedFolders.has('uncategorized') ? 'bg-slate-50 dark:bg-zinc-800 border-slate-200 dark:border-zinc-700' : 'bg-white dark:bg-zinc-900 border-slate-100 dark:border-zinc-800'}`}
                >
                  <button 
                    onClick={() => toggleFolder('uncategorized')}
                    className="w-full flex items-center justify-between p-5"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`transition-transform duration-300 ${expandedFolders.has('uncategorized') ? 'rotate-90' : ''}`}>
                        <ChevronRight className="w-4 h-4 text-slate-400 dark:text-zinc-500" />
                      </div>
                      <span className="font-black text-slate-400 dark:text-zinc-500 uppercase tracking-widest text-xs transition-colors">Uncategorized Subscriptions</span>
                      <span className="text-[10px] bg-white dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 px-2.5 py-1 rounded-full font-black border border-slate-100 dark:border-zinc-700 transition-colors">
                        {feeds.filter(f => !f.folderId).length}
                      </span>
                    </div>
                  </button>
                  {expandedFolders.has('uncategorized') && (
                    <div className="px-5 pb-5 grid grid-cols-1 md:grid-cols-2 gap-4 animate-in slide-in-from-top-2 duration-300">
                      {feeds.filter(f => !f.folderId).length === 0 ? (
                        <div className="col-span-2 py-10 text-center text-slate-400 dark:text-zinc-500 text-xs border-2 border-dashed border-slate-200 dark:border-zinc-700 rounded-3xl">
                          Your workspace is clean. All feeds are filed!
                        </div>
                      ) : (
                        feeds.filter(f => !f.folderId).map(renderFeedItem)
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'import' && (
            <div className="max-w-3xl mx-auto py-12 animate-in fade-in duration-300">
              <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept=".opml,.xml" 
                onChange={handleImportOPML}
              />
              <div className="grid grid-cols-2 gap-8">
                <div 
                  onClick={() => !isImporting && fileInputRef.current?.click()}
                  className={`p-12 bg-white dark:bg-zinc-800 rounded-[40px] text-center group border border-slate-100 dark:border-zinc-700 hover:border-indigo-300 dark:hover:border-emerald-500 shadow-sm transition-all duration-500 ${isImporting ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:shadow-2xl hover:shadow-indigo-500/10 dark:hover:shadow-emerald-500/5'}`}
                >
                  <div className={`w-24 h-24 bg-indigo-50 dark:bg-emerald-900/20 rounded-[30px] flex items-center justify-center text-indigo-600 dark:text-emerald-400 mx-auto mb-8 transition-transform ${!isImporting && 'group-hover:scale-110 group-hover:rotate-6'}`}>
                    {isImporting ? <Loader2 className="w-12 h-12 animate-spin" /> : <Upload className="w-12 h-12" />}
                  </div>
                  <h4 className="font-black text-slate-900 dark:text-zinc-100 text-xl mb-3">{isImporting ? 'Importing...' : 'Import OPML'}</h4>
                  <p className="text-sm text-slate-500 dark:text-zinc-400 leading-relaxed">Migrate your library from another reader while preserving folders.</p>
                </div>
                <div 
                  onClick={handleExportOPML}
                  className="p-12 bg-white dark:bg-zinc-800 rounded-[40px] text-center group cursor-pointer border border-slate-100 dark:border-zinc-700 hover:border-indigo-300 dark:hover:border-emerald-500 shadow-sm hover:shadow-2xl hover:shadow-indigo-500/10 dark:hover:shadow-emerald-500/5 transition-all duration-500"
                >
                  <div className="w-24 h-24 bg-slate-100 dark:bg-zinc-700 rounded-[30px] flex items-center justify-center text-slate-600 dark:text-zinc-400 mx-auto mb-8 group-hover:scale-110 group-hover:-rotate-6 transition-transform">
                    <Download className="w-12 h-12" />
                  </div>
                  <h4 className="font-black text-slate-900 dark:text-zinc-100 text-xl mb-3">Export Library</h4>
                  <p className="text-sm text-slate-500 dark:text-zinc-400 leading-relaxed">Download a portable backup of your hierarchical library.</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Feed Detail/Edit Modal */}
      {selectedFeed && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 dark:bg-zinc-950/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-zinc-900 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 transition-colors duration-300">
            <div className="p-6 border-b border-slate-100 dark:border-zinc-800 flex items-center justify-between transition-colors">
              <h3 className="text-lg font-black text-slate-900 dark:text-zinc-100">Feed Settings</h3>
              <button 
                onClick={() => setSelectedFeedId(null)}
                className="p-2 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-full text-slate-400 dark:text-zinc-500 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              <div className="space-y-4">
                {/* Status Indicator Card */}
                <div className={`p-5 rounded-2xl border transition-all duration-300 ${
                  selectedFeed.isRefreshing ? 'bg-indigo-50 dark:bg-emerald-900/20 border-indigo-100 dark:border-emerald-800' : 
                  selectedFeed.error ? 'bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-800' : 'bg-slate-50 dark:bg-zinc-800/50 border-slate-100 dark:border-zinc-700'
                }`}>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${
                        selectedFeed.isRefreshing ? 'bg-indigo-500 dark:bg-emerald-500 animate-pulse' : 
                        selectedFeed.error ? 'bg-red-500' : 'bg-emerald-500'
                      }`} />
                      <span className="text-[10px] font-black uppercase tracking-[0.1em] text-slate-400 dark:text-zinc-500 transition-colors">Sync Status</span>
                    </div>
                    <button 
                      onClick={() => onRefreshFeed(selectedFeed.id)}
                      disabled={selectedFeed.isRefreshing}
                      className="p-2 hover:bg-white dark:hover:bg-zinc-700 rounded-xl text-indigo-600 dark:text-emerald-400 transition-all active:scale-90 disabled:opacity-50"
                      title="Manual Refresh"
                    >
                      <RefreshCw className={`w-4 h-4 ${selectedFeed.isRefreshing ? 'animate-spin' : ''}`} />
                    </button>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs transition-colors">
                      <span className="text-slate-500 dark:text-zinc-400">State</span>
                      <span className={`font-black ${
                        selectedFeed.isRefreshing ? 'text-indigo-600 dark:text-emerald-400' : 
                        selectedFeed.error ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'
                      }`}>
                        {selectedFeed.isRefreshing ? 'Syncing Content...' : 
                         selectedFeed.error ? 'Fetch Error' : 'Successful'}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs transition-colors">
                      <span className="text-slate-500 dark:text-zinc-400">Last Synced</span>
                      <span className="font-bold text-slate-700 dark:text-zinc-200">
                        {selectedFeed.lastFetched ? new Date(selectedFeed.lastFetched).toLocaleString() : 'Never'}
                      </span>
                    </div>
                  </div>

                  {selectedFeed.error && (
                    <div className="mt-4 p-3 bg-white/50 dark:bg-zinc-900/50 rounded-xl border border-red-100 dark:border-red-900 flex items-start gap-3 transition-colors">
                      <AlertCircle className="w-4 h-4 text-red-500 dark:text-red-400 flex-shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <p className="text-[10px] font-black text-red-400 dark:text-red-500 uppercase tracking-widest">Error Log</p>
                        <p className="text-[11px] text-red-700 dark:text-red-300 leading-relaxed italic">{selectedFeed.error}</p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-widest px-1 transition-colors">Feed Title</label>
                  <input 
                    type="text" 
                    value={selectedFeed.title}
                    onChange={(e) => onUpdateFeed(selectedFeed.id, { title: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-slate-900 dark:text-zinc-100 focus:ring-2 focus:ring-indigo-500 dark:focus:ring-emerald-500 outline-none font-bold text-sm transition-all"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-widest px-1 transition-colors">Feed URL</label>
                  <div className="relative">
                    <input 
                      type="text" 
                      value={selectedFeed.url}
                      onChange={(e) => onUpdateFeed(selectedFeed.id, { url: e.target.value })}
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-slate-900 dark:text-zinc-100 focus:ring-2 focus:ring-indigo-500 dark:focus:ring-emerald-500 outline-none font-medium text-sm text-slate-600 dark:text-zinc-300 transition-all"
                    />
                    <a 
                      href={selectedFeed.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 dark:text-zinc-500 hover:text-indigo-600 dark:hover:text-emerald-400 transition-colors"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button 
                  onClick={() => setSelectedFeedId(null)}
                  className="w-full py-3 bg-slate-900 dark:bg-zinc-700 text-white text-sm font-black rounded-xl shadow-lg dark:shadow-none hover:bg-slate-800 dark:hover:bg-zinc-600 active:scale-95 transition-all"
                >
                  Close Settings
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManagementUI;