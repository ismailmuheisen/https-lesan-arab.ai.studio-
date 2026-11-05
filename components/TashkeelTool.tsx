import React, { useState } from 'react';
import { GeminiService } from '../services/geminiService';
import { TashkeelMode } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { Copy, Trash2, Wand2, Check, AlertCircle, Info, Volume2, Sparkles, BookOpen } from 'lucide-react';

interface TashkeelToolProps {
  onSendToVoiceStudio?: (text: string) => void;
}

const SAMPLE_TEXTS = [
  { label: 'المتنبي', text: 'على قدر أهل العزم تأتي العزائم وتأتي على قدر الكرام المكارم' },
  { label: 'حكمة مأثورة', text: 'العلم في الصغر كالنقش على الحجر ومن طلب العلا سهر الليالي' },
  { label: 'خطبة فصيحة', text: 'أيها الناس اسمعوا وعوا، إن من عاش مات، ومن مات فات، وكل ما هو آت آت' },
];

const TashkeelTool: React.FC<TashkeelToolProps> = ({ onSendToVoiceStudio }) => {
  const [inputText, setInputText] = useState('');
  const [outputText, setOutputText] = useState('');
  const [mode, setMode] = useState<TashkeelMode>('full');
  const [loading, setLoading] = useState(false);
  const [copying, setCopying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleTashkeel = async () => {
    if (!inputText.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const result = await GeminiService.addDiacritics(inputText, mode);
      setOutputText(result);
    } catch (err) {
      setError("حدث خطأ أثناء معالجة وتشكيل النص. يرجى التأكد من الاتصال والمحاولة مجدداً.");
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    if (!outputText) return;
    navigator.clipboard.writeText(outputText);
    setCopying(true);
    setTimeout(() => setCopying(false), 2000);
  };

  const clearInput = () => {
    setInputText('');
    setOutputText('');
    setError(null);
  };

  const handleSendToTTS = () => {
    if (!outputText && !inputText) return;
    const textToSpeak = outputText || inputText;
    if (onSendToVoiceStudio) {
      onSendToVoiceStudio(textToSpeak);
    }
  };

  return (
    <div className="flex flex-col h-full p-4 md:p-8 max-w-6xl mx-auto overflow-y-auto">
      {/* Header */}
      <motion.div 
        initial={{ opacity: 0, y: -15 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6 border-b border-white/10 pb-4 flex flex-col md:flex-row justify-between items-start md:items-end gap-4"
      >
        <div>
          <h2 className="text-3xl font-calligraphy text-amber-400 mb-1 flex items-center gap-3">
            <Wand2 className="w-8 h-8 text-amber-400" />
            المشكّل والمدقق اللغوي الذكي
          </h2>
          <p className="text-slate-400 font-light font-sans text-sm md:text-base">
            ضبط الحركات الصرفية والإعرابية والتدقيق الإملائي المتقن استناداً لعلوم النحو والبيان.
          </p>
        </div>

        {/* Mode Selector Tabs */}
        <div className="flex bg-slate-900/80 rounded-xl p-1 border border-white/10 text-xs md:text-sm">
          <button
            onClick={() => setMode('full')}
            className={`px-3.5 py-1.5 rounded-lg transition-all ${
              mode === 'full' 
                ? 'bg-amber-500 text-slate-950 font-bold shadow-sm' 
                : 'text-slate-400 hover:text-white'
            }`}
          >
            تشكيل كامل
          </button>
          <button
            onClick={() => setMode('ending')}
            className={`px-3.5 py-1.5 rounded-lg transition-all ${
              mode === 'ending' 
                ? 'bg-amber-500 text-slate-950 font-bold shadow-sm' 
                : 'text-slate-400 hover:text-white'
            }`}
          >
            أواخر الكلمات (إعراب)
          </button>
          <button
            onClick={() => setMode('proofread')}
            className={`px-3.5 py-1.5 rounded-lg transition-all ${
              mode === 'proofread' 
                ? 'bg-amber-500 text-slate-950 font-bold shadow-sm' 
                : 'text-slate-400 hover:text-white'
            }`}
          >
            تدقيق وتصويب
          </button>
        </div>
      </motion.div>

      {/* Preset Inspirations */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <span className="text-xs text-slate-500 flex items-center gap-1">
          <BookOpen className="w-3.5 h-3.5 text-amber-400" />
          <span>نماذج سريعة للتجربة:</span>
        </span>
        {SAMPLE_TEXTS.map((sample, idx) => (
          <button
            key={idx}
            onClick={() => setInputText(sample.text)}
            className="text-xs bg-slate-800/60 hover:bg-slate-700/80 text-slate-300 hover:text-amber-300 px-3 py-1 rounded-lg border border-slate-700/50 transition-colors"
          >
            {sample.label}
          </button>
        ))}
      </div>

      {/* Main Grid: Input & Output */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1 min-h-[360px]">
        {/* Input */}
        <div className="flex flex-col space-y-2">
          <div className="flex justify-between items-center px-1">
            <label className="text-emerald-400 font-bold text-sm flex items-center gap-2">
              النص المراد ضبطه
              <span className="font-normal text-slate-500 text-xs">({inputText.length} حرف)</span>
            </label>
            {inputText && (
              <button 
                onClick={clearInput}
                className="text-slate-500 hover:text-red-400 text-xs flex items-center gap-1 transition-colors"
                title="مسح النص"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>مسح</span>
              </button>
            )}
          </div>
          
          <div className="relative flex-1 group">
            <textarea 
              id="tashkeel-input"
              className="w-full h-full min-h-[280px] bg-slate-800/30 border border-slate-700/60 rounded-2xl p-5 text-xl leading-loose font-sans text-white focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 outline-none resize-none transition-all"
              placeholder="اكتب أو الصق النص العربي هنا لتشكيله أو تدقيقه..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
            />
          </div>
        </div>

        {/* Output */}
        <div className="flex flex-col space-y-2">
          <div className="flex justify-between items-center px-1">
            <label className="text-amber-400 font-bold text-sm flex items-center gap-2">
              <span>النتيجة المشكولة والمدققة</span>
              {mode === 'ending' && <span className="text-xs text-slate-400 font-normal">(أواخر الكلمات)</span>}
              {mode === 'proofread' && <span className="text-xs text-slate-400 font-normal">(مع التدقيق)</span>}
            </label>
            
            <AnimatePresence>
              {outputText && (
                <div className="flex items-center gap-2">
                  <motion.button 
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    onClick={copyToClipboard} 
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                      copying 
                        ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20' 
                        : 'bg-white/10 hover:bg-white/20 text-white border border-white/10'
                    }`}
                  >
                    {copying ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>تم النسخ</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>نسخ</span>
                      </>
                    )}
                  </motion.button>

                  <motion.button 
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    onClick={handleSendToTTS} 
                    className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 transition-all"
                    title="نقل النص المشكول إلى الناطق الآلي للاستماع إليه"
                  >
                    <Volume2 className="w-3.5 h-3.5" />
                    <span>استماع بالناطق</span>
                  </motion.button>
                </div>
              )}
            </AnimatePresence>
          </div>

          <div className="relative flex-1 group">
             <div className={`w-full h-full min-h-[280px] bg-slate-900/60 border ${
               error ? 'border-red-500/50' : 'border-amber-500/30'
             } rounded-2xl p-5 relative overflow-hidden transition-all duration-300`}>
                {loading && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm flex flex-col items-center justify-center z-10 p-6 text-center"
                  >
                    <div className="w-12 h-12 border-3 border-amber-500/20 border-t-amber-500 rounded-full animate-spin mb-3" />
                    <div className="text-amber-400 font-calligraphy text-2xl animate-pulse">جاري الضبط والتدقيق اللغوي...</div>
                    <p className="text-slate-400 text-xs mt-1 font-sans">تطبيق قواعد الإعراب والصرف والبيان</p>
                  </motion.div>
                )}

                {error && (
                  <div className="flex flex-col items-center justify-center h-full text-red-400 p-6 text-center bg-red-500/5 rounded-xl border border-red-500/20">
                    <AlertCircle className="w-10 h-10 mb-3 opacity-60" />
                    <p className="text-sm font-sans">{error}</p>
                    <button 
                      onClick={handleTashkeel}
                      className="mt-3 text-xs bg-red-500/20 hover:bg-red-500/30 text-red-200 px-4 py-1.5 rounded-lg border border-red-500/30 transition-colors"
                    >
                      إعادة المحاولة
                    </button>
                  </div>
                )}

                {!loading && !error && (
                  <textarea 
                    readOnly
                    className="w-full h-full bg-transparent border-none outline-none text-xl md:text-2xl leading-loose font-sans text-emerald-100 placeholder:text-slate-700 resize-none"
                    value={outputText}
                    placeholder="ستظهر النتيجة المشكولة والمضبوطة هنا بدقة تامة..."
                  />
                )}
             </div>
          </div>
        </div>
      </div>

      {/* Action Submit Button */}
      <div className="flex justify-center mt-6 pb-2">
        <motion.button 
          id="tashkeel-submit"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleTashkeel}
          disabled={loading || !inputText.trim()}
          className="group relative bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold font-sans text-lg px-12 py-3.5 rounded-2xl shadow-[0_8px_25px_rgba(245,158,11,0.25)] disabled:opacity-30 disabled:cursor-not-allowed transition-all border border-amber-400/20"
        >
          <div className="flex items-center gap-2.5">
            {loading ? (
              <>
                <span className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                <span>جاري معالجة النص...</span>
              </>
            ) : (
              <>
                <Wand2 className="w-5 h-5 group-hover:rotate-12 transition-transform" />
                <span>
                  {mode === 'full' ? 'تشكيل النص كاملاً' : mode === 'ending' ? 'ضبط أواخر الكلمات' : 'تدقيق وتصويب لغوي'}
                </span>
              </>
            )}
          </div>
        </motion.button>
      </div>
    </div>
  );
};

export default TashkeelTool;
