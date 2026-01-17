import React, { useState, useEffect } from 'react';
import { Article } from '../types';
import { 
  ExternalLink, 
  Share2, 
  Type as TypeIcon, 
  Sparkles,
  Bookmark,
  CheckCircle,
  Circle,
  ArrowLeft,
  Youtube,
  Play
} from 'lucide-react';
import { GeminiService } from '../services/geminiService';

interface ReaderViewProps {
  article?: Article;
  onToggleBookmark: (articleId: string) => void;
  onToggleRead: (articleId: string) => void;
  onBackToList: () => void;
}

const ReaderView: React.FC<ReaderViewProps> = ({ article, onToggleBookmark, onToggleRead, onBackToList }) => {
  const [summary, setSummary] = useState<string | null>(null);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [showTypography, setShowTypography] = useState(false);
  const [fontSize, setFontSize] = useState<'sm' | 'base' | 'lg' | 'xl'>('base');
  const [fontFamily, setFontFamily] = useState<'sans' | 'serif'>('sans');
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    setSummary(null);
    setShowTypography(false);
    setIsPlaying(false);
  }, [article?.id]);

  const handleSummarize = async () => {
    if (!article) return;
    setIsSummarizing(true);
    const result = await GeminiService.summarizeArticle(article.title, article.content);
    setSummary(result);
    setIsSummarizing(false);
  };

  const getFontSizeClass = () => {
    switch(fontSize) {
      case 'sm': return 'prose-sm';
      case 'lg': return 'prose-lg';
      case 'xl': return 'prose-xl';
      default: return 'prose-base';
    }
  };

  if (!article) {
    return (
      <div className="hidden md:flex flex-1 items-center justify-center bg-white dark:bg-zinc-950 text-slate-400 p-8 transition-colors duration-300">
        <div className="text-center">
          <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-10 dark:opacity-5" />
          <p className="font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest text-xs">Select an article to explore</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex-1 bg-white dark:bg-zinc-950 flex flex-col h-full overflow-hidden absolute inset-0 md:relative z-20 transition-colors duration-300`}>
      {/* Reader Toolbar */}
      <div className="h-16 border-b border-slate-100 dark:border-zinc-800 flex items-center justify-between px-4 md:px-8 flex-shrink-0 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md sticky top-0 z-30 transition-colors duration-300">
        <div className="flex items-center gap-1 md:gap-3">
           <button 
             onClick={onBackToList}
             className="p-2 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-full md:hidden text-slate-500 dark:text-zinc-400 transition-colors"
           >
             <ArrowLeft className="w-5 h-5" />
           </button>
           <button 
             onClick={() => onToggleRead(article.id)}
             className={`p-2 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-full transition-colors ${article.read ? 'text-indigo-600 dark:text-emerald-400' : 'text-slate-400 dark:text-zinc-500'}`}
             title={article.read ? "Mark as unread" : "Mark as read"}
           >
             {article.read ? <CheckCircle className="w-5 h-5" /> : <Circle className="w-5 h-5" />}
           </button>
           <button 
             onClick={() => onToggleBookmark(article.id)}
             className={`p-2 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-full transition-colors ${article.bookmarked ? 'text-indigo-600 dark:text-purple-400' : 'text-slate-400 dark:text-zinc-500'}`}
             title={article.bookmarked ? "Remove bookmark" : "Bookmark article"}
           >
             <Bookmark className={`w-5 h-5 ${article.bookmarked ? 'fill-indigo-600 dark:fill-purple-400' : ''}`} />
           </button>
        </div>

        <div className="flex items-center gap-2">
          <button 
            onClick={handleSummarize}
            disabled={isSummarizing || !!summary}
            className="flex items-center gap-2 px-4 py-2 text-[10px] md:text-xs font-black bg-indigo-50 dark:bg-purple-900/30 text-indigo-700 dark:text-purple-300 rounded-full hover:bg-indigo-100 dark:hover:bg-purple-900/50 disabled:opacity-50 transition-all uppercase tracking-widest"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{isSummarizing ? 'Analyzing...' : summary ? 'AI Summary' : 'AI Summary'}</span>
          </button>
          
          <div className="relative">
            <button 
              onClick={() => setShowTypography(!showTypography)}
              className={`p-2 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-full transition-colors ${showTypography ? 'text-indigo-600 dark:text-emerald-400 bg-indigo-50 dark:bg-emerald-900/20' : 'text-slate-500 dark:text-zinc-400'}`}
              title="Typography Controls"
            >
              <TypeIcon className="w-5 h-5" />
            </button>
            {showTypography && (
              <div className="absolute right-0 mt-3 w-64 bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl border border-slate-100 dark:border-zinc-800 p-6 animate-in fade-in zoom-in-95 duration-200 z-50">
                <div className="space-y-6">
                  <div className="space-y-3">
                    <p className="text-[10px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-widest">Font Size</p>
                    <div className="flex gap-2">
                      {['sm', 'base', 'lg', 'xl'].map(size => (
                        <button
                          key={size}
                          onClick={() => setFontSize(size as any)}
                          className={`flex-1 py-2 text-xs font-bold rounded-lg border transition-all ${fontSize === size ? 'bg-indigo-600 dark:bg-emerald-600 text-white border-indigo-600 dark:border-emerald-600 shadow-lg shadow-indigo-100 dark:shadow-none' : 'bg-slate-50 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 border-transparent hover:border-slate-200 dark:hover:border-zinc-700'}`}
                        >
                          {size.toUpperCase()}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-3">
                    <p className="text-[10px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-widest">Typeface</p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setFontFamily('sans')}
                        className={`flex-1 py-2 text-xs font-bold rounded-lg border transition-all ${fontFamily === 'sans' ? 'bg-indigo-600 dark:bg-emerald-600 text-white border-indigo-600 dark:border-emerald-600 shadow-lg shadow-indigo-100 dark:shadow-none' : 'bg-slate-50 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 border-transparent hover:border-slate-200 dark:hover:border-zinc-700'}`}
                      >
                        Sans
                      </button>
                      <button
                        onClick={() => setFontFamily('serif')}
                        className={`flex-1 py-2 text-xs font-bold rounded-lg border transition-all ${fontFamily === 'serif' ? 'bg-indigo-600 dark:bg-emerald-600 text-white border-indigo-600 dark:border-emerald-600 shadow-lg shadow-indigo-100 dark:shadow-none' : 'bg-slate-50 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 border-transparent hover:border-slate-200 dark:hover:border-zinc-700'}`}
                      >
                        Serif
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <button className="p-2 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-full text-slate-500 dark:text-zinc-400 transition-colors"><Share2 className="w-5 h-5"/></button>
          <a href={article.url} target="_blank" rel="noopener noreferrer" className="p-2 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-full text-slate-500 dark:text-zinc-400 transition-colors"><ExternalLink className="w-5 h-5"/></a>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto bg-slate-50/20 dark:bg-zinc-950/20">
        <article className={`max-w-2xl mx-auto ${fontFamily === 'serif' ? 'font-serif' : 'font-sans'} transition-all duration-300`}>
          {/* Hero Media Section */}
          <div className="w-full relative bg-slate-100 dark:bg-zinc-900 aspect-video md:rounded-b-[2.5rem] overflow-hidden shadow-sm transition-colors duration-300">
            {article.videoId ? (
              <div className="w-full h-full relative">
                {!isPlaying ? (
                  <div className="w-full h-full relative group cursor-pointer" onClick={() => setIsPlaying(true)}>
                    <img src={article.heroImage || `https://img.youtube.com/vi/${article.videoId}/maxresdefault.jpg`} className="w-full h-full object-cover" alt={article.title} />
                    <div className="absolute inset-0 bg-slate-900/40 flex items-center justify-center group-hover:bg-slate-900/50 transition-all">
                      <div className="w-16 h-16 bg-red-600 text-white rounded-2xl flex items-center justify-center shadow-2xl group-hover:scale-110 transition-transform">
                        <Play className="w-8 h-8 fill-current" />
                      </div>
                    </div>
                    <div className="absolute bottom-6 right-6">
                      <a 
                        href={`https://youtube.com/watch?v=${article.videoId}`} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="px-4 py-2 bg-white/90 dark:bg-zinc-800/90 backdrop-blur-sm text-slate-900 dark:text-zinc-100 text-xs font-black rounded-xl shadow-lg flex items-center gap-2 hover:bg-white dark:hover:bg-zinc-700 transition-colors"
                      >
                        <Youtube className="w-4 h-4 text-red-600" />
                        Open in YouTube
                      </a>
                    </div>
                  </div>
                ) : (
                  <iframe
                    className="w-full h-full"
                    src={`https://www.youtube.com/embed/${article.videoId}?autoplay=1`}
                    title="YouTube video player"
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                  ></iframe>
                )}
              </div>
            ) : article.heroImage ? (
              <img src={article.heroImage} className="w-full h-full object-cover" alt={article.title} />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-slate-300 dark:text-zinc-700 transition-colors">
                <BookOpen className="w-16 h-16 opacity-10 dark:opacity-5" />
              </div>
            )}
          </div>

          <div className="py-12 md:py-16 px-6 md:px-8">
            <header className="mb-12 md:mb-16">
              <div className="flex items-center gap-3 mb-6">
                <span className="text-[10px] md:text-xs font-black text-indigo-600 dark:text-emerald-400 uppercase tracking-[0.2em]">{article.author || 'Contributor'}</span>
                <div className="w-1 h-1 bg-slate-300 dark:bg-zinc-700 rounded-full" />
                <time className="text-[10px] md:text-xs text-slate-400 dark:text-zinc-500 font-bold uppercase tracking-widest">{new Date(article.publishedAt).toLocaleDateString()}</time>
              </div>
              <h1 className="text-3xl md:text-5xl font-black text-slate-900 dark:text-zinc-100 leading-[1.15] tracking-tight mb-10 transition-colors duration-300">
                {article.title}
              </h1>
              
              {summary && (
                <div className="bg-indigo-50/80 dark:bg-purple-900/20 backdrop-blur-sm border-l-4 border-indigo-600 dark:border-purple-500 p-8 rounded-r-3xl mb-12 animate-in fade-in slide-in-from-left-4 duration-500 shadow-sm transition-colors duration-300">
                  <h4 className="text-[10px] font-black text-indigo-700 dark:text-purple-300 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                    <Sparkles className="w-4 h-4" />
                    Key Takeaways
                  </h4>
                  <div className="text-indigo-900/90 dark:text-purple-100/90 text-sm md:text-base leading-relaxed space-y-3 font-medium whitespace-pre-line transition-colors duration-300">
                    {summary}
                  </div>
                </div>
              )}
            </header>

            <div 
              className={`prose prose-slate dark:prose-invert ${getFontSizeClass()} max-w-none text-slate-800 dark:text-zinc-200 leading-[1.7] overflow-x-hidden transition-colors duration-300
                prose-headings:font-black prose-headings:text-slate-900 dark:prose-headings:text-zinc-100 prose-headings:tracking-tight
                prose-a:text-indigo-600 dark:prose-a:text-emerald-400 prose-a:font-bold prose-a:no-underline hover:prose-a:underline
                prose-img:rounded-[2rem] prose-img:shadow-xl
                prose-strong:text-slate-900 dark:prose-strong:text-zinc-100 prose-strong:font-black
              `}
              dangerouslySetInnerHTML={{ __html: article.content }}
            />
          </div>
        </article>
      </div>
    </div>
  );
};

const BookOpen = ({ className }: { className?: string }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
);

export default ReaderView;