import React from 'react';
import { AppView } from '../types';
import { Search, Edit3, Palette, Volume2, Sparkles, BookOpen } from 'lucide-react';

interface NavigationProps {
  currentView: AppView;
  onChangeView: (view: AppView) => void;
}

const Navigation: React.FC<NavigationProps> = ({ currentView, onChangeView }) => {
  const navItems = [
    { 
      id: AppView.DEEP_SEARCH, 
      label: 'البحث والتحليل', 
      sublabel: 'إعراب، بلاغة، ومعاجم',
      icon: Search 
    },
    { 
      id: AppView.DICTIONARY, 
      label: 'قاموس المصطلحات', 
      sublabel: 'نحو، صرف، وبلاغة',
      icon: BookOpen 
    },
    { 
      id: AppView.TASHKEEL, 
      label: 'التشكيل والتدقيق', 
      sublabel: 'ضبط بالحركات وإملاء',
      icon: Edit3 
    },
    { 
      id: AppView.VOICE_STUDIO, 
      label: 'الناطق واستوديو الصوت', 
      sublabel: '15 نبرة ومختبر استنساخ',
      icon: Volume2 
    },
    { 
      id: AppView.ART_STUDIO, 
      label: 'المرسم والمخطوطات', 
      sublabel: 'خط عربي ولوحات إسلامية',
      icon: Palette 
    },
  ];

  return (
    <>
      {/* Desktop Sidebar (Right Side in RTL) */}
      <aside className="hidden md:flex fixed right-0 top-0 h-full w-64 bg-slate-900/90 backdrop-blur-2xl border-l border-white/10 z-40 flex-col p-4">
        {/* Brand Header */}
        <div className="pt-4 pb-6 px-3 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-600 flex items-center justify-center text-slate-950 font-calligraphy font-bold text-2xl shadow-lg shadow-amber-500/20">
              ل
            </div>
            <div>
              <h1 className="font-calligraphy text-2xl font-bold text-amber-300">لسـان</h1>
              <p className="text-[11px] text-slate-400 font-sans">الذكاء الاصطناعي العربي</p>
            </div>
          </div>
        </div>

        {/* Navigation Items */}
        <div className="flex flex-col gap-2 mt-6 flex-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onChangeView(item.id)}
                className={`
                  relative flex items-center gap-3.5 p-3 rounded-2xl transition-all duration-200 text-right group
                  ${isActive 
                    ? 'bg-gradient-to-l from-amber-500/20 to-amber-500/5 border border-amber-500/40 text-amber-300 shadow-[0_0_20px_rgba(245,158,11,0.15)]' 
                    : 'text-slate-400 hover:text-slate-100 hover:bg-white/5 border border-transparent'}
                `}
              >
                <div className={`p-2 rounded-xl transition-colors ${
                  isActive ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-400 group-hover:text-amber-300 group-hover:bg-slate-700'
                }`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="block font-bold text-sm font-sans truncate">{item.label}</span>
                  <span className="block text-[11px] text-slate-500 font-sans truncate">{item.sublabel}</span>
                </div>
                {isActive && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-7 bg-amber-400 rounded-r-full shadow-[0_0_8px_rgba(245,158,11,0.8)]" />
                )}
              </button>
            );
          })}
        </div>

        {/* Bottom Engine Badge */}
        <div className="p-3 bg-slate-950/60 rounded-2xl border border-white/5 text-center">
          <div className="flex items-center justify-center gap-1.5 text-xs text-amber-400/90 font-medium mb-1">
            <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
            <span>محرك لسان 2.0 المتقدم</span>
          </div>
          <p className="text-[10px] text-slate-500 font-sans">بنية متكاملة للصوت والنص والرسم</p>
        </div>
      </aside>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-slate-900/95 backdrop-blur-2xl border-t border-white/10 z-50 flex items-center justify-around px-2 shadow-2xl">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onChangeView(item.id)}
              className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all ${
                isActive ? 'text-amber-400 font-bold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <div className={`p-1.5 rounded-lg mb-0.5 ${isActive ? 'bg-amber-500/20 text-amber-300' : ''}`}>
                <Icon className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-sans truncate max-w-[70px]">{item.label.split(' ')[0]}</span>
            </button>
          );
        })}
      </nav>
    </>
  );
};

export default Navigation;
