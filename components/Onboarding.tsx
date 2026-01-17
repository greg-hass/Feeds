import React, { useState } from 'react';
import { 
  BookOpen, 
  ArrowRight, 
  User, 
  Globe, 
  ShieldCheck, 
  Zap,
  CheckCircle2,
  Loader2
} from 'lucide-react';
import { ApiService } from '../services/apiService';

interface OnboardingProps {
  onComplete: () => void;
}

const Onboarding: React.FC<OnboardingProps> = ({ onComplete }) => {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    baseUrl: window.location.origin,
    importDemo: true
  });
  const [isFinishing, setIsFinishing] = useState(false);

  const handleFinish = async () => {
    setIsFinishing(true);
    await new Promise(r => setTimeout(r, 1500));
    
    await ApiService.completeOnboarding(
      { name: formData.name, email: formData.email },
      { 
        baseUrl: formData.baseUrl, 
        refreshInterval: 60, 
        retentionDays: 30, 
        theme: 'system',
        readerFontSize: 'base',
        readerFontFamily: 'sans' 
      },
      formData.importDemo
    );
    
    setIsFinishing(false);
    onComplete();
  };

  const renderStep1 = () => (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-500">
      <div className="text-center space-y-2">
        <h2 className="text-3xl font-black text-slate-900 dark:text-zinc-100 tracking-tight">Create Admin Profile</h2>
        <p className="text-slate-500 dark:text-zinc-400">Feeds is private. Your data stays on your device.</p>
      </div>
      <div className="space-y-4">
        <div className="space-y-1">
          <label className="text-[10px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-widest px-1">Display Name</label>
          <div className="relative">
            <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 dark:text-zinc-500" />
            <input 
              type="text"
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g. John Doe"
              className="w-full pl-12 pr-4 py-4 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl focus:ring-2 focus:ring-indigo-500 dark:focus:ring-emerald-500 outline-none transition-all font-bold dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-600"
            />
          </div>
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-widest px-1">Email Address</label>
          <input 
            type="email"
            value={formData.email}
            onChange={e => setFormData({ ...formData, email: e.target.value })}
            placeholder="john@example.com"
            className="w-full px-4 py-4 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl focus:ring-2 focus:ring-indigo-500 dark:focus:ring-emerald-500 outline-none transition-all font-bold dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-600"
          />
        </div>
      </div>
      <button 
        disabled={!formData.name || !formData.email}
        onClick={() => setStep(2)}
        className="w-full py-4 bg-indigo-600 dark:bg-emerald-600 text-white font-black rounded-2xl shadow-xl shadow-indigo-200 dark:shadow-none hover:bg-indigo-700 dark:hover:bg-emerald-700 active:scale-95 transition-all disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2"
      >
        Continue <ArrowRight className="w-5 h-5" />
      </button>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-500">
      <div className="text-center space-y-2">
        <h2 className="text-3xl font-black text-slate-900 dark:text-zinc-100 tracking-tight">Instance Config</h2>
        <p className="text-slate-500 dark:text-zinc-400">Set your base URL for sharing and sync.</p>
      </div>
      <div className="space-y-4">
        <div className="space-y-1">
          <label className="text-[10px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-widest px-1">Base URL</label>
          <div className="relative">
            <Globe className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 dark:text-zinc-500" />
            <input 
              type="text"
              value={formData.baseUrl}
              onChange={e => setFormData({ ...formData, baseUrl: e.target.value })}
              className="w-full pl-12 pr-4 py-4 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl focus:ring-2 focus:ring-indigo-500 dark:focus:ring-emerald-500 outline-none transition-all font-bold dark:text-white"
            />
          </div>
        </div>
        <div className="p-5 bg-emerald-50 dark:bg-emerald-900/20 rounded-[2rem] flex items-start gap-4 border border-emerald-100 dark:border-emerald-800">
          <ShieldCheck className="w-6 h-6 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-1" />
          <p className="text-sm text-emerald-800 dark:text-emerald-300 leading-relaxed font-medium">
            This URL identifies your instance for mobile clients and PWA sync. You can change this later in system settings.
          </p>
        </div>
      </div>
      <div className="flex gap-4">
        <button 
          onClick={() => setStep(1)}
          className="flex-1 py-4 text-slate-500 dark:text-zinc-400 font-bold hover:bg-slate-50 dark:hover:bg-zinc-800 rounded-2xl transition-all"
        >
          Back
        </button>
        <button 
          onClick={() => setStep(3)}
          className="flex-[2] py-4 bg-indigo-600 dark:bg-emerald-600 text-white font-black rounded-2xl shadow-xl shadow-indigo-200 dark:shadow-none hover:bg-indigo-700 dark:hover:bg-emerald-700 active:scale-95 transition-all flex items-center justify-center gap-2"
        >
          Final Step <ArrowRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-500">
      <div className="text-center space-y-2">
        <h2 className="text-3xl font-black text-slate-900 dark:text-zinc-100 tracking-tight">Ready to Read?</h2>
        <p className="text-slate-500 dark:text-zinc-400">Start with some hand-picked sources.</p>
      </div>
      
      <div 
        onClick={() => setFormData({ ...formData, importDemo: !formData.importDemo })}
        className={`p-8 rounded-[2.5rem] border-2 transition-all cursor-pointer flex items-center justify-between ${formData.importDemo ? 'bg-indigo-50 dark:bg-emerald-900/20 border-indigo-600 dark:border-emerald-400' : 'bg-white dark:bg-zinc-900 border-slate-100 dark:border-zinc-800 hover:border-slate-200 dark:hover:border-zinc-700'}`}
      >
        <div className="flex items-center gap-6">
          <div className={`w-16 h-16 rounded-[1.25rem] flex items-center justify-center transition-all ${formData.importDemo ? 'bg-indigo-600 dark:bg-emerald-600 text-white shadow-lg shadow-indigo-200 dark:shadow-none' : 'bg-slate-100 dark:bg-zinc-800 text-slate-400 dark:text-zinc-500'}`}>
            <Zap className="w-8 h-8" />
          </div>
          <div>
            <h4 className="font-black text-slate-900 dark:text-zinc-100 text-lg tracking-tight">Import Demo Library</h4>
            <p className="text-sm text-slate-500 dark:text-zinc-400 font-medium">Pre-fill with Verge, MKBHD, and TechNews.</p>
          </div>
        </div>
        {formData.importDemo && <CheckCircle2 className="w-8 h-8 text-indigo-600 dark:text-emerald-400" />}
      </div>

      <button 
        disabled={isFinishing}
        onClick={handleFinish}
        className="w-full py-5 bg-indigo-600 dark:bg-emerald-600 text-white font-black text-lg rounded-[2rem] shadow-2xl shadow-indigo-500/30 dark:shadow-none hover:bg-indigo-700 dark:hover:bg-emerald-700 active:scale-95 transition-all flex items-center justify-center gap-3"
      >
        {isFinishing ? (
          <><Loader2 className="w-6 h-6 animate-spin" /> Preparing Engine...</>
        ) : (
          'Launch Feeds'
        )}
      </button>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[100] bg-white dark:bg-zinc-950 flex items-center justify-center p-6 overflow-y-auto transition-colors duration-300">
      <div className="max-w-md w-full py-12">
        <div className="flex flex-col items-center mb-16">
          <div className="p-5 bg-indigo-600 dark:bg-emerald-600 text-white rounded-[2.5rem] shadow-2xl shadow-indigo-500/40 dark:shadow-none mb-8 animate-in zoom-in-50 duration-700">
            <BookOpen className="w-16 h-16" />
          </div>
          <h1 className="text-6xl font-black text-slate-900 dark:text-zinc-100 tracking-tighter">FEEDS</h1>
          <div className="flex gap-2 mt-8">
            {[1, 2, 3].map(i => (
              <div key={i} className={`h-2 rounded-full transition-all duration-300 ${step === i ? 'w-10 bg-indigo-600 dark:bg-emerald-600' : 'w-2 bg-slate-100 dark:bg-zinc-800'}`} />
            ))}
          </div>
        </div>

        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}
      </div>
    </div>
  );
};

export default Onboarding;