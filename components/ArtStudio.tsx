import React, { useState } from 'react';
import { GeminiService } from '../services/geminiService';
import { Palette, Download, Sparkles, Feather, Image as ImageIcon, RefreshCw, Layers } from 'lucide-react';
import { motion } from 'motion/react';

const ART_SCRIPTS = [
  { id: 'خط الثلث', label: 'خط الثلث الملكي', desc: 'تاج الخطوط العربية وفخر المحاريب والمساجد' },
  { id: 'الخط الكوفي المورق', label: 'الخط الكوفي التاريخي', desc: 'هندسي عريق مع توريقات نباتية إسلامية' },
  { id: 'الخط الديواني الجلي', label: 'الخط الديواني الجلي', desc: 'انحناءات رشيقة، تداخلات وحركات تزيينية' },
  { id: 'خط الرقعة الفني', label: 'خط الرقعة الأدبي', desc: 'قوة وسرعة ووضوح الحروف والمدات' },
  { id: 'خط النسخ الدقيق', label: 'خط النسخ القرآني', desc: 'اتزان ورصانة وبهاء الحروف' },
];

const ATMOSPHERES = [
  { id: 'royal-gold', label: 'ملكي وذهب لازوردي', desc: 'أزرق ملكي داكن وتذهيب 24 قيراط' },
  { id: 'parchment-manuscript', label: 'رق غزال ومخطوطات', desc: 'ورق أرشيفي عتيق وحبر جوزي وقرمزي' },
  { id: 'modern-islamic', label: 'تجريدي إسلامي معاصر', desc: 'إضاءة مضيئة وأبعاد ثلاثية حديثة' },
];

const PRESETS = [
  'بسم الله الرحمن الرحيم بخط الثلث الجلي في دائرة شمسية مزخرفة بالذهب واللازورد',
  'وقل رب زدني علماً داخل شمسة أندلسية مذهبة مع إطار زخرفي نباتي عريق',
  'لا غالب إلا الله بنقش كوفي مركب وتوريقات قصر الحمراء',
  'إذا غامَرْتَ في شَرَفٍ مَرُومِ فَلا تَقنَعْ بِمَا دُونَ النّجُومِ'
];

const ArtStudio: React.FC = () => {
  const [prompt, setPrompt] = useState('');
  const [style, setStyle] = useState<'calligraphy' | 'manuscript' | 'modern'>('calligraphy');
  const [scriptType, setScriptType] = useState('خط الثلث');
  const [atmosphere, setAtmosphere] = useState('royal-gold');
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    setError(null);
    setGeneratedImage(null);
    try {
      const base64Image = await GeminiService.generateArt(prompt, style, scriptType, atmosphere);
      setGeneratedImage(base64Image);
    } catch (err) {
      console.error("Art generation error", err);
      setError("تعذر توليد اللوحة الفنية حالياً. يرجى تجربة وصف آخر أو المحاولة بعد قليل.");
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (!generatedImage) return;
    const a = document.createElement('a');
    a.href = generatedImage;
    a.download = `lisan-art-${Date.now()}.png`;
    a.click();
  };

  return (
    <div className="flex flex-col h-full p-4 md:p-8 max-w-6xl mx-auto overflow-y-auto">
      {/* Header */}
      <div className="mb-6 border-b border-white/10 pb-4">
        <h2 className="text-3xl font-calligraphy text-amber-400 mb-1 flex items-center gap-3">
          <Palette className="w-8 h-8 text-amber-400" />
          مرسم الفنون والمخطوطات العربية
        </h2>
        <p className="text-slate-400 font-light font-sans text-sm md:text-base">
          إبداع اللوحات الخطية، المخطوطات الأثرية المذهبة، والزخارف الإسلامية بروح إبداعية راقية.
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 flex-1">
        {/* Controls Column */}
        <div className="w-full lg:w-5/12 space-y-5">
          {/* Prompt & Presets */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-white font-bold text-sm flex items-center gap-2">
                <Feather className="w-4 h-4 text-amber-400" />
                <span>نص أو وصف العمل الفني</span>
              </label>
            </div>
            
            <textarea 
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="اكتب العبارة أو الآية أو بيت الشعر ووصف الزخرفة المطلوبة..."
              className="w-full h-28 bg-slate-800/40 border border-slate-700 rounded-2xl p-4 text-base font-sans text-white focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 outline-none resize-none leading-relaxed"
            />

            {/* Quick Inspiration Pills */}
            <div className="space-y-1 pt-1">
              <span className="text-[11px] text-slate-400 block">اقتراحات ملهمة للوحات:</span>
              <div className="flex flex-col gap-1.5">
                {PRESETS.slice(0, 2).map((item, idx) => (
                  <button
                    key={idx}
                    onClick={() => setPrompt(item)}
                    className="text-right text-xs text-slate-300 hover:text-amber-300 bg-slate-800/60 hover:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-700/50 truncate transition-colors"
                  >
                    ✦ {item}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Script Selection */}
          <div className="space-y-2">
            <label className="text-slate-200 font-bold text-sm flex items-center gap-2">
              <Layers className="w-4 h-4 text-emerald-400" />
              <span>قلم ونوع الخط</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {ART_SCRIPTS.map(script => (
                <button
                  key={script.id}
                  onClick={() => setScriptType(script.id)}
                  className={`p-2.5 rounded-xl border text-right transition-all text-xs ${
                    scriptType === script.id 
                      ? 'bg-amber-500/20 border-amber-400 text-amber-300 font-bold shadow-sm' 
                      : 'bg-slate-900/40 border-slate-800 text-slate-400 hover:bg-white/5'
                  }`}
                >
                  <div className="font-semibold">{script.label}</div>
                  <div className="text-[10px] text-slate-500 truncate mt-0.5">{script.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Style & Atmosphere */}
          <div className="space-y-2">
            <label className="text-slate-200 font-bold text-sm flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>البيئة والأسلوب البصري</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              {ATMOSPHERES.map(atm => (
                <button
                  key={atm.id}
                  onClick={() => setAtmosphere(atm.id)}
                  className={`p-2 rounded-xl border text-center transition-all text-xs ${
                    atmosphere === atm.id 
                      ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200 font-bold' 
                      : 'bg-slate-900/40 border-slate-800 text-slate-400 hover:bg-white/5'
                  }`}
                >
                  <div className="font-medium text-[11px] truncate">{atm.label.split(' ')[0]}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Generate Button */}
          <motion.button 
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            onClick={handleGenerate}
            disabled={loading || !prompt.trim()}
            className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold py-3.5 rounded-2xl shadow-lg shadow-amber-500/20 transition-all disabled:opacity-30 disabled:cursor-not-allowed text-base font-sans flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <span className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                <span>جاري رسم وتذهيب اللوحة...</span>
              </>
            ) : (
              <>
                <Palette className="w-5 h-5" />
                <span>إبداع اللوحة الفنية</span>
              </>
            )}
          </motion.button>
        </div>

        {/* Canvas / Showcase Area */}
        <div className="w-full lg:w-7/12 bg-slate-950/70 rounded-3xl border border-white/10 flex flex-col items-center justify-center relative overflow-hidden min-h-[420px] p-4 shadow-inner">
          {!generatedImage && !loading && (
            <div className="text-center text-slate-600 space-y-3 p-8">
              <div className="w-20 h-20 rounded-3xl bg-slate-900 border border-slate-800 flex items-center justify-center mx-auto text-slate-500">
                <ImageIcon className="w-10 h-10" />
              </div>
              <h3 className="text-lg font-sans text-slate-400 font-medium">اللوحة الفنية المرتقبة ستظهر هنا</h3>
              <p className="text-xs text-slate-600 max-w-sm mx-auto">
                اختر نوع الخط والزخرفة المرغوبة وانقر على "إبداع اللوحة الفنية" لبدء التوليد البصري فائق الدقة.
              </p>
            </div>
          )}
          
          {loading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/80 backdrop-blur-md z-20 p-6 text-center">
              <div className="w-16 h-16 border-4 border-amber-500/20 border-t-amber-500 rounded-full animate-spin mb-4" />
              <p className="text-amber-300 font-calligraphy text-2xl animate-pulse">الريشة الذكية تخطّ جماليات الحروف...</p>
              <p className="text-slate-400 text-xs mt-2 font-sans">تنسيق القوالب، التوريقات النباتية، والإضاءات التذهيبية</p>
            </div>
          )}

          {error && !loading && (
            <div className="text-center text-red-400 p-6">
              <p className="text-sm mb-3">{error}</p>
              <button
                onClick={handleGenerate}
                className="text-xs bg-red-500/20 text-red-200 px-4 py-2 rounded-xl border border-red-500/30"
              >
                إعادة المحاولة
              </button>
            </div>
          )}

          {generatedImage && !loading && (
            <div className="w-full h-full flex flex-col items-center justify-center gap-4 animate-fadeIn">
              <div className="relative rounded-2xl overflow-hidden border-2 border-amber-500/30 shadow-2xl max-h-[500px] w-full flex items-center justify-center bg-slate-950">
                <img 
                  src={generatedImage} 
                  alt={prompt} 
                  className="max-h-[480px] w-auto object-contain rounded-xl"
                  referrerPolicy="no-referrer"
                />
              </div>

              <div className="flex flex-wrap gap-3 justify-center">
                <button 
                  onClick={handleDownload}
                  className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-slate-950 px-6 py-2.5 rounded-xl font-bold transition-all shadow-lg shadow-amber-500/20 text-sm"
                >
                  <Download className="w-4 h-4" />
                  <span>تحميل اللوحة عالية الدقة (PNG)</span>
                </button>

                <button 
                  onClick={handleGenerate}
                  className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 px-5 py-2.5 rounded-xl transition-all border border-slate-700 text-sm"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>توليد لوحة أخرى لنفس النص</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ArtStudio;
