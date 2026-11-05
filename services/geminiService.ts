import { TashkeelMode } from '../types';

export const GeminiService = {
  /**
   * General Deep Search & Linguistics Analysis
   * Calls server-side /api/gemini/deep-search
   */
  async deepSearch(query: string, context: string = '', fileData?: { mimeType: string; data: string }): Promise<string> {
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

    const data = await response.json();
    return data.text || 'عذراً، لم أتمكن من استخراج إجابة دقيقة.';
  },

  /**
   * Precise Tashkeel & Linguistic Proofreading
   * Calls server-side /api/gemini/tashkeel
   */
  async addDiacritics(text: string, mode: TashkeelMode = 'full'): Promise<string> {
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
    return data.text || '';
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
   * Text to Speech (Correct Arabic Pronunciation)
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
      mimeType: data.mimeType || 'audio/pcm;rate=24000',
    };
  },
};
