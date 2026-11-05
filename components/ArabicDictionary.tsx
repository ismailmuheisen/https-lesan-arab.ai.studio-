import React, { useState, useMemo } from 'react';
import { ARABIC_DICTIONARY_TERMS, CATEGORY_METADATA } from '../data/arabicTermsData';
import { DictionaryTerm, TermCategoryKey } from '../types';
import { 
  Search, 
  BookOpen, 
  Sparkles, 
  Volume2, 
  Check, 
  Copy, 
  X, 
  Layers, 
  Lightbulb, 
  Shuffle, 
  HelpCircle,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  BrainCircuit,
  Filter
} from 'lucide-react';
import { GeminiService } from '../services/geminiService';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';

interface ArabicDictionaryProps {
  isModal?: boolean;
  onClose?: () => void;
  initialCategory?: TermCategoryKey;
  onSelectTermForSearch?: (term: string) => void;
}

export const ArabicDictionary: React.FC<ArabicDictionaryProps> = ({
  isModal = false,
  onClose,
  initialCategory = 'all',
  onSelectTermForSearch,
}) => {
  const navigate = useNavigate();
  const { setPendingSearchText, setIsDictionaryModalOpen } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<TermCategoryKey>(initialCategory);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  
  // Interactive Flashcard / Quiz Mode State
  const [quizMode, setQuizMode] = useState(false);
  const [currentQuizIndex, setCurrentQuizIndex] = useState(0);
  const [revealQuizAnswer, setRevealQuizAnswer] = useState(false);

  // AI Deep Dive drawer state
  const [deepDiveTerm, setDeepDiveTerm] = useState<DictionaryTerm | null>(null);
  const [deepDiveLoading, setDeepDiveLoading] = useState(false);
  const [deepDiveResult, setDeepDiveResult] = useState<string | null>(null);
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});

  // Filter terms
  const filteredTerms = useMemo(() => {
    return ARABIC_DICTIONARY_TERMS.filter((item) => {
      const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
      if (!matchesCategory) return false;

      if (!searchQuery.trim()) return true;

      const q = searchQuery.toLowerCase().trim();
      const inTerm = item.term.toLowerCase().includes(q);
      const inSummary = item.summary.toLowerCase().includes(q);
      const inExample = item.example.toLowerCase().includes(q);
      const inTags = item.tags?.some((t) => t.toLowerCase().includes(q));
      const inRule = item.simplifiedRule.toLowerCase().includes(q);

      return inTerm || inSummary || inExample || inTags || inRule;
    });
  }, [searchQuery, selectedCategory]);

  // Copy handler
  const handleCopy = (item: DictionaryTerm) => {
    const textToCopy = `المصطلح: ${item.term} (${item.categoryLabel})
الشرح المبسط: ${item.summary}
القاعدة الذهبية: ${item.simplifiedRule}
الشاهد والمثال: ${item.example}
التحليل: ${item.exampleAnalysis}
${item.commonMistake ? `تنبيه لغوي: ${item.commonMistake}` : ''}
— من قاموس لسان للمصطلحات النحوية والبلاغية`;

    navigator.clipboard.writeText(textToCopy);
    setCopiedId(item.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Audio Pronunciation via Web Speech API or friendly speech utterance
  const handlePronounce = (item: DictionaryTerm) => {
    if (!('speechSynthesis' in window)) {
      alert('المتصفح لا يدعم نطق الكلام الصوتي.');
      return;
    }

    window.speechSynthesis.cancel();
    setPlayingId(item.id);

    const text = `${item.term}. ${item.summary}. مثال: ${item.example}`;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'ar-SA';
    utterance.rate = 0.88;

    utterance.onend = () => setPlayingId(null);
    utterance.onerror = () => setPlayingId(null);

    window.speechSynthesis.speak(utterance);
  };

  // AI Deep Dive Handler
  const handleDeepDive = async (item: DictionaryTerm) => {
    setDeepDiveTerm(item);
    setDeepDiveLoading(true);
    setDeepDiveResult(null);

    try {
      const prompt = `أنت علامة ومحقق في علوم اللغة العربية والنحو والبلاغة في منصة لسان.
اشرح بتفصيل تحقيقي وشائق للمتعلم مصطلح «${item.term}» من ${item.categoryLabel}:
1. المفهوم اللغوي والاصطلاحي الدقيق عند أئمة النحو والبلاغة (سيبويه، عبد القاهر الجرجاني، السكاكي).
2. الفروق الجوهرية الدقيقة بينه وبين ما قد يلتبس به.
3. شاهدان قرآنيان وشاهدان من عيون الشعر العربي مع الإعراب/التحليل البلاغي الكامل.
4. سر الجمال والأثر النفسي أو النظمي في هذا الأسلوب.
اكتب باللغة العربية الفصحى الرصينة، مع استخدام التنسيق الجميل والتشكيل للكلمات المفتاحية.`;

      const response = await GeminiService.deepSearch(prompt, `مصطلح: ${item.term}`);
      setDeepDiveResult(response);
    } catch (err: any) {
      setDeepDiveResult('تعذر جلب الشرح المعمق حالياً. يرجى التأكد من الاتصال والمحاولة لاحقاً.');
    } finally {
      setDeepDiveLoading(false);
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedCards((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Category counts
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: ARABIC_DICTIONARY_TERMS.length };
    for (const term of ARABIC_DICTIONARY_TERMS) {
      counts[term.category] = (counts[term.category] || 0) + 1;
    }
    return counts;
  }, []);

  // Category badge colors
  const getCategoryStyles = (category: string) => {
    switch (category) {
      case 'nahw':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
      case 'bayan':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
      case 'badee':
        return 'bg-purple-500/10 text-purple-400 border-purple-500/30';
      case 'maani':
        return 'bg-sky-500/10 text-sky-400 border-sky-500/30';
      case 'sarf':
        return 'bg-rose-500/10 text-rose-400 border-rose-500/30';
      default:
        return 'bg-slate-500/10 text-slate-300 border-slate-500/30';
    }
  };

  return (
    <div className={`flex flex-col h-full bg-slate-950/95 text-slate-100 ${isModal ? 'max-h-[88vh]' : 'min-h-[80vh]'}`} dir="rtl">
      {/* Header bar */}
      <div className="p-4 md:p-6 border-b border-white/10 bg-slate-900/60 backdrop-blur-xl flex flex-wrap items-center justify-between gap-3 sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-600 flex items-center justify-center text-slate-950 shadow-lg shadow-amber-500/20">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 id="dictionary-modal-title" className="text-xl md:text-2xl font-bold font-calligraphy text-amber-300">
                قاموس لسان للمصطلحات النحوية والبلاغية
              </h2>
              <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                {ARABIC_DICTIONARY_TERMS.length} مصطلحاً
              </span>
            </div>
            <p className="text-xs text-slate-400 font-sans mt-0.5">
              مرجع تفاعلي مبسط لعلوم النحو، الصرف، البيان، البديع، والمعاني مع الشواهد والأمثلة المشكولة
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Flashcard / Quiz Mode Toggle */}
          <button
            onClick={() => {
              setQuizMode(!quizMode);
              setRevealQuizAnswer(false);
            }}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
              quizMode 
                ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20 font-bold' 
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-white/5'
            }`}
            title="وضع البطاقات والتحدي لاختبار معلوماتك"
          >
            <HelpCircle className="w-4 h-4" />
            <span>{quizMode ? 'إنهاء التحدي' : 'اختبر معلوماتك'}</span>
          </button>

          {isModal && onClose && (
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
              title="إغلاق النافذة"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Interactive Quiz / Flashcard Mode */}
      {quizMode ? (
        <div className="flex-1 p-4 md:p-8 flex flex-col items-center justify-center max-w-2xl mx-auto w-full">
          <div className="w-full bg-gradient-to-b from-slate-900 to-slate-900/80 border border-amber-500/30 rounded-3xl p-6 md:p-8 shadow-2xl relative overflow-hidden">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs text-amber-400/90 font-mono bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/20">
                بطاقة {currentQuizIndex + 1} من {ARABIC_DICTIONARY_TERMS.length}
              </span>
              <span className={`text-xs px-3 py-1 rounded-full border ${getCategoryStyles(ARABIC_DICTIONARY_TERMS[currentQuizIndex].category)}`}>
                {ARABIC_DICTIONARY_TERMS[currentQuizIndex].categoryLabel}
              </span>
            </div>

            <div className="text-center py-6">
              <p className="text-sm text-slate-400 mb-2">ما هو المصطلح الذي يُعرَّف بـ:</p>
              <h3 className="text-lg md:text-xl font-bold text-slate-100 leading-relaxed mb-6 font-sans">
                «{ARABIC_DICTIONARY_TERMS[currentQuizIndex].summary}»
              </h3>

              {revealQuizAnswer ? (
                <div className="animate-in fade-in zoom-in-95 duration-300 bg-slate-950/80 rounded-2xl p-5 border border-emerald-500/40 text-right">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-emerald-400 text-xs font-bold flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-emerald-400" />
                      المصطلح الصحيح:
                    </span>
                    <button
                      onClick={() => handlePronounce(ARABIC_DICTIONARY_TERMS[currentQuizIndex])}
                      className="p-1.5 rounded-lg bg-slate-800 text-amber-400 hover:bg-slate-700"
                    >
                      <Volume2 className="w-4 h-4" />
                    </button>
                  </div>
                  <h4 className="text-2xl font-calligraphy font-bold text-amber-300 mb-2">
                    {ARABIC_DICTIONARY_TERMS[currentQuizIndex].term}
                  </h4>
                  <div className="text-xs text-slate-300 space-y-2 mt-3 pt-3 border-t border-white/10">
                    <p><strong className="text-amber-400">القاعدة الذهبية:</strong> {ARABIC_DICTIONARY_TERMS[currentQuizIndex].simplifiedRule}</p>
                    <p><strong className="text-emerald-400">المثال والشاهد:</strong> <span className="font-calligraphy text-sm text-slate-100">{ARABIC_DICTIONARY_TERMS[currentQuizIndex].example}</span></p>
                    <p><strong className="text-sky-400">التحليل:</strong> {ARABIC_DICTIONARY_TERMS[currentQuizIndex].exampleAnalysis}</p>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setRevealQuizAnswer(true)}
                  className="px-6 py-3 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-bold hover:brightness-110 shadow-lg shadow-amber-500/25 transition-all text-sm"
                >
                  كشف الإجابة والشاهد
                </button>
              )}
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-white/10 mt-4">
              <button
                onClick={() => {
                  setCurrentQuizIndex((prev) => (prev > 0 ? prev - 1 : ARABIC_DICTIONARY_TERMS.length - 1));
                  setRevealQuizAnswer(false);
                }}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 transition-colors"
              >
                السابق
              </button>
              <button
                onClick={() => {
                  const randomIdx = Math.floor(Math.random() * ARABIC_DICTIONARY_TERMS.length);
                  setCurrentQuizIndex(randomIdx);
                  setRevealQuizAnswer(false);
                }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800/60 hover:bg-slate-700 text-xs text-amber-300 transition-colors"
              >
                <Shuffle className="w-3.5 h-3.5" />
                <span>عشوائي</span>
              </button>
              <button
                onClick={() => {
                  setCurrentQuizIndex((prev) => (prev < ARABIC_DICTIONARY_TERMS.length - 1 ? prev + 1 : 0));
                  setRevealQuizAnswer(false);
                }}
                className="px-4 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-xs font-bold transition-colors"
              >
                التالي
              </button>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Search & Category Filter Toolbar */}
          <div className="p-4 md:p-6 pb-2 space-y-4">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-5 h-5 text-slate-400 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ابحث عن مصطلح (مثل: استعارة، مفعول مطلق، طباق، بدل، إيجاز...)"
                className="w-full bg-slate-900/90 border border-white/10 focus:border-amber-500/50 rounded-2xl py-3.5 pr-12 pl-12 text-sm text-slate-100 placeholder-slate-500 outline-none transition-all shadow-inner"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-200 p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Category Filter Chips */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
              <span className="text-xs text-slate-400 flex items-center gap-1 shrink-0 ml-1">
                <Filter className="w-3.5 h-3.5 text-amber-400" />
                التصنيف:
              </span>
              {CATEGORY_METADATA.map((cat) => {
                const isSelected = selectedCategory === cat.key;
                const count = categoryCounts[cat.key] || 0;
                return (
                  <button
                    key={cat.key}
                    onClick={() => setSelectedCategory(cat.key as TermCategoryKey)}
                    className={`
                      shrink-0 flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer
                      ${isSelected
                        ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20'
                        : 'bg-slate-900/80 text-slate-300 hover:bg-slate-800 border border-white/5'}
                    `}
                  >
                    <span>{cat.label}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded-md ${isSelected ? 'bg-slate-950/30 text-slate-900 font-bold' : 'bg-slate-800 text-slate-400'}`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Results Summary & Terms Grid */}
          <div className="flex-1 overflow-y-auto p-4 md:p-6 pt-2 space-y-4">
            <div className="flex items-center justify-between text-xs text-slate-400 px-1">
              <span>
                عرض <strong className="text-amber-400 font-bold">{filteredTerms.length}</strong> مصطلحاً
                {selectedCategory !== 'all' && ` في قسم «${CATEGORY_METADATA.find(c => c.key === selectedCategory)?.label}»`}
              </span>
              {filteredTerms.length > 0 && (
                <button
                  onClick={() => {
                    const randomIdx = Math.floor(Math.random() * filteredTerms.length);
                    const target = filteredTerms[randomIdx];
                    setExpandedCards(prev => ({ ...prev, [target.id]: true }));
                    const el = document.getElementById(`term-card-${target.id}`);
                    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  }}
                  className="flex items-center gap-1 text-amber-400 hover:text-amber-300 transition-colors"
                >
                  <Shuffle className="w-3.5 h-3.5" />
                  <span>انتقال عشوائي لمصطلح</span>
                </button>
              )}
            </div>

            {filteredTerms.length === 0 ? (
              <div className="text-center py-16 bg-slate-900/40 rounded-3xl border border-white/5 p-8">
                <BookOpen className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                <h3 className="text-base font-bold text-slate-300 mb-1">لم نعثر على نتائج مطابقة</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto mb-4">
                  جرب البحث بكلمات أخرى أو اختر «جميع المصطلحات» لإظهار الفهرس كاملاً.
                </p>
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedCategory('all');
                  }}
                  className="px-4 py-2 rounded-xl bg-amber-500/20 text-amber-300 text-xs font-bold hover:bg-amber-500/30 transition-colors"
                >
                  إعادة ضبط البحث
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {filteredTerms.map((item) => {
                  const isExpanded = expandedCards[item.id] ?? true;
                  const isCopied = copiedId === item.id;
                  const isPlaying = playingId === item.id;

                  return (
                    <div
                      key={item.id}
                      id={`term-card-${item.id}`}
                      className="group bg-slate-900/70 hover:bg-slate-900/90 border border-white/10 hover:border-amber-500/30 rounded-2xl p-4 md:p-5 transition-all duration-200 flex flex-col justify-between shadow-lg relative"
                    >
                      {/* Card Header */}
                      <div>
                        <div className="flex items-start justify-between gap-3 mb-2.5">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <span className={`text-xs font-medium px-2.5 py-0.5 rounded-lg border ${getCategoryStyles(item.category)}`}>
                                {item.categoryLabel}
                              </span>
                              {item.tags?.slice(0, 3).map((tag) => (
                                <span
                                  key={tag}
                                  onClick={() => setSearchQuery(tag)}
                                  className="text-xs text-slate-500 hover:text-amber-300 cursor-pointer bg-slate-800/60 px-2 py-0.5 rounded-md transition-colors"
                                >
                                  #{tag}
                                </span>
                              ))}
                            </div>
                            <h3 className="text-xl md:text-2xl font-bold font-calligraphy text-amber-300">
                              {item.term}
                            </h3>
                          </div>

                          {/* Quick Actions */}
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              onClick={() => handlePronounce(item)}
                              className={`p-2 rounded-xl border transition-colors ${
                                isPlaying
                                  ? 'bg-amber-500 text-slate-950 border-amber-400 animate-pulse'
                                  : 'bg-slate-800/80 hover:bg-slate-700 text-slate-300 border-white/5'
                              }`}
                              title="استمع للنطق والشرح"
                            >
                              <Volume2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleCopy(item)}
                              className={`p-2 rounded-xl border transition-colors ${
                                isCopied
                                  ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                                  : 'bg-slate-800/80 hover:bg-slate-700 text-slate-300 border-white/5'
                              }`}
                              title="نسخ المصطلح وشرحه"
                            >
                              {isCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                            </button>
                            <button
                              onClick={() => toggleExpand(item.id)}
                              className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-slate-200 border border-white/5 transition-colors"
                              title={isExpanded ? 'طي التفاصيل' : 'عرض التفاصيل'}
                            >
                              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </button>
                          </div>
                        </div>

                        {/* Simplified Definition */}
                        <div className="bg-slate-950/40 rounded-xl p-3 border border-white/5 mb-3">
                          <p className="text-sm text-slate-200 leading-relaxed font-sans">
                            {item.summary}
                          </p>
                        </div>

                        {/* Collapsible Details */}
                        {isExpanded && (
                          <div className="space-y-3 pt-1 animate-in fade-in duration-200">
                            {/* Golden Rule */}
                            <div className="bg-amber-500/5 rounded-xl p-3 border border-amber-500/20">
                              <div className="flex items-center gap-1.5 text-xs font-bold text-amber-400 mb-1">
                                <Sparkles className="w-3.5 h-3.5" />
                                <span>القاعدة الذهبية المبسطة:</span>
                              </div>
                              <p className="text-xs text-amber-200/90 font-medium leading-relaxed">
                                {item.simplifiedRule}
                              </p>
                            </div>

                            {/* Vocalized Example */}
                            <div className="bg-slate-950/70 rounded-xl p-3 border border-white/10">
                              <div className="text-xs font-bold text-emerald-400 mb-1 flex items-center justify-between">
                                <span>المثال والشاهد البلاغي:</span>
                                <span className="text-xs text-slate-500">مشكول بالكامل</span>
                              </div>
                              <p className="font-calligraphy text-base md:text-lg text-emerald-300 leading-relaxed mb-2">
                                {item.example}
                              </p>
                              <div className="text-xs text-slate-400 pt-2 border-t border-white/5 leading-relaxed">
                                <strong className="text-slate-300">التحليل: </strong>
                                {item.exampleAnalysis}
                              </div>
                            </div>

                            {/* Common Mistake / Note if any */}
                            {item.commonMistake && (
                              <div className="bg-rose-500/5 rounded-xl p-2.5 border border-rose-500/20 text-xs text-rose-300/90 flex items-start gap-2">
                                <Lightbulb className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                                <div>
                                  <strong className="text-rose-400">فائدة وتنبيه: </strong>
                                  {item.commonMistake}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Card Footer Actions */}
                      <div className="pt-3 mt-3 border-t border-white/5 flex items-center justify-between gap-2">
                        <button
                          onClick={() => handleDeepDive(item)}
                          className="flex items-center gap-1.5 text-xs text-amber-400 hover:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 px-3 py-1.5 rounded-xl border border-amber-500/20 transition-all font-medium"
                        >
                          <BrainCircuit className="w-3.5 h-3.5 text-amber-400" />
                          <span>شرح معمق بالذكاء الاصطناعي</span>
                        </button>

                        <button
                          onClick={() => {
                            setPendingSearchText(item.term);
                            if (onSelectTermForSearch) {
                              onSelectTermForSearch(item.term);
                            } else {
                              if (isModal && onClose) onClose();
                              setIsDictionaryModalOpen(false);
                              navigate('/search');
                            }
                          }}
                          className="flex items-center gap-1 text-xs text-slate-400 hover:text-amber-300 transition-colors cursor-pointer"
                        >
                          <span>بحث موسع</span>
                          <ExternalLink className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      {/* AI Deep Dive Drawer / Overlay */}
      {deepDiveTerm && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-amber-500/40 rounded-3xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-4 md:p-5 border-b border-white/10 flex items-center justify-between bg-slate-900/90 sticky top-0 z-10">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center justify-center">
                  <BrainCircuit className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <h3 className="font-calligraphy font-bold text-lg md:text-xl text-amber-300">
                    الشرح المعمق: {deepDiveTerm.term}
                  </h3>
                  <span className="text-xs text-slate-400">
                    مستخرج بواسطة محرك لسان التحقيقي
                  </span>
                </div>
              </div>
              <button
                onClick={() => setDeepDiveTerm(null)}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-5 md:p-6 space-y-4 text-sm leading-relaxed text-slate-200 font-sans">
              {deepDiveLoading ? (
                <div className="py-16 text-center space-y-3">
                  <div className="w-10 h-10 border-2 border-amber-400 border-t-transparent rounded-full animate-spin mx-auto" />
                  <p className="text-amber-300 text-sm font-medium">جاري استخراج المراجع والأقوال النحوية والبلاغية...</p>
                  <p className="text-xs text-slate-500">سيبويه، عبد القاهر الجرجاني، والسكاكي</p>
                </div>
              ) : (
                <div className="whitespace-pre-line bg-slate-950/60 p-4 md:p-5 rounded-2xl border border-white/5 leading-relaxed font-sans">
                  {deepDiveResult}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-white/10 flex items-center justify-between bg-slate-900/80">
              <span className="text-xs text-slate-500">
                يمكنك نسخ الشرح أو الاستزادة في قسم البحث والتحليل
              </span>
              <button
                onClick={() => {
                  if (deepDiveResult) {
                    navigator.clipboard.writeText(deepDiveResult);
                    alert('تم نسخ الشرح المعمق!');
                  }
                }}
                disabled={!deepDiveResult}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition-all disabled:opacity-50"
              >
                نسخ الشرح
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ArabicDictionary;
