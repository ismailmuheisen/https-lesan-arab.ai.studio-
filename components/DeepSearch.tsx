import React, { useState, useRef, useEffect } from 'react';
import { GeminiService } from '../services/geminiService';
import { Message, FileFormat } from '../types';
import { Document, Packer, Paragraph, TextRun, AlignmentType } from "docx";
import { saveAs } from "file-saver";
import html2pdf from 'html2pdf.js';
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

declare global {
  interface Window {
    mammoth: any;
    lamejs: any;
  }
}

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
  const [query, setQuery] = useState('');
  const [history, setHistory] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [attachedFile, setAttachedFile] = useState<{name: string, data: string, mimeType: string, isText?: boolean} | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const prefill = sessionStorage.getItem('lisan_search_input');
    if (prefill) {
      setQuery(`اشرح وفصّل إعراب وبلاغة: ${prefill}`);
      sessionStorage.removeItem('lisan_search_input');
    }
  }, []);

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

        if (window.mammoth) {
          try {
            const result = await window.mammoth.extractRawText({ arrayBuffer });
            setAttachedFile({
              name: file.name,
              data: result.value,
              mimeType: 'text/plain',
              isText: true
            });
          } catch (mammothError: any) {
            console.error("DOCX extraction error", mammothError);
            alert("عذراً، هذا الملف يبدو تالفاً أو ليس ملف Word (docx) صالحاً.");
          }
        } else {
          alert("مكتبة قراءة الملفات قيد التحميل، يرجى المحاولة بعد ثوانٍ.");
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
    setHistory(prev => [...prev, userMsg]);
    setQuery('');
    setLoading(true);

    try {
      const context = history.slice(-2).map(h => `${h.role === 'user' ? 'السائل' : 'المجيب'}: ${h.content}`).join('\n\n');
      
      let finalQuery = q || 'قم بتحليل واستخراج الدرر اللغوية والنحوية من هذا الملف المرفق بالتفصيل.';
      let filePayload = undefined;

      if (attachedFile) {
        if (attachedFile.isText) {
          finalQuery += `\n\n[محتوى الملف المرفق: ${attachedFile.name}]:\n${attachedFile.data}`;
        } else {
          filePayload = { mimeType: attachedFile.mimeType, data: attachedFile.data };
        }
      }
      
      const responseText = await GeminiService.deepSearch(
        finalQuery, 
        context, 
        filePayload
      );
      
      const aiMsg: Message = { id: (Date.now() + 1).toString(), role: 'model', content: responseText };
      setHistory(prev => [...prev, aiMsg]);
      clearAttachment();
    } catch (error) {
      console.error(error);
      const errorMsg: Message = { 
        id: Date.now().toString(), 
        role: 'model', 
        content: 'عذراً، حدث خطأ أثناء الاتصال بالباحث اللغوي. يرجى المحاولة مرة أخرى والتأكد من صياغة السؤال أو سلامة الملف المرفق.' 
      };
      setHistory(prev => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const downloadContent = async (text: string, format: FileFormat) => {
    if (format === FileFormat.PDF) {
      const element = document.createElement('div');
      element.setAttribute('dir', 'rtl');
      element.style.fontFamily = "'Almarai', sans-serif";
      element.style.padding = '36px';
      element.style.color = '#0f172a';
      element.style.lineHeight = '2';
      element.style.fontSize = '14pt';
      element.style.backgroundColor = '#ffffff';
      
      const formattedText = text.replace(/\n/g, '<br/>');
      element.innerHTML = `
        <div style="border-bottom: 2px solid #d97706; padding-bottom: 12px; margin-bottom: 24px;">
          <h1 style="color: #b45309; font-family: 'Aref Ruqaa', serif; margin: 0; font-size: 26pt;">لسـان الذكاء العربي</h1>
          <p style="color: #64748b; font-size: 11pt; margin: 4px 0 0 0;">تقرير البحث اللغوي والتحليل الإعرابي والبياني</p>
        </div>
        <div style="font-family: 'Almarai', sans-serif; text-align: justify;">${formattedText}</div>
        <div style="margin-top: 40px; font-size: 10pt; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 12px; display: flex; justify-content: space-between;">
          <span>تم الاستخراج بواسطة منظومة "لسـان" اللغوية</span>
          <span>${new Date().toLocaleDateString('ar-EG')}</span>
        </div>
      `;
      
      const opt = {
        margin: 12,
        filename: `lisan-report-${Date.now()}.pdf`,
        image: { type: 'jpeg' as const, quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, letterRendering: true },
        jsPDF: { unit: 'mm' as const, format: 'a4' as const, orientation: 'portrait' as const }
      };

      try {
        await html2pdf().set(opt).from(element).save();
      } catch (err) {
        console.error("PDF export error", err);
        alert("فشل تصدير ملف PDF. يرجى المحاولة مرة أخرى.");
      }
    } else if (format === FileFormat.DOCX) {
      try {
        const doc = new Document({
          sections: [{
            properties: {},
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                bidirectional: true,
                children: [
                  new TextRun({
                    text: "لسـان الذكاء العربي - تقرير البحث اللغوي",
                    bold: true,
                    size: 32,
                    color: "B45309",
                  }),
                ],
              }),
              new Paragraph({ text: "" }),
              ...text.split('\n').map(line => 
                new Paragraph({
                  alignment: AlignmentType.RIGHT,
                  bidirectional: true,
                  children: [
                    new TextRun({
                      text: line,
                      size: 24,
                    }),
                  ],
                })
              ),
              new Paragraph({ text: "" }),
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                bidirectional: true,
                children: [
                  new TextRun({
                    text: "تم التوليد بواسطة لسان - منظومة الذكاء الاصطناعي اللغوي للغة الضاد",
                    size: 18,
                    italics: true,
                    color: "64748B",
                  }),
                ],
              }),
            ],
          }],
        });

        const blob = await Packer.toBlob(doc);
        saveAs(blob, `lisan-report-${Date.now()}.docx`);
      } catch (err) {
        console.error("DOCX export error", err);
        alert("فشل تصدير ملف Word. يرجى المحاولة مرة أخرى.");
      }
    } else {
      const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
      saveAs(blob, `lisan-report-${Date.now()}.txt`);
    }
  };

  return (
    <div className="flex flex-col h-full p-4 md:p-8 max-w-6xl mx-auto overflow-hidden">
      {/* Header */}
      <div className="mb-4 border-b border-white/10 pb-4 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-2">
        <div>
          <h2 className="text-3xl font-calligraphy text-amber-400 mb-1 flex items-center gap-3">
            <Search className="w-8 h-8 text-amber-400" />
            الباحث اللغوي والمعجمي الخبير
          </h2>
          <p className="text-slate-400 font-light font-sans text-sm md:text-base">
            تحليل الإعراب، البلاغة، الصرف، وفقه اللغة، مع دعم قراءة وتلخيص مستندات PDF وDOCX.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {onOpenDictionary && (
            <button
              onClick={onOpenDictionary}
              className="flex items-center gap-1.5 text-xs text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 px-3 py-1.5 rounded-full border border-amber-500/30 transition-all font-medium"
              title="فتح قاموس المصطلحات النحوية والبلاغية"
            >
              <BookOpen className="w-3.5 h-3.5 text-amber-400" />
              <span>قاموس المصطلحات</span>
            </button>
          )}
          <div className="flex items-center gap-2 text-xs text-amber-400 bg-amber-500/10 px-3 py-1.5 rounded-full border border-amber-500/20">
            <Sparkles className="w-3.5 h-3.5 animate-pulse" />
            <span>بروتوكول لسان للبيان الفصيح</span>
          </div>
        </div>
      </div>

      {/* Chat / Analysis History */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-5 mb-4 pr-1 pl-1">
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
                  className="text-right text-xs bg-slate-900/60 hover:bg-slate-800 text-slate-300 hover:text-amber-300 p-3 rounded-xl border border-white/5 transition-all text-ellipsis overflow-hidden"
                >
                  <span className="text-amber-400 font-bold ml-1.5">✦</span>
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

              <div className="font-sans text-base md:text-lg leading-relaxed whitespace-pre-wrap selection:bg-amber-500/30">
                {msg.content}
              </div>
              
              {msg.role === 'model' && (
                <div className="mt-4 pt-3 border-t border-white/10 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-1.5">
                    <button 
                      onClick={() => handleCopy(msg.id, msg.content)}
                      className="flex items-center gap-1 bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded-lg border border-slate-700 transition-colors"
                    >
                      {copiedId === msg.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedId === msg.id ? 'تم النسخ' : 'نسخ التحليل'}</span>
                    </button>

                    {onNavigateToTashkeel && (
                      <button 
                        onClick={() => {
                          sessionStorage.setItem('lisan_tts_input', msg.content);
                          onNavigateToTashkeel();
                        }}
                        className="flex items-center gap-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 px-3 py-1.5 rounded-lg border border-amber-500/30 transition-colors"
                        title="الانتقال إلى المشكّل لتشكيل النص"
                      >
                        <Wand2 className="w-3.5 h-3.5" />
                        <span>تشكيل النص</span>
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] text-slate-400">تصدير التقرير:</span>
                    <button 
                      onClick={() => downloadContent(msg.content, FileFormat.DOCX)} 
                      className="flex items-center gap-1 bg-blue-600/20 hover:bg-blue-600/30 text-blue-200 border border-blue-500/40 px-2.5 py-1 rounded-lg transition-colors font-medium"
                    >
                      <FileText className="w-3 h-3" />
                      <span>DOCX</span>
                    </button>
                    <button 
                      onClick={() => downloadContent(msg.content, FileFormat.PDF)} 
                      className="flex items-center gap-1 bg-red-600/20 hover:bg-red-600/30 text-red-200 border border-red-500/40 px-2.5 py-1 rounded-lg transition-colors font-medium"
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
        
        {loading && (
          <div className="flex justify-end">
            <div className="bg-slate-900/90 p-4 rounded-2xl rounded-bl-none border border-amber-500/30 flex items-center gap-3">
              <div className="w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm text-amber-300 font-sans">الباحث يستقرئ المعاجم ويستنبط الإعراب...</span>
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
              className="text-slate-400 hover:text-red-400 p-1 transition-colors"
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
              className={`p-3 rounded-xl transition-all ${
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
            className="bg-amber-500 hover:bg-amber-400 text-slate-950 p-3 rounded-xl transition-all shadow-lg shadow-amber-500/20 disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
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
