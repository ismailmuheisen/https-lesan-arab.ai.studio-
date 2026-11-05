import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Sparkles, ArrowLeft } from 'lucide-react';

interface SplashScreenProps {
  onComplete: () => void;
}

const SplashScreen: React.FC<SplashScreenProps> = ({ onComplete }) => {
  const [fade, setFade] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setFade(true);
      setTimeout(onComplete, 600);
    }, 2400);
    return () => clearTimeout(timer);
  }, [onComplete]);

  const handleSkip = () => {
    setFade(true);
    setTimeout(onComplete, 200);
  };

  return (
    <div 
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center bg-slate-950 overflow-hidden transition-opacity duration-700 ${
        fade ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      {/* Ambient Atmospheric Lights */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 -right-20 w-96 h-96 bg-amber-500/15 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-1/4 -left-20 w-96 h-96 bg-emerald-500/15 rounded-full blur-[120px] animate-pulse delay-700" />
      </div>

      {/* Islamic Subtle Star Pattern Overlay */}
      <div 
        className="absolute inset-0 opacity-10 pointer-events-none"
        style={{ 
          backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(245,158,11,0.25) 1px, transparent 0)', 
          backgroundSize: '36px 36px' 
        }} 
      />

      <motion.div 
        initial={{ opacity: 0, scale: 0.92, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 text-center px-6"
      >
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs md:text-sm font-sans mb-6">
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          <span>منظومة الذكاء الاصطناعي اللغوي للغة الضاد</span>
        </div>

        <h1 className="text-7xl md:text-9xl font-calligraphy text-transparent bg-clip-text bg-gradient-to-b from-amber-100 via-amber-300 to-amber-600 drop-shadow-[0_10px_35px_rgba(245,158,11,0.35)] leading-tight mb-3">
          لسـان
        </h1>

        <p className="text-xl md:text-2xl text-emerald-200/90 font-light tracking-wider font-sans mt-2">
          البيان الفصيح • التدقيق الدقيق • الصوت والأثر
        </p>

        <p className="text-xs text-slate-500 font-sans mt-3">
          مدعوم بنماذج Gemini 3 المتقدمة وبروتوكول التحليل المعجمي
        </p>
      </motion.div>
      
      {/* Progress & Quick Entry */}
      <div className="relative z-10 mt-12 flex flex-col items-center gap-4">
        <div className="w-48 h-1 bg-slate-800/80 rounded-full overflow-hidden border border-white/5">
          <motion.div 
            initial={{ width: "0%" }}
            animate={{ width: "100%" }}
            transition={{ duration: 2.2, ease: "easeInOut" }}
            className="h-full bg-gradient-to-r from-emerald-500 via-amber-400 to-amber-500"
          />
        </div>

        <button
          onClick={handleSkip}
          className="flex items-center gap-2 text-xs text-slate-400 hover:text-amber-300 transition-colors px-4 py-1.5 rounded-full hover:bg-white/5 border border-transparent hover:border-white/10"
        >
          <span>دخول فوري</span>
          <ArrowLeft className="w-3.5 h-3.5" />
        </button>
      </div>

    </div>
  );
};

export default SplashScreen;
