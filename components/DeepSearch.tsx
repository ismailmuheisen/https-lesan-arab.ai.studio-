import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { GeminiService } from '../services/geminiService';
import { Message, FileFormat } from '../types';
import { Document, Packer, Paragraph, TextRun, AlignmentType } from "docx";
import { saveAs } from "file-saver";
import html2pdf from 'html2pdf.js';
import { useApp } from '../context/AppContext';
import { 
  Search, 
  Paperclip, 
  Send, 
  FileText, 
  Download, 
  Sparkles, 
  BookOpen, 
  X, 
  Copy, 
  Check,
  Wand2 
} from 'lucide-react';

interface DeepSearchProps {
  onNavigateToTashkeel?: () => void;
  onOpenDictionary?: () => void;
}

const SAMPLE_QUESTIONS = [
  'أعرب قول الله تعالى: "إنما يخشى اللهَ من عباده العلماءُ"',
  'ما الفروق الدقيقة بين (السنة والعام) و(الحزن والأسى) في المعاجم؟',
  'اشرح بيت المتنبي: "أنا الذي نظر الأعمى إلى أدبي"، وبيّن مواطن البلاغة فيه',
  'ما علامات بناء الفعل الماضي والمضارع والأمر بالتفصيل والشواهد؟'
];

const DeepSearch: React.FC<DeepSearchProps> = ({ onNavigateToTashkeel, onOpenDictionary }) => {
  const navigate = useNavigate();
  const { consumePendingSearchText, setPendingTtsText, setIsDictionaryModalOpen } = useApp();

  const [query, setQuery] = useState('');
  const [history, setHistory] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [attachedFile, setAttachedFile] = useState<{name: string, data: string, mimeType: string, isText?: boolean} | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Consume pending text from AppContext (or fallback to sessionStorage if legacy)
    const contextPrefill = consumePendingSearchText();
    const legacyPrefill = sessionStorage.getItem('lisan_search_input');
    const prefill = contextPrefill || legacyPrefill;

    if (prefill) {
      setQuery(`اشرح وفصّل إعراب وبلاغة: ${prefill}`);
      if (legacyPrefill) sessionStorage.removeItem('lisan_search_input');
    }
  }, [consumePendingSearchText]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [history, loading]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAttachedFile(null);

    try {
      if (file.type === 'application/pdf') {
        const reader = new FileReader();
        reader.onload = () => {
          const base64String = reader.result as string;
          const base64Data = base64String.split(',')[1];
          setAttachedFile({
            name: file.name,
            data: base64Data,
            mimeType: 'application/pdf',
            isText: false
          });
        };
        reader.readAsDataURL(file);
      } else if (
        file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || 
        file.name.toLowerCase().endsWith('.docx')
      ) {
        if (file.size === 0) {
          alert("عذراً، الملف فارغ.");
          if (fileInputRef.current) fileInputRef.current.value = '';
          return;
        }

        const arrayBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (event) => {
            if (event.target?.result instanceof ArrayBuffer) {
              resolve(event.target.result);
            } else {
              reject(new Error("Failed to read file content"));
            }
          };
          reader.onerror = () => reject(new Error("File read error"));
          reader.readAsArrayBuffer(file);
        });

        try {
          // Dynamic import of mammoth as requested
          const mammothModule = await import('mammoth');
          const mammoth = mammothModule.default || mammothModule;
          const result = await mammoth.extractRawText({ arrayBuffer });
          setAttachedFile({
            name: file.name,
            data: result.value,
            mimeType: 'text/plain',
            isText: true
          });
        } catch (mammothError: any) {
          console.error("DOCX extraction error", mammothError);
          alert("عذراً، هذا الملف يبدو تالفاً أو تعذرت قراءته بصيغة Word.");
        }
      } else {
        alert("نوع الملف غير مدعوم. يرجى اختيار ملف بصيغة PDF أو DOCX.");
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    } catch (err) {
      console.error("General file read error", err);
      alert("فشل قراءة الملف. يرجى المحاولة مرة أخرى.");
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const clearAttachment = () => {
    setAttachedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSearch = async (overrideQuery?: string) => {
    const q = overrideQuery !== undefined ? overrideQuery : query;
    if (!q.trim() && !attachedFile) return;
    
    const displayContent = attachedFile 
      ? `${q}\n\n[ملف مرفق للتحليل: ${attachedFile.name}]` 
      : q;

    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: displayContent };
    const aiMsgId = (Date.now() + 1).toString();
    const initialAiMsg: Message = { id: aiMsgId, role: 'model', content: '' };

    setHistory(prev => [...prev, userMsg, initialAiMsg]);
    setQuery('');
    setLoading(true);

    try {
      const context = history.slice(-2).map(h => `${h.role === 'user' ? 'السائل' : 'المجيب'}: ${h.content}`).join('\n\n');
      
      let finalQuery = q || 'قم بتحليل واستخراج الدرر اللغوية والنحوية من هذا الملف المرفق بالتفصيل.';
      let filePayload = undefined;

      if (attachedFile) {
        if (attachedFile.isText) {
          finalQuery = `${finalQuery}\n\nنص المستند المرفق:\n${attachedFile.data}`;
        } else {
          filePayload = {
            mimeType: attachedFile.mimeType,
            data: attachedFile.data
          };
        }
      }

      const finalResponse = await GeminiService.deepSearch(
        finalQuery,
        context,
        filePayload,
        (streamedText) => {
          setHistory(prev => {
            const next = [...prev];
            const targetIdx = next.findIndex(m => m.id === aiMsgId);
            if (targetIdx !== -1) {
              next[targetIdx] = {
                ...next[targetIdx],
                content: streamedText
              };
            }
            return next;
          });
        }
      );

      if (finalResponse) {
        setHistory(prev => {
          const next = [...prev];
          const targetIdx = next.findIndex(m => m.id === aiMsgId);
          if (targetIdx !== -1) {
            next[targetIdx] = {
              ...next[targetIdx],
              content: finalResponse
            };
          }
          return next;
        });
      }
    } catch (err: any) {
      console.error("Search error", err);
      const errorMsg = err?.message || 'تعذر استكمال التحليل اللغوي حالياً. يرجى المحاولة لاحقاً.';
      setHistory(prev => {
        const next = [...prev];
        const targetIdx = next.findIndex(m => m.id === aiMsgId);
        if (targetIdx !== -1) {
          next[targetIdx] = {
            ...next[targetIdx],
            content: `⚠️ ${errorMsg}`
          };
        }
        return next;
      });
    } finally {
      setLoading(false);
      clearAttachment();
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const downloadContent = async (content: string, format: FileFormat) => {
    if (format === FileFormat.DOCX) {
      const paragraphs = content.split('\n\n').map(para => {
        return new Paragraph({
          children: [
            new TextRun({
              text: para,
              font: "Almarai",
              size: 24,
              rightToLeft: true,
            }),
          ],
          alignment: AlignmentType.RIGHT,
          bidirectional: true,
          spacing: { after: 200, line: 360 },
        });
      });

      const doc = new Document({
        sections: [{
          properties: {
            page: {
              margin: {
                top: 1440,
                right: 1440,
                bottom: 1440,
                left: 1440,
              },
            },
          },
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: "تقرير التحليل اللغوي – منصة لسان للذكاء الاصطناعي",
                  bold: true,
                  size: 32,
                  font: "Almarai",
                  color: "B45309",
                  rightToLeft: true,
                }),
              ],
              alignment: AlignmentType.RIGHT,
              bidirectional: true,
              spacing: { after: 400 },
            }),
            ...paragraphs,
          ],
        }],
      });

      const blob = await Packer.toBlob(doc);
      saveAs(blob, `lisan-linguistics-report-${Date.now()}.docx`);
    } else if (format === FileFormat.PDF) {
      const container = document.createElement('div');
      container.style.padding = '30px';
      container.style.fontFamily = "'Almarai', sans-serif";
      container.style.direction = 'rtl';
      container.style.textAlign = 'right';
      container.style.color = '#0f172a';
      container.style.backgroundColor = '#ffffff';

      const title = document.createElement('h1');
      title.innerText = 'تقرير التحليل اللغوي – منصة لسان';
      title.style.color = '#b45309';
      title.style.borderBottom = '2px solid #f59e0b';
      title.style.paddingBottom = '10px';
      title.style.marginBottom = '20px';
      container.appendChild(title);

      const body = document.createElement('div');
      body.style.whiteSpace = 'pre-wrap';
      body.style.lineHeight = '1.8';
      body.style.fontSize = '14px';
      body.innerText = content;
      container.appendChild(body);

      const opt = {
        margin: [15, 15, 15, 15] as [number, number, number, number],
        filename: `lisan-report-${Date.now()}.pdf`,
        image: { type: 'jpeg' as const, quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm' as const, format: 'a4' as const, orientation: 'portrait' as const }
      };

      html2pdf().set(opt).from(container).save();
    }
  };

  const handleTashkeelRedirect = (text: string) => {
    setPendingTtsText(text);
    if (onNavigateToTashkeel) {
      onNavigateToTashkeel();
    } else {
      navigate('/tashkeel');
    }
  };

  const openDictionaryHandler = () => {
    if (onOpenDictionary) {
      onOpenDictionary();
    } else {
      setIsDictionaryModalOpen(true);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full p-3 md:p-6 max-w-6xl mx-auto w-full">
      {/* Header Bar */}
      <div className="flex items-center justify-between pb-4 mb-4 border-b border-white/10">
        <div>
          <h2 className="text-xl md:text-2xl font-bold font-calligraphy text-amber-300 flex items-center gap-2">
            <Search className="w-6 h-6 text-amber-400" />
            مجلس البحث والتحليل اللغوي
          </h2>
          <p className="text-xs text-slate-400 mt-1 font-sans">
            تحليل إعرابي، صرفي، وبلاغي دقيق مع توثيق الشواهد والمعاجم
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button 
            onClick={openDictionaryHandler}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-amber-300 border border-amber-500/20 text-xs transition-colors cursor-pointer"
            title="تصفح قاموس المصطلحات"
          >
            <BookOpen className="w-4 h-4 text-amber-400" />
            <span className="hidden sm:inline">قاموس المصطلحات</span>
          </button>
        </div>
      </div>

      {/* Chat / Analysis History */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-5 mb-4 pe-1 ps-1">
        {history.length === 0 && (
          <div className="flex flex-col items-center justify-center min-h-[280px] text-slate-500 space-y-4 text-center p-6">
            <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-amber-400">
              <BookOpen className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-lg font-sans text-slate-300 font-medium mb-1">
                مرحباً بك في مجلس لسان اللغوي
              </h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                اطرح مسألة نحوية، استفسر عن معاني الألفاظ في بطون المعاجم، أو أرفق نصاً أو ملفاً لتحليله.
              </p>
            </div>

            {/* Quick Inspiration Queries */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-w-2xl w-full pt-2">
              {SAMPLE_QUESTIONS.map((item, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSearch(item)}
                  className="text-start text-xs bg-slate-900/60 hover:bg-slate-800 text-slate-300 hover:text-amber-300 p-3 rounded-xl border border-white/5 transition-all text-ellipsis overflow-hidden cursor-pointer"
                >
                  <span className="text-amber-400 font-bold me-1.5">✦</span>
                  {item}
                </button>
              ))}
            </div>
          </div>
        )}
        
        {history.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-start' : 'justify-end'}`}>
            <div className={`
              max-w-[90%] md:max-w-[85%] p-5 rounded-2xl shadow-xl border relative
              ${msg.role === 'user' 
                ? 'bg-slate-800/60 border-slate-700 text-white rounded-br-none' 
                : 'bg-slate-900/80 border-amber-500/20 text-slate-100 rounded-bl-none backdrop-blur-md'}
            `}>
              {msg.role === 'model' && (
                <div className="flex items-center gap-2 mb-3 pb-2 border-b border-white/10 text-xs text-amber-400 font-bold">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>تحليل لسان اللغوي</span>
                </div>
              )}

              {/* Long Arabic Reading Text at 17px with comfortable line height */}
              <div className="font-sans text-[17px] md:text-lg leading-relaxed whitespace-pre-wrap selection:bg-amber-500/30">
                {msg.content || (msg.role === 'model' && loading ? (
                  <div className="flex items-center gap-2.5 text-amber-300 py-1">
                    <div className="w-3.5 h-3.5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                    <span className="text-sm font-sans animate-pulse">الباحث يستقرئ المعاجم ويستنبط الإعراب...</span>
                  </div>
                ) : null)}
              </div>

              {msg.role === 'model' && msg.content && (
                <div className="mt-4 pt-3 border-t border-white/10 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => copyToClipboard(msg.content, msg.id)}
                      className="flex items-center gap-1 text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-700 px-3 py-1.5 rounded-lg border border-white/5 transition-colors cursor-pointer"
                      title="نسخ التحليل"
                    >
                      {copiedId === msg.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedId === msg.id ? 'تم النسخ' : 'نسخ النص'}</span>
                    </button>

                    <button 
                      onClick={() => handleTashkeelRedirect(msg.content)}
                      className="flex items-center gap-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 px-3 py-1.5 rounded-lg border border-amber-500/30 transition-colors cursor-pointer"
                      title="الانتقال إلى المشكّل لتشكيل النص"
                    >
                      <Wand2 className="w-3.5 h-3.5" />
                      <span>تشكيل النص</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-slate-400">تصدير التقرير:</span>
                    <button 
                      onClick={() => downloadContent(msg.content, FileFormat.DOCX)} 
                      className="flex items-center gap-1 bg-blue-600/20 hover:bg-blue-600/30 text-blue-200 border border-blue-500/40 px-2.5 py-1 rounded-lg transition-colors font-medium cursor-pointer"
                    >
                      <FileText className="w-3 h-3" />
                      <span>DOCX</span>
                    </button>
                    <button 
                      onClick={() => downloadContent(msg.content, FileFormat.PDF)} 
                      className="flex items-center gap-1 bg-red-600/20 hover:bg-red-600/30 text-red-200 border border-red-500/40 px-2.5 py-1 rounded-lg transition-colors font-medium cursor-pointer"
                    >
                      <Download className="w-3 h-3" />
                      <span>PDF</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
        
        {loading && history[history.length - 1]?.content && (
          <div className="flex justify-end">
            <div className="bg-slate-900/90 px-3 py-1.5 rounded-xl border border-amber-500/30 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
              <span className="text-xs text-amber-300 font-sans">جاري استكمال التدفق...</span>
            </div>
          </div>
        )}
      </div>

      {/* Input Form & Attachment Bar */}
      <div className="relative flex flex-col bg-slate-900/80 border border-white/10 rounded-2xl p-2 shadow-2xl">
        {attachedFile && (
          <div className="flex items-center justify-between bg-amber-500/10 border border-amber-500/30 rounded-xl px-3 py-1.5 mb-2 text-xs text-amber-200">
            <div className="flex items-center gap-2 truncate">
              <FileText className="w-4 h-4 text-amber-400 shrink-0" />
              <span className="truncate font-medium">مستند مرفق: {attachedFile.name}</span>
            </div>
            <button 
              onClick={clearAttachment} 
              className="text-slate-400 hover:text-red-400 p-1 transition-colors cursor-pointer"
              title="إزالة المرفق"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <div className="flex items-center gap-2">
          {/* File Attach Button */}
          <div>
            <input 
              type="file" 
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept=".pdf,.doc,.docx"
              className="hidden"
            />
            <button 
              onClick={() => fileInputRef.current?.click()}
              className={`p-3 rounded-xl transition-all cursor-pointer ${
                attachedFile 
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-md' 
                  : 'bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-700'
              }`}
              title="إرفاق ملف مستند (PDF أو DOCX)"
            >
              <Paperclip className="w-5 h-5" />
            </button>
          </div>

          <textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { 
              if (e.key === 'Enter' && !e.shiftKey) { 
                e.preventDefault(); 
                handleSearch(); 
              }
            }}
            placeholder={attachedFile ? "اكتب سؤالك أو المطلوب تحليله في المستند المرفق..." : "اكتب مسألتك اللغوية، الإعرابية، أو المعجمية هنا (أو اضغط Enter)..."}
            className="flex-1 bg-transparent border-none text-white px-3 py-2 focus:ring-0 outline-none resize-none font-sans text-base md:text-lg placeholder-slate-500 max-h-28 min-h-[44px]"
            rows={1}
          />
          
          <button
            onClick={() => handleSearch()}
            disabled={loading || (!query.trim() && !attachedFile)}
            className="bg-amber-500 hover:bg-amber-400 text-slate-950 p-3 rounded-xl transition-all shadow-lg shadow-amber-500/20 disabled:opacity-30 disabled:cursor-not-allowed shrink-0 cursor-pointer"
            title="إرسال"
          >
            <Send className="w-5 h-5 -rotate-90" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeepSearch;
