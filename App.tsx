import React, { useState, Suspense, lazy } from 'react';
import { HashRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { AppProvider, useApp } from './context/AppContext';
import SplashScreen from './components/SplashScreen';
import Navigation from './components/Navigation';
import ErrorBoundary from './components/ErrorBoundary';
import ToolSkeleton from './components/ToolSkeleton';
import DictionaryModal from './components/DictionaryModal';
import { BookOpen } from 'lucide-react';

// Lazy-load each tool with React.lazy
const DeepSearch = lazy(() => import('./components/DeepSearch'));
const ArabicDictionary = lazy(() => import('./components/ArabicDictionary'));
const TashkeelTool = lazy(() => import('./components/TashkeelTool'));
const ArtStudio = lazy(() => import('./components/ArtStudio'));
const VoiceStudio = lazy(() => import('./components/VoiceStudio'));

const MainLayout: React.FC = () => {
  const navigate = useNavigate();
  const {
    isDictionaryModalOpen,
    setIsDictionaryModalOpen,
    serverHealth,
    serverHealthMessage,
  } = useApp();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col md:flex-row overflow-x-hidden font-sans selection:bg-amber-500/30 selection:text-amber-200">
      {/* Ambient Atmospheric Backdrop */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[-5%] start-[-5%] w-[45%] h-[45%] bg-emerald-900/15 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-5%] end-[-5%] w-[45%] h-[45%] bg-amber-900/15 rounded-full blur-[120px]" />
      </div>

      {/* Main Workspace Area (Logical pe-64 for desktop sidebar) */}
      <main className="flex-1 md:pe-64 relative z-10 min-h-screen flex flex-col pb-20 md:pb-0">
        {/* Mobile Header */}
        <header className="md:hidden flex items-center justify-between px-4 py-3 bg-slate-900/80 backdrop-blur-lg border-b border-white/10 sticky top-0 z-30">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('/search')}>
            <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center text-slate-950 font-calligraphy font-bold text-lg">
              ل
            </div>
            <h1 className="text-lg font-calligraphy text-amber-300 font-bold">لسـان</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsDictionaryModalOpen(true)}
              className="flex items-center gap-1 text-xs text-amber-300 bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/20 cursor-pointer"
              title="فتح قاموس المصطلحات"
            >
              <BookOpen className="w-3.5 h-3.5 text-amber-400" />
              <span>القاموس</span>
            </button>

            {/* Dynamic Server Status Badge (Mobile) */}
            <div
              className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border font-medium ${
                serverHealth === 'online'
                  ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                  : serverHealth === 'warning'
                  ? 'text-amber-400 bg-amber-500/10 border-amber-500/20'
                  : 'text-red-400 bg-red-500/10 border-red-500/20'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  serverHealth === 'online'
                    ? 'bg-emerald-400 animate-pulse'
                    : serverHealth === 'warning'
                    ? 'bg-amber-400'
                    : 'bg-red-400'
                }`}
              />
              <span>{serverHealth === 'online' ? 'نشط' : serverHealth === 'warning' ? 'بطيء' : 'غير متصل'}</span>
            </div>
          </div>
        </header>

        {/* Desktop Quick Header Utility Bar */}
        <div className="hidden md:flex items-center justify-between px-6 pt-4 pb-1">
          {/* Dynamic Server Status Badge (Desktop) */}
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                serverHealth === 'online'
                  ? 'bg-emerald-400 animate-pulse'
                  : serverHealth === 'warning'
                  ? 'bg-amber-400 animate-pulse'
                  : 'bg-red-500'
              }`}
            />
            <span className="font-medium text-slate-300">{serverHealthMessage}</span>
            <span className="text-slate-600">|</span>
            <span>منصة لسان للذكاء الاصطناعي وعلوم اللغة العربية</span>
          </div>

          <button
            onClick={() => setIsDictionaryModalOpen(true)}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-amber-300 border border-amber-500/30 text-xs font-medium shadow-sm transition-all hover:border-amber-400 cursor-pointer"
            title="فتح قاموس المصطلحات النحوية والبلاغية كنافذة منبثقة سريعة"
          >
            <BookOpen className="w-3.5 h-3.5 text-amber-400" />
            <span>قاموس المصطلحات السريع</span>
            <span className="text-xs bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded font-sans">
              تفاعلي
            </span>
          </button>
        </div>

        {/* Dynamic Window Container */}
        <div className="flex-1 p-3 md:p-6 flex flex-col">
          <div className="flex-1 w-full bg-slate-900/40 backdrop-blur-xl border border-white/10 rounded-2xl md:rounded-3xl shadow-2xl overflow-hidden flex flex-col relative">
            <Routes>
              <Route path="/" element={<Navigate to="/search" replace />} />
              <Route
                path="/search"
                element={
                  <ErrorBoundary toolName="مجلس البحث والتحليل">
                    <Suspense fallback={<ToolSkeleton />}>
                      <DeepSearch />
                    </Suspense>
                  </ErrorBoundary>
                }
              />
              <Route
                path="/dictionary"
                element={
                  <ErrorBoundary toolName="قاموس المصطلحات">
                    <Suspense fallback={<ToolSkeleton />}>
                      <ArabicDictionary />
                    </Suspense>
                  </ErrorBoundary>
                }
              />
              <Route
                path="/tashkeel"
                element={
                  <ErrorBoundary toolName="المشكّل والمدقق اللغوي">
                    <Suspense fallback={<ToolSkeleton />}>
                      <TashkeelTool />
                    </Suspense>
                  </ErrorBoundary>
                }
              />
              <Route
                path="/voice"
                element={
                  <ErrorBoundary toolName="الناطق واستوديو الصوت">
                    <Suspense fallback={<ToolSkeleton />}>
                      <VoiceStudio />
                    </Suspense>
                  </ErrorBoundary>
                }
              />
              <Route
                path="/art"
                element={
                  <ErrorBoundary toolName="المرسم والمخطوطات">
                    <Suspense fallback={<ToolSkeleton />}>
                      <ArtStudio />
                    </Suspense>
                  </ErrorBoundary>
                }
              />
              <Route path="*" element={<Navigate to="/search" replace />} />
            </Routes>
          </div>
        </div>
      </main>

      {/* Sidebar Navigation */}
      <Navigation />

      {/* Accessible Dictionary Modal Popup */}
      <DictionaryModal
        isOpen={isDictionaryModalOpen}
        onClose={() => setIsDictionaryModalOpen(false)}
      />
    </div>
  );
};

const App: React.FC = () => {
  const [showSplash, setShowSplash] = useState<boolean>(() => {
    // Show splash only if not previously seen in current session
    return !sessionStorage.getItem('lisan_splash_seen');
  });

  const handleSplashComplete = () => {
    sessionStorage.setItem('lisan_splash_seen', 'true');
    setShowSplash(false);
  };

  if (showSplash) {
    return <SplashScreen onComplete={handleSplashComplete} />;
  }

  return (
    <HashRouter>
      <AppProvider>
        <MainLayout />
      </AppProvider>
    </HashRouter>
  );
};

export default App;
