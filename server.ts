import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import path from 'path';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { GoogleGenAI, Modality } from '@google/genai';
import {
  initializeAndVerifyModels,
  getCandidateModels,
  withAttemptTimeout,
  recordModel404,
} from './models.config';
import { splitIntoSentenceChunks, areBaseLettersEqual } from './utils/textUtils';
import { verifyQuranicVersesInText } from './quranVerification';

export class ForbiddenError extends Error {
  public rule: string;
  public details: string;
  constructor(rule: string, details: string) {
    super(`FORBIDDEN: ${rule}`);
    this.name = 'ForbiddenError';
    this.rule = rule;
    this.details = details;
  }
}

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// (3) Helmet security headers with CSP disabled in all environments to allow Vite & fonts/scripts
app.use(
  helmet({
    contentSecurityPolicy: false, // CSP explicitly disabled to prevent blocking Vite or scripts
    frameguard: false, // Required for AI Studio iframe preview environment
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

// Helper to determine if an incoming request is same-origin
function isSameOrigin(origin: string, req: Request): boolean {
  try {
    const originUrl = new URL(origin);
    const hostHeader = (req.headers['x-forwarded-host'] as string) || req.headers.host || '';
    const hosts = hostHeader.split(',').map((h) => h.trim().toLowerCase());
    const originHost = originUrl.host.toLowerCase();
    const originHostname = originUrl.hostname.toLowerCase();

    return hosts.some((h) => h === originHost || h.split(':')[0] === originHostname);
  } catch {
    return false;
  }
}

// Allowed origins whitelist from environment variable
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean)
  : [];

// (1) Dynamic CORS delegate scoped ONLY to /api/* routes
const apiCorsDelegate = (req: Request, callback: (err: Error | null, options?: cors.CorsOptions) => void) => {
  const origin = req.headers.origin as string | undefined;
  const host = (req.headers['x-forwarded-host'] as string) || req.headers.host || 'unknown';

  // (3) In non-production, everything is allowed
  if (process.env.NODE_ENV !== 'production') {
    return callback(null, {
      origin: true,
      credentials: true,
      methods: ['GET', 'POST', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    });
  }

  // (2) Requests with no Origin header are always allowed (same-origin, curl, server-to-server)
  if (!origin) {
    return callback(null, {
      origin: true,
      credentials: true,
      methods: ['GET', 'POST', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    });
  }

  // (2) Same-origin requests are always allowed
  if (isSameOrigin(origin, req)) {
    return callback(null, {
      origin: true,
      credentials: true,
      methods: ['GET', 'POST', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    });
  }

  // If explicit allowedOrigins are configured, check against them
  if (allowedOrigins.length > 0) {
    if (allowedOrigins.includes(origin)) {
      return callback(null, {
        origin: true,
        credentials: true,
        methods: ['GET', 'POST', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization'],
      });
    }

    // (4) Rejection: Log details and supply specific rule
    console.warn(`[server 403] CORS_ORIGIN_NOT_ALLOWED: origin '${origin}' rejected for host '${host}' on path '${req.originalUrl || req.path}'`);

    const forbiddenErr = new ForbiddenError(
      'CORS_ORIGIN_NOT_ALLOWED',
      `Origin '${origin}' is not permitted by CORS policy.`
    );
    return callback(forbiddenErr, { origin: false });
  }

  // Default: allow
  return callback(null, {
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });
};

// (1) Apply CORS ONLY to /api/* routes, never to Vite middleware or static files
app.use('/api', cors(apiCorsDelegate));

// Rate limiters applied strictly to /api/gemini routes
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    error: 'تم تجاوز الحد المسموح من الطلبات اللغوية (20 طلباً في الدقيقة). يرجى الانتظار دقيقة والمحاولة ثانية.',
    code: 'RATE_LIMIT_EXCEEDED',
  },
});

const artLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    error: 'تم تجاوز الحد المسموح لتوليد اللوحات الفنية (5 طلبات في الدقيقة). يرجى التريث قليلاً والمحاولة مجدداً.',
    code: 'RATE_LIMIT_ART_EXCEEDED',
  },
});

const speechLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    error: 'تم تجاوز الحد المسموح لتوليد النطق الصوتي (10 طلبات في الدقيقة). يرجى التريث قليلاً والمحاولة مجدداً.',
    code: 'RATE_LIMIT_SPEECH_EXCEEDED',
  },
});

app.use('/api/gemini', apiLimiter);

// Per-Route JSON Payload Limits
const json15mb = express.json({ limit: '15mb' });
const json100kb = express.json({ limit: '100kb' });

// Allowed MIME types for uploaded files in Deep Search
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'text/plain',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
]);

// Helper to get fresh GoogleGenAI instance with telemetry headers
const getAI = () => {
  const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY || '';
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
};

// Safety check helper
interface SafetyCheckResult {
  blocked: boolean;
  reason?: string;
}

function checkSafetyBlock(response: any): SafetyCheckResult {
  if (response?.promptFeedback?.blockReason) {
    return { blocked: true, reason: String(response.promptFeedback.blockReason) };
  }

  const candidate = response?.candidates?.[0];
  if (candidate?.finishReason) {
    const blockedReasons = ['SAFETY', 'BLOCKLIST', 'PROHIBITED_CONTENT', 'RECITATION'];
    if (blockedReasons.includes(candidate.finishReason)) {
      return { blocked: true, reason: candidate.finishReason };
    }
  }

  return { blocked: false };
}

/**
 * 1. Deep Search & Arabic Linguistics Analysis
 */
app.post('/api/gemini/deep-search', json15mb, async (req: Request, res: Response): Promise<void> => {
  try {
    let { query, context = '', fileData } = req.body || {};

    if (typeof query === 'string') {
      query = query.trim();
    } else {
      query = '';
    }

    if (!query && !fileData) {
      res.status(400).json({
        error: 'يرجى تقديم استفسار أو إرفاق ملف لبدء التحليل اللغوي.',
        code: 'MISSING_QUERY_OR_FILE',
      });
      return;
    }

    if (query.length > 8000) {
      res.status(400).json({
        error: 'طول السؤال يتجاوز الحد الأقصى المسموح به (8000 حرف). يرجى تقليص السؤال.',
        code: 'QUERY_TOO_LONG',
      });
      return;
    }

    if (typeof context === 'string') {
      if (context.length > 20000) {
        context = context.slice(-20000);
      }
    } else {
      context = '';
    }

    if (fileData) {
      if (
        !fileData.mimeType ||
        typeof fileData.mimeType !== 'string' ||
        !ALLOWED_MIME_TYPES.has(fileData.mimeType.toLowerCase())
      ) {
        res.status(400).json({
          error: 'نوع الملف غير مدعوم. الصيغ المدعومة هي: PDF، PNG، JPEG، TXT، DOCX فقط.',
          code: 'INVALID_FILE_TYPE',
        });
        return;
      }
      if (!fileData.data || typeof fileData.data !== 'string') {
        res.status(400).json({
          error: 'بيانات الملف المرفق غير صالحة أو غير مقروءة.',
          code: 'INVALID_FILE_DATA',
        });
        return;
      }
    }

    // Set up Server-Sent Events (SSE)
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const sendEvent = (event: string, payload: any) => {
      res.write(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`);
    };

    const ai = getAI();
    const systemInstruction = `
أنت "لسـان"، المحرك اللغوي الذكي المتقدم في خدمة لغة الضاد وعلوم اللسان العربي.
مهمتك:
1. تقديم تحليلات إعرابية وصرفية وبلاغية مفصلة ودقيقة مستندة لأصول علم النحو وفقه اللغة.
2. شرح الشواهد الشعرية، ومعاني المفردات من أمهات المعاجم المعتمدة (لسان العرب، القاموس المحيط، تاج العروس، معجم الصحاح).
3. الالتزام الصارم بالأمانة العلمية: يُمنع منعاً باتاً اختلاق أو فبركة الشواهد الشعرية، أو عزو الآيات القرآنية لغير مواضعها، أو تأليف نصوص معجمية غير موثقة. إذا لم تكن متأكداً تماماً من صحة شاهد أو نسبة قول أو جذر لفظ، صرّح بذلك بوضوح وبكل أمانة.
4. التدقيق الصارم: التمييز القاطع بين همزات الوصل والقطع، التاء المربوطة والهاء، الياء والألف المقصورة.
5. عند تحليل ملف مرفق، لخصه بعناية واستخرج درره اللغوية، الأخطاء الشائعة، وقدم مقترحات صياغة رفيعة.
6. نسّق إجابتك بعناوين واضحة، ونقاط مرتبة، واستشهد بالشعر والقرآن الكريم عند الاقتضاء بصورة موثقة.
7. في نهاية كل إجابة أو تحليل، اختم بسطر مستقل يحدد مستوى الثقة العلمية بصيغة واضحة:
[مستوى الثقة: عالية] أو [مستوى الثقة: متوسطة - مع ذكر السبب] أو [مستوى الثقة: منخفضة - مع ذكر السبب].
`;

    const parts: any[] = [{ text: context ? `السياق السابق:\n${context}\n\nالسؤال الحالي:\n${query}` : query }];

    if (fileData) {
      parts.unshift({
        inlineData: {
          mimeType: fileData.mimeType,
          data: fileData.data,
        },
      });
    }

    const candidateModels = getCandidateModels('deepSearch', 3);
    let lastError: any = null;

    for (const modelId of candidateModels) {
      try {
        const streamPromise = ai.models.generateContentStream({
          model: modelId,
          contents: [{ role: 'user', parts }],
          config: {
            systemInstruction,
          },
        });

        const stream = await withAttemptTimeout(streamPromise, 30000);

        let fullAccumulatedText = '';
        let isFirst = true;
        let isBlocked = false;

        for await (const chunk of stream) {
          if (isFirst) {
            const safety = checkSafetyBlock(chunk);
            if (safety.blocked) {
              isBlocked = true;
              sendEvent('error', {
                error: 'تعذر إتمام البحث لمخالفته معايير الأمان وسلامة المحتوى.',
                code: 'CONTENT_SAFETY_BLOCKED',
              });
              break;
            }
            isFirst = false;
          }

          const token = chunk.text || '';
          if (token) {
            fullAccumulatedText += token;
            sendEvent('token', { token });
          }
        }

        if (isBlocked) {
          res.end();
          return;
        }

        if (!fullAccumulatedText) {
          console.warn(`[server] Model ${modelId} returned no tokens, trying next model.`);
          continue;
        }

        // Verify Quranic verses against api.alquran.cloud (Uthmani edition)
        const verifiedFullText = await verifyQuranicVersesInText(fullAccumulatedText);

        sendEvent('done', {
          fullText: verifiedFullText,
          verified: verifiedFullText !== fullAccumulatedText,
        });

        res.end();
        return;
      } catch (err: any) {
        lastError = err;
        if (err?.status === 404 || err?.message?.includes('404') || err?.message?.toLowerCase().includes('not found')) {
          recordModel404(modelId);
        }
        console.warn(`[server] Model ${modelId} failed for deepSearch:`, err?.message || err);
      }
    }

    console.error('[server] All candidate models failed in deep-search:', lastError);
    sendEvent('error', {
      error: 'تعذر الحصول على استجابة من محرك البحث اللغوي حالياً. يرجى المحاولة لاحقاً.',
      code: 'AI_SERVICE_UNAVAILABLE',
    });
    res.end();
  } catch (error: any) {
    console.error('[server] Error in deep-search endpoint:', error);
    if (!res.headersSent) {
      res.status(500).json({
        error: 'حدث خطأ في الخادم أثناء معالجة استفسارك.',
        code: 'INTERNAL_SERVER_ERROR',
      });
    } else {
      res.write(`event: error\ndata: ${JSON.stringify({ error: 'حدث خطأ غير متوقع.', code: 'INTERNAL_SERVER_ERROR' })}\n\n`);
      res.end();
    }
  }
});

/**
 * 2. Tashkeel (Diacritization) & Proofreading
 */
app.post('/api/gemini/tashkeel', json100kb, async (req: Request, res: Response): Promise<void> => {
  try {
    let { text, mode = 'full' } = req.body || {};

    if (typeof text !== 'string' || !text.trim()) {
      res.status(400).json({
        error: 'يرجى إدخال النص المطلوب تشكيله أو تدقيقه.',
        code: 'MISSING_TEXT',
      });
      return;
    }

    text = text.trim();
    if (text.length > 8000) {
      res.status(400).json({
        error: 'طول النص المطلوب تشكيله يتجاوز الحد الأقصى المسموح به (8000 حرف).',
        code: 'TEXT_TOO_LONG',
      });
      return;
    }

    const ai = getAI();
    let promptInstruction = '';
    if (mode === 'ending') {
      promptInstruction = `اضبط أواخر الكلمات فقط في النص التالي ضبطاً إعرابياً دقيقاً، مع ترك الحروف الداخلية غير المشكلة إلا إذا كانت ضرورية لمنع اللبس. التزم بالقواعد النحوية السليمة وحافظ على الحروف الأصلية دون تغيير. أعد النص فقط دون أي مقدمات أو شروحات.`;
    } else if (mode === 'proofread') {
      promptInstruction = `قم بتدقيق النص العربي التالي لغوياً ونحوياً وصرفياً وإملائياً مع ضبط حركاته، ثم اذكر أسفله في قسم موجز "ملاحظات التدقيق" أهم الأخطاء التي تم تصويبها إن وُجدت.`;
    } else {
      promptInstruction = `مهمتك هي تشكيل النص التالي تشكيلاً كاملاً ودقيقاً (بنية صرفية وإعراباً لأواخر الكلمات) وفق القواعد النحوية والصرفية السليمة. التزم بالحروف الأصلية للنص بدقة تامة دون حذف أو تبديل أو زيادة. أعد النص المشكول فقط دون أي زيادات أو شروحات.`;
    }

    const chunks = splitIntoSentenceChunks(text, 1500);
    const candidateModels = getCandidateModels('tashkeel', 3);

    const generateChunkDiacritics = async (chunkText: string, retryNotice = false): Promise<string> => {
      let chunkPrompt = `${promptInstruction}\n\nالنص:\n${chunkText}`;
      if (retryNotice) {
        chunkPrompt += `\n\nتنبيه مهم: يرجى المحافظة الدقيقة على الحروف والكلمات الأصلية كما هي دون حذف أو تعديل أو إضافة أي كلمة، واقتصر على وضع حركات التشكيل.`;
      }

      let lastChunkErr: any = null;

      for (const modelId of candidateModels) {
        try {
          const genPromise = ai.models.generateContent({
            model: modelId,
            contents: chunkPrompt,
            config: {
              temperature: 0.2,
            },
          });

          const response = await withAttemptTimeout(genPromise, 30000);

          const safety = checkSafetyBlock(response);
          if (safety.blocked) {
            throw new Error('CONTENT_SAFETY_BLOCKED');
          }

          if (response.text) {
            return response.text.trim();
          }
        } catch (err: any) {
          lastChunkErr = err;
          if (err?.status === 404 || err?.message?.includes('404') || err?.message?.toLowerCase().includes('not found')) {
            recordModel404(modelId);
          }
          console.warn(`[server] Model ${modelId} failed for tashkeel chunk:`, err?.message || err);
        }
      }

      throw lastChunkErr || new Error('FAILED_ALL_MODELS');
    };

    const processedChunks: string[] = [];
    let hasBaseMismatch = false;

    for (const chunk of chunks) {
      let outputChunk = await generateChunkDiacritics(chunk, false);

      if (mode !== 'proofread') {
        if (!areBaseLettersEqual(chunk, outputChunk)) {
          console.warn('[server] Base letters mismatch detected in diacritized chunk. Retrying once...');
          try {
            const retried = await generateChunkDiacritics(chunk, true);
            if (areBaseLettersEqual(chunk, retried)) {
              outputChunk = retried;
            } else {
              hasBaseMismatch = true;
              outputChunk = retried;
            }
          } catch (retryErr) {
            hasBaseMismatch = true;
          }
        }
      }

      processedChunks.push(outputChunk);
    }

    const finalResultText = processedChunks.join('\n');

    res.json({
      text: finalResultText,
      warning: hasBaseMismatch
        ? 'تنبيه: قد يحتوي النص المشكول على اختلاف طفيف في بعض الحروف مقارنة بالأصل.'
        : undefined,
      baseMismatch: hasBaseMismatch,
    });
  } catch (error: any) {
    console.error('[server] Error in tashkeel:', error);
    if (error?.message === 'CONTENT_SAFETY_BLOCKED') {
      res.status(422).json({
        error: 'تعذر تشكيل النص لمخالفته معايير الأمان وسلامة المحتوى.',
        code: 'CONTENT_SAFETY_BLOCKED',
      });
      return;
    }
    res.status(500).json({
      error: 'حدث خطأ في الخادم أثناء معالجة تشكيل النص.',
      code: 'INTERNAL_SERVER_ERROR',
    });
  }
});

/**
 * 3. Arabic Calligraphy & Islamic Art Generation
 */
app.post('/api/gemini/art', artLimiter, json100kb, async (req: Request, res: Response): Promise<void> => {
  try {
    let { prompt, style = 'calligraphy', scriptType = 'خط الثلث', atmosphere = 'royal-gold' } = req.body || {};

    if (typeof prompt !== 'string' || !prompt.trim()) {
      res.status(400).json({
        error: 'يرجى إدخال وصف اللوحة أو النص المراد تخطيطه.',
        code: 'MISSING_PROMPT',
      });
      return;
    }

    prompt = prompt.trim();
    if (prompt.length > 300) {
      res.status(400).json({
        error: 'طول وصف اللوحة يتجاوز الحد الأقصى المسموح به (300 حرف).',
        code: 'PROMPT_TOO_LONG',
      });
      return;
    }

    const ai = getAI();
    let styleDesc = '';
    if (style === 'calligraphy') {
      styleDesc = `Masterpiece Arabic calligraphy artwork rendered in ${scriptType}. Traditional Islamic calligraphy with perfect proportion, curved flowing strokes, intricate diacritic marks (harakat and tashkeel), authentic reed pen ink texture on fine handmade archival paper.`;
    } else if (style === 'manuscript') {
      styleDesc = `Historic Islamic illuminated manuscript folio, medieval museum archive style. Features ornate gilded golden geometric rosettes, floral arabesque borders, ancient aged parchment with weathered patina, written in ${scriptType}.`;
    } else {
      styleDesc = `Contemporary Islamic digital art, combining 3D calligraphy in ${scriptType} with fluid architectural geometry, luminous lighting, dynamic floating Arabic glyphs, and subtle gold accents.`;
    }

    let atmosphereDesc = '';
    if (atmosphere === 'royal-gold') {
      atmosphereDesc = 'Rich royal lapis lazuli navy blue background, 24k gold leaf gilding, deep emerald accents, warm candlelight highlights.';
    } else if (atmosphere === 'parchment-manuscript') {
      atmosphereDesc = 'Warm sepia parchment tone, aged natural parchment texture, walnut ink with crimson rubrics, antique aesthetic.';
    } else {
      atmosphereDesc = 'Deep obsidian dark background, glowing warm amber and turquoise luminescence, clean modern contrast.';
    }

    const enhancedPrompt = `${styleDesc} ${atmosphereDesc} The central Arabic text clearly depicted is: "${prompt}". Museum-grade, ultra-detailed composition, pristine typography with no scrambled characters.`;

    const candidateImageModels = getCandidateModels('art', 3);
    let lastError: any = null;

    for (const modelId of candidateImageModels) {
      try {
        const artPromise = ai.models.generateContent({
          model: modelId,
          contents: { parts: [{ text: enhancedPrompt }] },
        });

        const response = await withAttemptTimeout(artPromise, 30000);

        const safety = checkSafetyBlock(response);
        if (safety.blocked) {
          console.warn(`[server] Art generation blocked by safety:`, safety.reason);
          res.status(422).json({
            error: 'تعذر توليد اللوحة الفنية لمخالفتها معايير الأمان وسلامة المحتوى.',
            code: 'CONTENT_SAFETY_BLOCKED',
          });
          return;
        }

        for (const candidate of response.candidates || []) {
          const parts = candidate.content?.parts ?? [];
          for (const part of parts) {
            if (part.inlineData && part.inlineData.mimeType?.startsWith('image')) {
              res.json({ image: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}` });
              return;
            }
          }
        }
      } catch (err: any) {
        lastError = err;
        if (err?.status === 404 || err?.message?.includes('404') || err?.message?.toLowerCase().includes('not found')) {
          recordModel404(modelId);
        }
        console.warn(`[server] Image model ${modelId} failed:`, err?.message || err);
      }
    }

    console.error('[server] All art models failed:', lastError);
    res.status(502).json({
      error: 'تعذر توليد اللوحة الفنية حالياً. يرجى إعادة المحاولة بنص أو أسلوب مختلف.',
      code: 'IMAGE_GENERATION_FAILED',
    });
  } catch (error: any) {
    console.error('[server] Error in art generation:', error);
    res.status(500).json({
      error: 'حدث خطأ في الخادم أثناء توليد اللوحة الفنية.',
      code: 'INTERNAL_SERVER_ERROR',
    });
  }
});

/**
 * 4. Text to Speech (TTS)
 */
app.post('/api/gemini/speech', speechLimiter, json100kb, async (req: Request, res: Response): Promise<void> => {
  try {
    let { text, voiceName = 'Zephyr', styleInstruction, enforcedGender } = req.body || {};

    if (typeof text !== 'string' || !text.trim()) {
      res.status(400).json({
        error: 'يرجى إدخال النص المطلوب تحويله إلى نطق صوتي.',
        code: 'MISSING_TEXT',
      });
      return;
    }

    text = text.trim();
    if (text.length > 8000) {
      res.status(400).json({
        error: 'طول النص الصوتي يتجاوز الحد الأقصى المسموح به (8000 حرف).',
        code: 'TEXT_TOO_LONG',
      });
      return;
    }

    const ai = getAI();
    const DISTINCT_MALE_VOICES = ['Fenrir', 'Charon', 'Puck'];
    const DISTINCT_FEMALE_VOICES = ['Zephyr', 'Kore'];

    let targetGender: 'male' | 'female' = enforcedGender || 'female';
    if (!enforcedGender) {
      if (DISTINCT_MALE_VOICES.includes(voiceName)) {
        targetGender = 'male';
      } else {
        targetGender = 'female';
      }
    }

    let effectiveVoice: string;
    if (targetGender === 'male') {
      effectiveVoice = DISTINCT_MALE_VOICES.includes(voiceName) ? voiceName : 'Fenrir';
    } else {
      effectiveVoice = DISTINCT_FEMALE_VOICES.includes(voiceName) ? voiceName : 'Zephyr';
    }

    const candidateModels = getCandidateModels('speech', 3);
    let lastError: any = null;

    const speechContents = [
      {
        role: 'user',
        parts: [
          {
            text,
            speechMetadata: styleInstruction && typeof styleInstruction === 'string' && styleInstruction.trim()
              ? { style: styleInstruction.trim() }
              : undefined,
          },
        ],
      },
    ];

    for (const modelId of candidateModels) {
      try {
        const ttsPromise = ai.models.generateContent({
          model: modelId,
          contents: speechContents,
          config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: effectiveVoice },
              },
            },
          },
        });

        const response = await withAttemptTimeout(ttsPromise, 30000);

        const safety = checkSafetyBlock(response);
        if (safety.blocked) {
          console.warn(`[server] Speech generation blocked by safety:`, safety.reason);
          res.status(422).json({
            error: 'تعذر توليد النطق الصوتي لمخالفته معايير الأمان وسلامة المحتوى.',
            code: 'CONTENT_SAFETY_BLOCKED',
          });
          return;
        }

        const candidate = response.candidates?.[0];
        const parts = candidate?.content?.parts ?? [];
        const audioPart = parts[0]?.inlineData;
        const base64Audio = audioPart?.data;
        const mimeType = audioPart?.mimeType || 'audio/wav';

        if (base64Audio) {
          res.json({ base64Audio, mimeType });
          return;
        }
      } catch (err: any) {
        lastError = err;
        if (err?.status === 404 || err?.message?.includes('404') || err?.message?.toLowerCase().includes('not found')) {
          recordModel404(modelId);
        }
        console.warn(`[server] TTS model ${modelId} failed:`, err?.message || err);
      }
    }

    console.error('[server] All models failed in speech generation:', lastError);
    res.status(502).json({
      error: 'تعذر توليد الصوت في الوقت الحالي. يرجى إعادة المحاولة لاحقاً.',
      code: 'SPEECH_GENERATION_FAILED',
    });
  } catch (error: any) {
    console.error('[server] Error in speech generation:', error);
    res.status(500).json({
      error: 'حدث خطأ في الخادم أثناء توليد الصوت.',
      code: 'INTERNAL_SERVER_ERROR',
    });
  }
});

// (4) Centralized API Error Handler: Logs origin/host and returns JSON body specifying the exact rule on 403
app.use('/api', (err: any, req: Request, res: Response, _next: NextFunction) => {
  const host = (req.headers['x-forwarded-host'] as string) || req.headers.host || 'unknown';
  const origin = (req.headers.origin as string) || 'none';

  if (
    err instanceof ForbiddenError ||
    err?.status === 403 ||
    err?.message === 'CORS_NOT_ALLOWED' ||
    err?.message?.startsWith('FORBIDDEN:')
  ) {
    const rule = err.rule || 'CORS_ORIGIN_CHECK';
    const details = err.details || err.message || 'Request was rejected by security policy.';

    console.warn(`[server 403] Security rule '${rule}' rejected request to '${req.originalUrl || req.path}' from origin: '${origin}', host: '${host}'`);

    res.status(403).json({
      error: 'غير مصرح بالوصول إلى هذا المسار وفقاً لسياسة الأمان.',
      code: 'FORBIDDEN',
      rule,
      details,
      origin,
      host,
    });
    return;
  }

  if (err?.type === 'entity.too.large' || err?.status === 413) {
    res.status(413).json({
      error: 'حجم البيانات المرسلة يتجاوز الحد المسموح به لهذا المسار.',
      code: 'PAYLOAD_TOO_LARGE',
    });
    return;
  }

  console.error('[server] API error:', err);
  res.status(500).json({
    error: 'حدث خطأ غير متوقع في خادم التطبيق.',
    code: 'INTERNAL_SERVER_ERROR',
  });
});

async function startServer() {
  // Health check endpoint for Cloud Run
  app.get('/healthz', (_req: Request, res: Response) => {
    res.status(200).send('OK');
  });

  // Call the models list API at startup and log available models
  try {
    const ai = getAI();
    await initializeAndVerifyModels(ai);
  } catch (initErr) {
    console.warn('[server] Model verification skipped during startup:', initErr);
  }

  // Mount Vite dev server or static file serving (NEVER subjected to API CORS/rate limits)
  if (process.env.NODE_ENV !== 'production') {
    try {
      const { createServer } = await import('vite');
      const vite = await createServer({
        server: { middlewareMode: true },
        appType: 'spa',
      });
      app.use(vite.middlewares);
    } catch (e) {
      console.warn('[server] Vite dev server failed to load, falling back to static files:', e);
      const distPath = path.resolve(process.cwd(), 'dist');
      app.use(express.static(distPath));
      app.use((_req: Request, res: Response) => {
        res.sendFile(path.resolve(distPath, 'index.html'));
      });
    }
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.use((_req: Request, res: Response) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[server] Lisan Al-Dhad backend running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[server] Failed to start server:', err);
  process.exit(1);
});
