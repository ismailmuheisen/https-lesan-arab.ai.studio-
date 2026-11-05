import express from 'express';
import type { Request, Response } from 'express';
import path from 'path';
import { GoogleGenAI, Modality } from '@google/genai';

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// Generous payload limits for attached document files and audio/image payloads
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

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

/**
 * 1. Deep Search & Arabic Linguistics Analysis
 */
app.post('/api/gemini/deep-search', async (req: Request, res: Response): Promise<void> => {
  try {
    const { query, context = '', fileData } = req.body;
    if (!query && !fileData) {
      res.status(400).json({ error: 'Query or fileData is required' });
      return;
    }

    const ai = getAI();
    const systemInstruction = `
      أنت "لسـان"، المحرك اللغوي الذكي المتقدم في خدمة لغة الضاد، المستند إلى أدق معايير التدقيق اللغوي والبيان الفصيح (بروتوكول نانوبنانا اللغوي 2.0).
      مهمتك:
      1. تقديم تحليلات إعرابية وصرفية وبلاغية مفصلة ودقيقة.
      2. شرح الشواهد الشعرية، معاني مفردات المعاجم القديمة (لسان العرب، القاموس المحيط، تاج العروس).
      3. التدقيق الصارم: التمييز القاطع بين همزات الوصل والقطع، التاء المربوطة والهاء، الياء والألف المقصورة.
      4. عند تحليل ملف مرفق، لخصه بعناية واستخرج درره اللغوية، الأخطاء الشائعة، وقدم مقترحات صياغة رفيعة.
      5. نسّق إجابتك بعناوين واضحة، ونقاط مرتبة، واستشهد بالشعر والقرآن الكريم إن اقتضى السياق. أسلوبك رصين ومحبب.
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

    const candidateModels = [
      'gemini-3.8-flash',
      'gemini-3.1-pro-preview',
      'gemini-3.1-flash-lite',
      'gemini-flash-latest',
    ];
    let lastError: any = null;

    for (const modelId of candidateModels) {
      try {
        const response = await ai.models.generateContent({
          model: modelId,
          contents: [{ role: 'user', parts }],
          config: {
            systemInstruction,
          },
        });

        res.json({ text: response.text || 'عذراً، لم أتمكن من استخراج إجابة دقيقة.' });
        return;
      } catch (err: any) {
        lastError = err;
        console.warn(`[server] Model ${modelId} failed for deepSearch:`, err?.message || err);
      }
    }

    res.status(500).json({ error: lastError?.message || 'Failed to generate deep search response' });
  } catch (error: any) {
    console.error('[server] Error in deep-search:', error);
    res.status(500).json({ error: error?.message || 'Internal server error' });
  }
});

/**
 * 2. Tashkeel (Diacritization) & Proofreading
 */
app.post('/api/gemini/tashkeel', async (req: Request, res: Response): Promise<void> => {
  try {
    const { text, mode = 'full' } = req.body;
    if (!text) {
      res.status(400).json({ error: 'Text is required' });
      return;
    }

    const ai = getAI();
    let promptInstruction = '';
    if (mode === 'ending') {
      promptInstruction = `اضبط أواخر الكلمات فقط في النص التالي ضبطاً إعرابياً دقيقاً، مع ترك الحروف الداخلية غير المشكلة إلا إذا كانت ضرورية لمنع اللبس. أعد النص فقط دون أي مقدمات أو شروحات.`;
    } else if (mode === 'proofread') {
      promptInstruction = `قم بتدقيق النص العربي التالي لغوياً ونحوياً وصرفياً وإملائياً مع ضبط حركاته، ثم اذكر أسفله في قسم موجز "ملاحظات التدقيق" أهم الأخطاء التي تم تصويبها إن وُجدت.`;
    } else {
      promptInstruction = `مهمتك هي تشكيل النص التالي تشكيلاً كاملاً ودقيقاً (بنية صرفية وإعراباً لأواخر الكلمات) بنسبة دقة 100% وفق بروتوكول نانوبنانا 2 اللغوي. التزم بالقواعد النحوية السليمة. أعد النص المشكول فقط دون أي زيادات أو شروحات.`;
    }

    const prompt = `${promptInstruction}\n\nالنص:\n${text}`;
    const candidateModels = [
      'gemini-3.8-flash',
      'gemini-3.1-pro-preview',
      'gemini-3.1-flash-lite',
      'gemini-flash-latest',
    ];
    let lastError: any = null;

    for (const modelId of candidateModels) {
      try {
        const response = await ai.models.generateContent({
          model: modelId,
          contents: prompt,
        });

        if (response.text) {
          res.json({ text: response.text });
          return;
        }
      } catch (err: any) {
        lastError = err;
        console.warn(`[server] Model ${modelId} failed for tashkeel:`, err?.message || err);
      }
    }

    res.status(500).json({ error: lastError?.message || 'Failed to process tashkeel' });
  } catch (error: any) {
    console.error('[server] Error in tashkeel:', error);
    res.status(500).json({ error: error?.message || 'Internal server error' });
  }
});

/**
 * 3. Arabic Calligraphy & Islamic Art Generation
 */
app.post('/api/gemini/art', async (req: Request, res: Response): Promise<void> => {
  try {
    const { prompt, style = 'calligraphy', scriptType = 'خط الثلث', atmosphere = 'royal-gold' } = req.body;
    if (!prompt) {
      res.status(400).json({ error: 'Prompt is required' });
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

    const candidateImageModels = [
      'gemini-3.1-flash-lite-image',
      'gemini-nano-banana-2.1',
      'gemini-3-pro-image',
    ];
    let lastError: any = null;

    for (const modelId of candidateImageModels) {
      try {
        const response = await ai.models.generateContent({
          model: modelId,
          contents: { parts: [{ text: enhancedPrompt }] },
        });

        for (const candidate of response.candidates || []) {
          for (const part of candidate.content.parts) {
            if (part.inlineData && part.inlineData.mimeType.startsWith('image')) {
              res.json({ image: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}` });
              return;
            }
          }
        }
      } catch (err: any) {
        lastError = err;
        console.warn(`[server] Image model ${modelId} failed:`, err?.message || err);
      }
    }

    res.status(500).json({ error: lastError?.message || 'No image data returned from model' });
  } catch (error: any) {
    console.error('[server] Error in art generation:', error);
    res.status(500).json({ error: error?.message || 'Internal server error' });
  }
});

/**
 * 4. Text to Speech (TTS)
 */
app.post('/api/gemini/speech', async (req: Request, res: Response): Promise<void> => {
  try {
    const { text, voiceName = 'Zephyr', styleInstruction, enforcedGender } = req.body;
    if (!text) {
      res.status(400).json({ error: 'Text is required' });
      return;
    }

    const ai = getAI();
    const MALE_VOICES = ['Fenrir', 'Charon', 'Puck'];
    const FEMALE_VOICES = ['Kore', 'Zephyr'];

    const VOICE_MAP: Record<string, { voice: string; gender: 'male' | 'female' }> = {
      // 7 Male Voices
      Fenrir: { voice: 'Fenrir', gender: 'male' },
      Puck: { voice: 'Puck', gender: 'male' },
      Charon: { voice: 'Charon', gender: 'male' },
      Orus: { voice: 'Charon', gender: 'male' },
      Umbriel: { voice: 'Fenrir', gender: 'male' },
      Enceladus: { voice: 'Puck', gender: 'male' },
      Achird: { voice: 'Charon', gender: 'male' },

      // 8 Female Voices
      Zephyr: { voice: 'Zephyr', gender: 'female' },
      Kore: { voice: 'Kore', gender: 'female' },
      Aoede: { voice: 'Kore', gender: 'female' },
      Autonoe: { voice: 'Zephyr', gender: 'female' },
      Erinome: { voice: 'Kore', gender: 'female' },
      Callirrhoe: { voice: 'Zephyr', gender: 'female' },
      Schedar: { voice: 'Kore', gender: 'female' },
      Laomedeia: { voice: 'Zephyr', gender: 'female' },
    };

    const entry = VOICE_MAP[voiceName];
    const targetGender: 'male' | 'female' = enforcedGender || (entry ? entry.gender : 'female');

    let effectiveVoice: string;
    if (targetGender === 'male') {
      if (entry && entry.gender === 'male' && MALE_VOICES.includes(entry.voice)) {
        effectiveVoice = entry.voice;
      } else if (MALE_VOICES.includes(voiceName)) {
        effectiveVoice = voiceName;
      } else {
        effectiveVoice = 'Charon';
      }
    } else {
      if (entry && entry.gender === 'female' && FEMALE_VOICES.includes(entry.voice)) {
        effectiveVoice = entry.voice;
      } else if (FEMALE_VOICES.includes(voiceName)) {
        effectiveVoice = voiceName;
      } else {
        effectiveVoice = 'Zephyr';
      }
    }

    const genderInstruction = targetGender === 'male'
      ? 'Read clearly in an authentic masculine Arabic male reciter voice (صوت قارئ رجل فصيح).'
      : 'Read clearly in an authentic feminine Arabic female reciter voice (صوت قارئة أنثى فصيحة).';

    const combinedStyle = styleInstruction && styleInstruction.trim() !== ''
      ? `${genderInstruction} Style: ${styleInstruction}`
      : genderInstruction;

    const speechContent = `Say in Arabic (${combinedStyle}): ${text}`;

    const candidateModels = [
      'gemini-3.8-flash-lite-tts',
      'gemini-3.8-flash-tts',
    ];

    const attempts = [
      speechContent,
      `${targetGender === 'male' ? 'صوت رجل: ' : 'صوت امرأة: '}${text}`,
      text,
    ];

    let lastError: any = null;

    for (const modelId of candidateModels) {
      for (const contentPrompt of attempts) {
        try {
          const response = await ai.models.generateContent({
            model: modelId,
            contents: [{ parts: [{ text: contentPrompt }] }],
            config: {
              responseModalities: [Modality.AUDIO],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: { voiceName: effectiveVoice },
                },
              },
            },
          });

          const audioPart = response.candidates?.[0]?.content?.parts?.[0]?.inlineData;
          const base64Audio = audioPart?.data;
          const mimeType = audioPart?.mimeType || 'audio/pcm;rate=24000';

          if (base64Audio) {
            res.json({ base64Audio, mimeType });
            return;
          }
        } catch (err: any) {
          lastError = err;
          console.warn(`[server] TTS attempt with ${modelId} failed:`, err?.message || err);
          if (err?.status === 404 || err?.message?.includes('not found')) {
            break;
          }
        }
      }
    }

    res.status(500).json({ error: lastError?.message || 'Failed to generate speech audio' });
  } catch (error: any) {
    console.error('[server] Error in speech generation:', error);
    res.status(500).json({ error: error?.message || 'Internal server error' });
  }
});

async function startServer() {
  // Health check endpoint for Cloud Run
  app.get('/healthz', (_req: Request, res: Response) => {
    res.status(200).send('OK');
  });

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
