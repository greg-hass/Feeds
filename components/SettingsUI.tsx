import React, { useState, useEffect } from 'react';
import { 
  X, 
  Save, 
  RefreshCw, 
  Trash, 
  Monitor, 
  Moon, 
  Sun, 
  Type, 
  Globe, 
  Shield, 
  ArrowLeft,
  ChevronRight,
  User
} from 'lucide-react';
import { AppSettings, UserProfile } from '../types';
import { ApiService } from '../services/apiService';

interface SettingsUIProps {
  onClose: () => void;
  onSettingsUpdate?: (settings: AppSettings) => void;
}

const SettingsUI: React.FC<SettingsUIProps> = ({ onClose, onSettingsUpdate }) => {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'general' | 'appearance' | 'account'>('general');

  useEffect(() => {
    const load = async () => {
      const [s, u] = await Promise.all([ApiService.getSettings(), ApiService.getUser()]);
      setSettings(s);
      setUser(u);
    };
    load();
  }, []);

  const handleSave = async () => {
    if (!settings) return;
    setIsSaving(true);
    await ApiService.updateSettings(settings);
    if (onSettingsUpdate) onSettingsUpdate(settings);
    await new Promise(r => setTimeout(r, 800)); // Visual feedback
    setIsSaving(false);
  };

  if (!settings) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 dark:bg-zinc-950/80 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-zinc-900 w-full max-w-4xl h-[85vh] rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 transition-colors duration-300">
        <div className="p-8 border-b border-slate-100 dark:border-zinc-800 flex items-center justify-between bg-white dark:bg-zinc-900 transition-colors duration-300">
          <div className="flex items-center gap-4">
             <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-full md:hidden transition-colors">
               <ArrowLeft className="w-5 h-5 text-slate-500 dark:text-zinc-400" />
             </button>
             <h2 className="text-2xl font-black text-slate-900 dark:text-zinc-100 tracking-tight">System Settings</h2>
          </div>
          <button 
            onClick={handleSave}
            disabled={isSaving}
            className="px-6 py-3 bg-indigo-600 dark:bg-emerald-600 text-white text-sm font-black rounded-2xl shadow-lg shadow-indigo-100 dark:shadow-none hover:bg-indigo-700 dark:hover:bg-emerald-700 active:scale-95 transition-all flex items-center gap-2"
          >
            {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* Settings Navigation */}
          <aside className="w-64 border-r border-slate-100 dark:border-zinc-800 p-6 bg-slate-50/50 dark:bg-zinc-900/50 hidden md:block transition-colors duration-300">
            <nav className="space-y-1">
              {[
                { id: 'general', label: 'General', icon: Monitor },
                { id: 'appearance', label: 'Appearance', icon: Sun },
                { id: 'account', label: 'Admin Account', icon: User }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${
                    activeTab === tab.id ? 'bg-white dark:bg-zinc-800 text-indigo-600 dark:text-emerald-400 shadow-sm border border-slate-100 dark:border-zinc-700' : 'text-slate-400 dark:text-zinc-500 hover:text-slate-600 dark:hover:text-zinc-300'
                  }`}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                </button>
              ))}
            </nav>
          </aside>

          {/* Settings Content */}
          <main className="flex-1 overflow-y-auto p-8 md:p-12 bg-white dark:bg-zinc-900 transition-colors duration-300">
            {activeTab === 'general' && (
              <div className="space-y-10 animate-in fade-in slide-in-from-right-4 duration-300">
                <section className="space-y-6">
                  <div className="flex items-center gap-3 mb-2">
                    <Globe className="w-5 h-5 text-indigo-600 dark:text-emerald-400" />
                    <h3 className="font-black text-slate-900 dark:text-zinc-100">Instance Settings</h3>
                  </div>
                  <div className="grid grid-cols-1 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-widest px-1">External Base URL</label>
                      <input 
                        type="text" 
                        value={settings.baseUrl}
                        onChange={e => setSettings({ ...settings, baseUrl: e.target.value })}
                        className="w-full px-4 py-3 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-2xl text-slate-900 dark:text-zinc-100 focus:ring-2 focus:ring-indigo-500 dark:focus:ring-emerald-500 outline-none font-medium transition-all"
                      />
                    </div>
                  </div>
                </section>

                <section className="space-y-6">
                  <div className="flex items-center gap-3 mb-2">
                    <RefreshCw className="w-5 h-5 text-indigo-600 dark:text-emerald-400" />
                    <h3 className="font-black text-slate-900 dark:text-zinc-100">Sync & Retention</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-widest px-1">Refresh Every (Minutes)</label>
                      <input 
                        type="number" 
                        value={settings.refreshInterval}
                        onChange={e => setSettings({ ...settings, refreshInterval: parseInt(e.target.value) || 0 })}
                        className="w-full px-4 py-3 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-2xl text-slate-900 dark:text-zinc-100 focus:ring-2 focus:ring-indigo-500 dark:focus:ring-emerald-500 outline-none font-medium transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-widest px-1">Archive Articles Older Than (Days)</label>
                      <input 
                        type="number" 
                        value={settings.retentionDays}
                        onChange={e => setSettings({ ...settings, retentionDays: parseInt(e.target.value) || 0 })}
                        className="w-full px-4 py-3 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-2xl text-slate-900 dark:text-zinc-100 focus:ring-2 focus:ring-indigo-500 dark:focus:ring-emerald-500 outline-none font-medium transition-all"
                      />
                    </div>
                  </div>
                </section>
              </div>
            )}

            {activeTab === 'appearance' && (
              <div className="space-y-10 animate-in fade-in slide-in-from-right-4 duration-300">
                <section className="space-y-6">
                  <div className="flex items-center gap-3 mb-2">
                    <Monitor className="w-5 h-5 text-indigo-600 dark:text-emerald-400" />
                    <h3 className="font-black text-slate-900 dark:text-zinc-100">Theme Mode</h3>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    {[
                      { id: 'light', label: 'Light', icon: Sun },
                      { id: 'dark', label: 'Dark', icon: Moon },
                      { id: 'system', label: 'System', icon: Monitor }
                    ].map(mode => (
                      <button
                        key={mode.id}
                        onClick={() => setSettings({ ...settings, theme: mode.id as any })}
                        className={`flex flex-col items-center gap-3 p-6 rounded-3xl border-2 transition-all ${
                          settings.theme === mode.id ? 'bg-indigo-50 dark:bg-emerald-900/30 border-indigo-600 dark:border-emerald-400' : 'bg-white dark:bg-zinc-800 border-slate-100 dark:border-zinc-700 hover:border-slate-200 dark:hover:border-zinc-600'
                        }`}
                      >
                        <mode.icon className={`w-6 h-6 ${settings.theme === mode.id ? 'text-indigo-600 dark:text-emerald-400' : 'text-slate-400 dark:text-zinc-500'}`} />
                        <span className={`text-xs font-bold ${settings.theme === mode.id ? 'text-indigo-900 dark:text-emerald-100' : 'text-slate-500 dark:text-zinc-400'}`}>{mode.label}</span>
                      </button>
                    ))}
                  </div>
                </section>

                <section className="space-y-6">
                  <div className="flex items-center gap-3 mb-2">
                    <Type className="w-5 h-5 text-indigo-600 dark:text-emerald-400" />
                    <h3 className="font-black text-slate-900 dark:text-zinc-100">Default Reader Styles</h3>
                  </div>
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-widest px-1">Font Family</label>
                      <select 
                        value={settings.readerFontFamily}
                        onChange={e => setSettings({ ...settings, readerFontFamily: e.target.value as any })}
                        className="w-full px-4 py-3 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-2xl text-slate-900 dark:text-zinc-100 focus:ring-2 focus:ring-indigo-500 dark:focus:ring-emerald-500 outline-none font-medium transition-all"
                      >
                        <option value="sans">Modern Sans</option>
                        <option value="serif">Classic Serif</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-widest px-1">Base Size</label>
                      <select 
                        value={settings.readerFontSize}
                        onChange={e => setSettings({ ...settings, readerFontSize: e.target.value as any })}
                        className="w-full px-4 py-3 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-2xl text-slate-900 dark:text-zinc-100 focus:ring-2 focus:ring-indigo-500 dark:focus:ring-emerald-500 outline-none font-medium transition-all"
                      >
                        <option value="sm">Compact</option>
                        <option value="base">Standard</option>
                        <option value="lg">Large</option>
                        <option value="xl">Extra Large</option>
                      </select>
                    </div>
                  </div>
                </section>
              </div>
            )}

            {activeTab === 'account' && user && (
              <div className="space-y-10 animate-in fade-in slide-in-from-right-4 duration-300 transition-all">
                <div className="flex items-center gap-6 p-8 bg-slate-50 dark:bg-zinc-800 rounded-[2rem] border border-slate-100 dark:border-zinc-700 transition-colors">
                  <div className="w-20 h-20 bg-indigo-600 dark:bg-emerald-600 rounded-[1.5rem] flex items-center justify-center text-white text-3xl font-black shadow-xl shadow-indigo-200 dark:shadow-none">
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-slate-900 dark:text-zinc-100">{user.name}</h3>
                    <p className="text-slate-500 dark:text-zinc-400 font-medium">{user.email}</p>
                    <div className="mt-3 inline-flex items-center gap-2 px-3 py-1 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-full text-[10px] font-black uppercase tracking-widest transition-colors">
                      <Shield className="w-3 h-3" /> Instance Owner
                    </div>
                  </div>
                </div>

                <section className="space-y-4">
                  <h4 className="text-xs font-black text-slate-400 dark:text-zinc-500 uppercase tracking-widest px-1">Security Settings</h4>
                  <button className="w-full flex items-center justify-between p-5 bg-white dark:bg-zinc-800 border border-slate-100 dark:border-zinc-700 rounded-2xl hover:border-indigo-100 dark:hover:border-emerald-800 transition-all group">
                    <span className="font-bold text-slate-700 dark:text-zinc-200">Change Admin Password</span>
                    <ChevronRight className="w-4 h-4 text-slate-300 dark:text-zinc-600 group-hover:text-indigo-600 dark:group-hover:text-emerald-400 group-hover:translate-x-1 transition-all" />
                  </button>
                  <button className="w-full flex items-center justify-between p-5 bg-white dark:bg-zinc-800 border border-slate-100 dark:border-zinc-700 rounded-2xl hover:border-indigo-100 dark:hover:border-emerald-800 transition-all group">
                    <span className="font-bold text-slate-700 dark:text-zinc-200">Setup 2-Factor Authentication</span>
                    <ChevronRight className="w-4 h-4 text-slate-300 dark:text-zinc-600 group-hover:text-indigo-600 dark:group-hover:text-emerald-400 group-hover:translate-x-1 transition-all" />
                  </button>
                </section>

                <section className="space-y-4 pt-6">
                  <h4 className="text-xs font-black text-red-400 dark:text-red-500 uppercase tracking-widest px-1">Danger Zone</h4>
                  <button className="flex items-center gap-2 px-6 py-3 text-red-600 dark:text-red-400 font-bold hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all">
                    <Trash className="w-4 h-4" /> Reset Local Library
                  </button>
                </section>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
};

export default SettingsUI;