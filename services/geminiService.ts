import { TashkeelMode } from '../types';

export interface TashkeelResult {
  text: string;
  warning?: string;
  baseMismatch?: boolean;
}

export const GeminiService = {
  /**
   * General Deep Search & Linguistics Analysis with Server-Sent Events (SSE) Streaming
   * Calls server-side /api/gemini/deep-search
   */
  async deepSearch(
    query: string,
    context: string = '',
    fileData?: { mimeType: string; data: string },
    onChunk?: (streamedText: string, token: string) => void
  ): Promise<string> {
    const response = await fetch('/api/gemini/deep-search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query, context, fileData }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || `Server returned error status ${response.status}`);
    }

    if (!response.body) {
      throw new Error('لم يتم استلام تدفق بيانات من الخادم.');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let accumulatedText = '';
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const blocks = buffer.split('\n\n');
      buffer = blocks.pop() || '';

      for (const block of blocks) {
        if (!block.trim()) continue;

        const eventMatch = block.match(/^event:\s*(\w+)/m);
        const dataMatch = block.match(/^data:\s*(.+)$/m);
        const eventType = eventMatch ? eventMatch[1] : 'token';

        if (dataMatch) {
          try {
            const data = JSON.parse(dataMatch[1]);
            if (eventType === 'error' || data.error) {
              throw new Error(data.error || 'حدث خطأ أثناء استقبال الإجابة.');
            }

            if (eventType === 'token' && data.token) {
              accumulatedText += data.token;
              onChunk?.(accumulatedText, data.token);
            } else if (eventType === 'done') {
              if (data.fullText) {
                accumulatedText = data.fullText;
                onChunk?.(accumulatedText, '');
              }
            }
          } catch (err: any) {
            if (err?.message && !err.message.includes('JSON')) {
              throw err;
            }
          }
        }
      }
    }

    return accumulatedText || 'عذراً، لم أتمكن من استخراج إجابة دقيقة.';
  },

  /**
   * Precise Tashkeel & Linguistic Proofreading
   * Calls server-side /api/gemini/tashkeel
   */
  async addDiacritics(text: string, mode: TashkeelMode = 'full'): Promise<TashkeelResult> {
    const response = await fetch('/api/gemini/tashkeel', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text, mode }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || `Server returned error status ${response.status}`);
    }

    const data = await response.json();
    return {
      text: data.text || '',
      warning: data.warning,
      baseMismatch: data.baseMismatch,
    };
  },

  /**
   * Arabic Calligraphy & Islamic Art Generation
   * Calls server-side /api/gemini/art
   */
  async generateArt(
    prompt: string,
    style: 'calligraphy' | 'manuscript' | 'modern' = 'calligraphy',
    scriptType: string = 'خط الثلث',
    atmosphere: string = 'royal-gold'
  ): Promise<string> {
    const response = await fetch('/api/gemini/art', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prompt, style, scriptType, atmosphere }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || `Server returned error status ${response.status}`);
    }

    const data = await response.json();
    if (!data.image) {
      throw new Error('No image data returned from server');
    }
    return data.image;
  },

  /**
   * Text to Speech (Distinct Arabic Voices)
   * Calls server-side /api/gemini/speech
   */
  async generateSpeech(
    text: string,
    voiceName: string = 'Zephyr',
    styleInstruction?: string,
    enforcedGender?: 'male' | 'female'
  ): Promise<{ buffer: ArrayBuffer; mimeType: string }> {
    const response = await fetch('/api/gemini/speech', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text, voiceName, styleInstruction, enforcedGender }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || `Server returned error status ${response.status}`);
    }

    const data = await response.json();
    if (!data.base64Audio) {
      throw new Error('No audio data received from server');
    }

    const binaryString = atob(data.base64Audio);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    return {
      buffer: bytes.buffer,
      mimeType: data.mimeType || 'audio/wav',
    };
  },
};
