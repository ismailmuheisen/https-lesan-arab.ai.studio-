import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GeminiService } from '../services/geminiService';
import { TashkeelMode } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { Copy, Trash2, Wand2, Check, AlertCircle, Info, Volume2, Sparkles, BookOpen } from 'lucide-react';
import { useApp } from '../context/AppContext';

interface TashkeelToolProps {
  onSendToVoiceStudio?: (text: string) => void;
}

const SAMPLE_TEXTS = [
  { label: 'المتنبي', text: 'على قدر أهل العزم تأتي العزائم وتأتي على قدر الكرام المكارم' },
  { label: 'حكمة مأثورة', text: 'العلم في الصغر كالنقش على الحجر ومن طلب العلا سهر الليالي' },
  { label: 'خطبة فصيحة', text: 'أيها الناس اسمعوا وعوا، إن من عاش مات، ومن مات فات، وكل ما هو آت آت' },
];

const TashkeelTool: React.FC<TashkeelToolProps> = ({ onSendToVoiceStudio }) => {
  const navigate = useNavigate();
  const { setPendingTtsText } = useApp();

  const [inputText, setInputText] = useState('');
  const [outputText, setOutputText] = useState('');
  const [mode, setMode] = useState<TashkeelMode>('full');
  const [loading, setLoading] = useState(false);
  const [copying, setCopying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  const handleTashkeel = async () => {
    if (!inputText.trim()) return;
    setLoading(true);
    setError(null);
    setWarning(null);
    try {
      const result = await GeminiService.addDiacritics(inputText, mode);
      setOutputText(result.text);
      if (result.warning) {
        setWarning(result.warning);
      }
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
    setWarning(null);
  };

  const handleSendToTTS = () => {
    if (!outputText && !inputText) return;
    const textToSpeak = outputText || inputText;
    setPendingTtsText(textToSpeak);
    if (onSendToVoiceStudio) {
      onSendToVoiceStudio(textToSpeak);
    } else {
      navigate('/voice');
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
          <h2 className="text-2xl md:text-3xl font-calligraphy text-amber-400 mb-1 flex items-center gap-3">
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
            className={`px-3.5 py-1.5 rounded-lg transition-all cursor-pointer ${
              mode === 'full' 
                ? 'bg-amber-500 text-slate-950 font-bold shadow-sm' 
                : 'text-slate-400 hover:text-white'
            }`}
          >
            تشكيل كامل
          </button>
          <button
            onClick={() => setMode('ending')}
            className={`px-3.5 py-1.5 rounded-lg transition-all cursor-pointer ${
              mode === 'ending' 
                ? 'bg-amber-500 text-slate-950 font-bold shadow-sm' 
                : 'text-slate-400 hover:text-white'
            }`}
          >
            أواخر الكلمات (إعراب)
          </button>
          <button
            onClick={() => setMode('proofread')}
            className={`px-3.5 py-1.5 rounded-lg transition-all cursor-pointer ${
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
            className="text-xs bg-slate-800/60 hover:bg-slate-700/80 text-slate-300 hover:text-amber-300 px-3 py-1 rounded-lg border border-slate-700/50 transition-colors cursor-pointer"
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
                className="text-slate-500 hover:text-red-400 text-xs flex items-center gap-1 transition-colors cursor-pointer"
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
              className="w-full h-full min-h-[280px] bg-slate-800/30 border border-slate-700/60 rounded-2xl p-5 text-[17px] md:text-xl leading-loose font-sans text-white focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 outline-none resize-none transition-all"
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
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
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
                    className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 transition-all cursor-pointer"
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
            <textarea 
              id="tashkeel-output"
              readOnly
              className={`w-full h-full min-h-[280px] bg-slate-900/40 border border-white/10 rounded-2xl p-5 text-[17px] md:text-xl leading-loose font-sans text-amber-200 outline-none resize-none transition-all ${
                loading ? 'animate-pulse opacity-60' : ''
              }`}
              placeholder="ستظهر النتيجة المشكولة هنا بدقة وإتقان..."
              value={loading ? 'جاري استحضار القواعد وضبط التشكيل...' : outputText}
            />
          </div>
        </div>
      </div>

      {/* Warning / Error banners */}
      {warning && (
        <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-300 text-xs flex items-center gap-2">
          <Info className="w-4 h-4 shrink-0 text-amber-400" />
          <span>{warning}</span>
        </div>
      )}

      {error && (
        <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
          <span>{error}</span>
        </div>
      )}

      {/* Submit Button Bar */}
      <div className="mt-6 flex justify-end">
        <button
          onClick={handleTashkeel}
          disabled={loading || !inputText.trim()}
          className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-bold text-sm md:text-base shadow-lg shadow-amber-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 cursor-pointer"
        >
          {loading ? (
            <>
              <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
              <span>جاري التشكيل والتدقيق...</span>
            </>
          ) : (
            <>
              <Wand2 className="w-4 h-4" />
              <span>تنفيذ التشكيل والتدقيق اللغوي</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default TashkeelTool;
