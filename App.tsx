import React, { useState } from 'react';
import { AppView } from './types';
import SplashScreen from './components/SplashScreen';
import Navigation from './components/Navigation';
import DeepSearch from './components/DeepSearch';
import TashkeelTool from './components/TashkeelTool';
import ArtStudio from './components/ArtStudio';
import VoiceStudio from './components/VoiceStudio';
import ArabicDictionary from './components/ArabicDictionary';
import { Sparkles, BookOpen } from 'lucide-react';

const App: React.FC = () => {
  const [view, setView] = useState<AppView>(AppView.SPLASH);
  const [activeTab, setActiveTab] = useState<AppView>(AppView.DEEP_SEARCH);
  const [isDictionaryModalOpen, setIsDictionaryModalOpen] = useState(false);

  const handleSplashComplete = () => {
    setView(AppView.DASHBOARD);
  };

  const renderContent = () => {
    switch (activeTab) {
      case AppView.DEEP_SEARCH:
        return (
          <DeepSearch 
            onNavigateToTashkeel={() => setActiveTab(AppView.TASHKEEL)}
            onOpenDictionary={() => setIsDictionaryModalOpen(true)}
          />
        );
      case AppView.DICTIONARY:
        return (
          <ArabicDictionary 
            onSelectTermForSearch={(term) => {
              setActiveTab(AppView.DEEP_SEARCH);
              sessionStorage.setItem('lisan_search_input', term);
            }} 
          />
        );
      case AppView.TASHKEEL:
        return (
          <TashkeelTool 
            onSendToVoiceStudio={(text) => {
              setActiveTab(AppView.VOICE_STUDIO);
              sessionStorage.setItem('lisan_tts_input', text);
            }} 
          />
        );
      case AppView.ART_STUDIO:
        return <ArtStudio />;
      case AppView.VOICE_STUDIO:
        return <VoiceStudio />;
      default:
        return <DeepSearch />;
    }
  };

  if (view === AppView.SPLASH) {
    return <SplashScreen onComplete={handleSplashComplete} />;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col md:flex-row overflow-x-hidden font-sans selection:bg-amber-500/30 selection:text-amber-200">
      {/* Ambient Atmospheric Backdrop */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[-5%] left-[-5%] w-[45%] h-[45%] bg-emerald-900/15 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-5%] right-[-5%] w-[45%] h-[45%] bg-amber-900/15 rounded-full blur-[120px]" />
      </div>

      {/* Main Workspace Area */}
      <main className="flex-1 md:pr-64 relative z-10 min-h-screen flex flex-col pb-20 md:pb-0">
        {/* Mobile Header */}
        <header className="md:hidden flex items-center justify-between px-4 py-3 bg-slate-900/80 backdrop-blur-lg border-b border-white/10 sticky top-0 z-30">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center text-slate-950 font-calligraphy font-bold text-lg">
              ل
            </div>
            <h1 className="text-lg font-calligraphy text-amber-300 font-bold">لسـان</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsDictionaryModalOpen(true)}
              className="flex items-center gap-1 text-[11px] text-amber-300 bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/20"
              title="فتح قاموس المصطلحات"
            >
              <BookOpen className="w-3.5 h-3.5 text-amber-400" />
              <span>القاموس</span>
            </button>
            <div className="flex items-center gap-1 text-[11px] text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-full border border-emerald-500/20">
              <Sparkles className="w-3 h-3" />
              <span>نشط</span>
            </div>
          </div>
        </header>

        {/* Desktop Quick Header Utility Bar */}
        <div className="hidden md:flex items-center justify-between px-6 pt-4 pb-1">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>منصة لسان للذكاء الاصطناعي وعلوم اللغة العربية</span>
          </div>
          <button
            onClick={() => setIsDictionaryModalOpen(true)}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-amber-300 border border-amber-500/30 text-xs font-medium shadow-sm transition-all hover:border-amber-400"
            title="فتح قاموس المصطلحات النحوية والبلاغية كنافذة منبثقة سريعة"
          >
            <BookOpen className="w-3.5 h-3.5 text-amber-400" />
            <span>قاموس المصطلحات السريع</span>
            <span className="text-[10px] bg-amber-500/20 text-amber-300 px-1.5 py-0.2 rounded font-sans">
              تفاعلي
            </span>
          </button>
        </div>

        {/* Dynamic Window Container */}
        <div className="flex-1 p-3 md:p-6 flex flex-col">
          <div className="flex-1 w-full bg-slate-900/40 backdrop-blur-xl border border-white/10 rounded-2xl md:rounded-3xl shadow-2xl overflow-hidden flex flex-col relative">
            {renderContent()}
          </div>
        </div>
      </main>

      {/* Sidebar / Bottom Navigation */}
      <Navigation currentView={activeTab} onChangeView={setActiveTab} />

      {/* Interactive Dictionary Modal Popup */}
      {isDictionaryModalOpen && (
        <div 
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 md:p-6"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsDictionaryModalOpen(false);
          }}
        >
          <div className="bg-slate-900 border border-amber-500/30 rounded-3xl w-full max-w-5xl h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <ArabicDictionary
              isModal={true}
              onClose={() => setIsDictionaryModalOpen(false)}
              onSelectTermForSearch={(term) => {
                setIsDictionaryModalOpen(false);
                setActiveTab(AppView.DEEP_SEARCH);
                sessionStorage.setItem('lisan_search_input', term);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
