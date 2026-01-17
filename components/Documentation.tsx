import React from 'react';
import { X, Server, Database, Repeat } from 'lucide-react';

interface DocumentationProps {
  onClose: () => void;
}

const Documentation: React.FC<DocumentationProps> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 z-[100] bg-white dark:bg-zinc-950 overflow-y-auto p-12 transition-colors duration-300">
      <button 
        onClick={onClose}
        className="fixed top-8 right-8 p-3 bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 rounded-full hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors shadow-sm"
      >
        <X className="w-6 h-6" />
      </button>

      <div className="max-w-4xl mx-auto space-y-16 py-12">
        <header>
          <h1 className="text-5xl font-black text-slate-900 dark:text-zinc-100 mb-6 tracking-tight">System Architecture</h1>
          <p className="text-xl text-slate-600 dark:text-zinc-400 leading-relaxed max-w-2xl">
            A comprehensive blueprint for building a private, self-hosted content aggregator with full synchronization and smart intelligence.
          </p>
        </header>

        <section>
          <div className="flex items-center gap-4 mb-8">
            <div className="p-3 bg-indigo-600 dark:bg-purple-600 text-white rounded-2xl shadow-lg shadow-indigo-500/20 dark:shadow-purple-500/20">
              <Server className="w-8 h-8" />
            </div>
            <h2 className="text-3xl font-black text-slate-900 dark:text-zinc-100 tracking-tight">1. Component Architecture</h2>
          </div>
          <div className="bg-slate-50 dark:bg-zinc-900 rounded-[2.5rem] p-8 md:p-12 font-mono text-xs md:text-sm leading-relaxed border border-slate-200 dark:border-zinc-800 whitespace-pre overflow-x-auto text-slate-700 dark:text-zinc-300 shadow-sm transition-colors">
{`[Frontend: React/PWA/Tailwind] <==> [Local Storage Cache] <==> [Gemini Sync Engine]
                                        |
         +------------------------------+------------------------------+
         |                              |                              |
 [Auto-Sync Scheduler]          [Semantic Analyzer]           [Feed Discovery Engine]
         |                              |                              |
 [Incremental Fetch]            [FTS5 Search Indices]         [RSS/ATOM Crawler]
         |                              |
 (RSS/YT/Reddit/Podcast)        [IndexedDB Persistence]`}
          </div>
        </section>

        <section>
          <div className="flex items-center gap-4 mb-8">
            <div className="p-3 bg-indigo-600 dark:bg-purple-600 text-white rounded-2xl shadow-lg shadow-indigo-500/20 dark:shadow-purple-500/20">
              <Database className="w-8 h-8" />
            </div>
            <h2 className="text-3xl font-black text-slate-900 dark:text-zinc-100 tracking-tight">2. Data Strategy & FTS5</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-6">
              <h3 className="text-lg font-black text-slate-800 dark:text-zinc-200 uppercase tracking-widest text-[10px]">Entity Relations</h3>
              <ul className="space-y-4 text-slate-600 dark:text-zinc-400 text-sm">
                <li className="flex gap-3"><span className="text-indigo-600 dark:text-emerald-400 font-black">FEEDS</span> GUID, url, type, site_url, folder_id, metadata</li>
                <li className="flex gap-3"><span className="text-indigo-600 dark:text-emerald-400 font-black">ARTICLES</span> GUID, feed_id, title, content, published_at, hero_image</li>
                <li className="flex gap-3"><span className="text-indigo-600 dark:text-emerald-400 font-black">USER_STATE</span> state_id, article_id, read_boolean, bookmark_boolean</li>
              </ul>
            </div>
            <div className="space-y-6">
              <h3 className="text-lg font-black text-slate-800 dark:text-zinc-200 uppercase tracking-widest text-[10px]">Full-Text Intelligence</h3>
              <p className="text-sm text-slate-600 dark:text-zinc-400 leading-relaxed">
                Utilizes browser-local indexing for sub-millisecond search performance. Gemini models are invoked for semantic grouping and content summarization, reducing information overload while maintaining privacy.
              </p>
            </div>
          </div>
        </section>

        <section>
          <div className="flex items-center gap-4 mb-8">
            <div className="p-3 bg-indigo-600 dark:bg-purple-600 text-white rounded-2xl shadow-lg shadow-indigo-500/20 dark:shadow-purple-500/20">
              <Repeat className="w-8 h-8" />
            </div>
            <h2 className="text-3xl font-black text-slate-900 dark:text-zinc-100 tracking-tight">3. Sync Propagation</h2>
          </div>
          <div className="bg-indigo-50 dark:bg-purple-900/10 p-10 rounded-[2.5rem] border border-indigo-100 dark:border-purple-900/50 transition-colors">
            <h3 className="text-xl font-black text-indigo-900 dark:text-purple-100 mb-4">Atomic Refresh Logic</h3>
            <p className="text-indigo-800 dark:text-purple-300 text-sm md:text-base leading-relaxed max-w-2xl">
              Syncing employs a high-water mark strategy. Every feed is fetched incrementally, comparing latest item GUIDs against the local store. The UI maintains a global background worker state that coordinates multi-feed refreshes without blocking the main render loop.
            </p>
          </div>
        </section>

        <footer className="pt-16 border-t border-slate-100 dark:border-zinc-800 text-center">
          <p className="text-slate-400 dark:text-zinc-600 text-[10px] font-black uppercase tracking-[0.3em]">Feeds Core Specification &copy; 2025</p>
        </footer>
      </div>
    </div>
  );
};

export default Documentation;