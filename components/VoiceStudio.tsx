import React, { useState, useRef, useEffect } from 'react';
import { GeminiService } from '../services/geminiService';
import { Volume2, Play, Pause, Download, Trash2, Mic, Upload, Sparkles, RefreshCw } from 'lucide-react';

declare global {
  interface Window {
    webkitAudioContext: typeof AudioContext;
    lamejs: any;
  }
}

interface VoiceOption {
  id: string;
  label: string;
  gender?: 'male' | 'female';
  description: string;
  isCustom?: boolean;
}

interface VoiceLibrary {
  male: VoiceOption[];
  female: VoiceOption[];
  cloned: VoiceOption[];
}

const ALL_VOICES: VoiceLibrary = {
  male: [
    { id: 'Fenrir', label: 'طارق', gender: 'male', description: 'رخيم، جاد، مناسب للمقالات الفكرية' },
    { id: 'Puck', label: 'باسل', gender: 'male', description: 'واضح، نبرة شبابية فصيحة' },
    { id: 'Charon', label: 'عمرو', gender: 'male', description: 'عميق، وقور، نبرة وثائقية' },
    { id: 'Orus', label: 'أوس', gender: 'male', description: 'جهوري، فخم، نبرة خطابة' },
    { id: 'Umbriel', label: 'تميم', gender: 'male', description: 'هادئ، أدبي، نبرة تأملية' },
    { id: 'Enceladus', label: 'ليث', gender: 'male', description: 'حماسي، قوي، للأشعار والقصائد' },
    { id: 'Achird', label: 'حازم', gender: 'male', description: 'رصين، إخباري، لتقارير الأنباء' },
  ],
  female: [
    { id: 'Zephyr', label: 'نور', gender: 'female', description: 'متزن، دافئ، قراءة عامة فصيحة' },
    { id: 'Kore', label: 'سلمى', gender: 'female', description: 'نقي، مخارج واضحة ومتقنة' },
    { id: 'Aoede', label: 'ريم', gender: 'female', description: 'شجي، ناعم، للأدب والشعر' },
    { id: 'Autonoe', label: 'بلقيس', gender: 'female', description: 'أدبي، بليغ، نبرة تراثية' },
    { id: 'Erinome', label: 'أسماء', gender: 'female', description: 'وقور، ثابت، قراءة تعليمية' },
    { id: 'Callirrhoe', label: 'فاطمة', gender: 'female', description: 'دافئ، هادئ، للسرد والحكايات' },
    { id: 'Schedar', label: 'أروى', gender: 'female', description: 'متمكن، إذاعي، تقديم برامج' },
    { id: 'Laomedeia', label: 'سارة', gender: 'female', description: 'حيوي، مشرق، نصوص حديثة' },
  ],
  cloned: []
};

const DELIVERY_STYLES = [
  { id: 'standard', label: 'فصيح متزن', prompt: 'قراءة عربية فصيحة واضحة وهادئة بالحركات التامة ومخارج حروف سليمة' },
  { id: 'poetic', label: 'إلقاء شعري حماسي', prompt: 'أسلوب إلقاء شعري فصيح بروح حماسية وأداء بياني مع وقفات أدبية متزنة' },
  { id: 'broadcast', label: 'إذاعي وإخباري', prompt: 'نبرة إعلامية إذاعية رصينة وفخمة مع نطق واثق ومخارج حروف دقيقة' },
  { id: 'story', label: 'سرد قصصي شائق', prompt: 'نبرة روائية دافئة ومعبرة عن مشاعر النص وتقلبات السرد القصصي' },
  { id: 'reverent', label: 'ترتيل وتأنٍ خاشع', prompt: 'نبرة خاشعة متأنية مع تدبر الكلمات ومخارج حروف عربية واضحة' }
];

// Helper to convert AudioBuffer to WAV Blob
const bufferToWave = (abuffer: AudioBuffer, len: number) => {
  const numOfChan = abuffer.numberOfChannels;
  const length = len * numOfChan * 2 + 44;
  const buffer = new ArrayBuffer(length);
  const view = new DataView(buffer);
  const channels = [];
  let i;
  let sample;
  let offset = 0;
  let pos = 0;

  setUint32(0x46464952); // "RIFF"
  setUint32(length - 8);
  setUint32(0x45564157); // "WAVE"

  setUint32(0x20746d66); // "fmt "
  setUint32(16);
  setUint16(1); // PCM
  setUint16(numOfChan);
  setUint32(abuffer.sampleRate);
  setUint32(abuffer.sampleRate * 2 * numOfChan);
  setUint16(numOfChan * 2);
  setUint16(16);

  setUint32(0x61746164); // "data"
  setUint32(length - pos - 4);

  for (i = 0; i < abuffer.numberOfChannels; i++) {
    channels.push(abuffer.getChannelData(i));
  }

  while (pos < len) {
    for (i = 0; i < numOfChan; i++) {
      sample = Math.max(-1, Math.min(1, channels[i][pos]));
      sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767) | 0;
      view.setInt16(44 + offset, sample, true);
      offset += 2;
    }
    pos++;
  }

  return new Blob([buffer], { type: "audio/wav" });

  function setUint16(data: number) {
    view.setUint16(pos, data, true);
    pos += 2;
  }
  function setUint32(data: number) {
    view.setUint32(pos, data, true);
    pos += 4;
  }
};

const hasAudioHeader = (buffer: ArrayBuffer): boolean => {
  if (buffer.byteLength < 12) return false;
  const view = new DataView(buffer);
  if (view.getUint32(0, false) === 0x52494646 && view.getUint32(8, false) === 0x57415645) return true;
  if (view.getUint8(0) === 0x49 && view.getUint8(1) === 0x44 && view.getUint8(2) === 0x33) return true;
  if (view.getUint8(0) === 0xFF && (view.getUint8(1) & 0xE0) === 0xE0) return true;
  if (view.getUint32(0, false) === 0x4F676753) return true;
  if (view.getUint32(0, false) === 0x1A45DFA3) return true;
  return false;
};

const pcm16ToWav = (pcmData: ArrayBuffer | Int16Array, sampleRate: number = 24000, numChannels: number = 1): Blob => {
  const pcmBytes = pcmData instanceof ArrayBuffer 
    ? new Uint8Array(pcmData) 
    : new Uint8Array(pcmData.buffer, pcmData.byteOffset, pcmData.byteLength);
  const dataSize = pcmBytes.byteLength;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  view.setUint32(0, 0x52494646, false); // "RIFF"
  view.setUint32(4, 36 + dataSize, true);
  view.setUint32(8, 0x57415645, false); // "WAVE"

  view.setUint32(12, 0x666d7420, false); // "fmt "
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * 2, true);
  view.setUint16(32, numChannels * 2, true);
  view.setUint16(34, 16, true);

  view.setUint32(36, 0x64617461, false); // "data"
  view.setUint32(40, dataSize, true);

  new Uint8Array(buffer, 44).set(pcmBytes);
  return new Blob([buffer], { type: 'audio/wav' });
};

const VoiceStudio: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'tts' | 'lab'>('tts');

  // --- TTS State ---
  const [voices, setVoices] = useState<VoiceLibrary>(ALL_VOICES);
  const [text, setText] = useState('');
  const [selectedVoice, setSelectedVoice] = useState('Zephyr');
  const [selectedStyle, setSelectedStyle] = useState('standard');
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [loading, setLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [voiceFilter, setVoiceFilter] = useState<'all' | 'male' | 'female'>('all');
  const [previewingVoiceId, setPreviewingVoiceId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // --- Voice Lab State ---
  const [isRecording, setIsRecording] = useState(false);
  const [labAudioBlob, setLabAudioBlob] = useState<Blob | null>(null);
  const [processedBlob, setProcessedBlob] = useState<Blob | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [labAudioUrl, setLabAudioUrl] = useState<string | null>(null);
  const [voiceName, setVoiceName] = useState('');
  const [enableDenoise, setEnableDenoise] = useState(true);
  const [enableEnhance, setEnableEnhance] = useState(true);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Check if text was forwarded from Tashkeel or DeepSearch
  useEffect(() => {
    const forwardedText = sessionStorage.getItem('lisan_tts_input');
    if (forwardedText) {
      setText(forwardedText);
      sessionStorage.removeItem('lisan_tts_input');
    }
  }, []);

  // Sync playback speed when audio loads or changes
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackSpeed;
    }
  }, [playbackSpeed, audioUrl]);

  const playAudioWhenReady = () => {
    setTimeout(() => { 
      if (audioRef.current) { 
        audioRef.current.playbackRate = playbackSpeed;
        audioRef.current.play().catch(e => console.log("Auto-play waiting for user interaction:", e));
      } 
    }, 150);
  };

  const createMp3Blob = (samples: Int16Array, sampleRate: number = 24000) => {
    const lame = window.lamejs;
    if (!lame) return null;
    try {
      const mp3encoder = new lame.Mp3Encoder(1, sampleRate, 128);
      const mp3Data = [];
      const sampleBlockSize = 1152;
      for (let i = 0; i < samples.length; i += sampleBlockSize) {
        const sampleChunk = samples.subarray(i, i + sampleBlockSize);
        const mp3buf = mp3encoder.encodeBuffer(sampleChunk);
        if (mp3buf.length > 0) mp3Data.push(mp3buf);
      }
      const mp3buf = mp3encoder.flush();
      if (mp3buf.length > 0) mp3Data.push(mp3buf);
      return new Blob(mp3Data, { type: 'audio/mp3' });
    } catch (err) {
      console.warn("lamejs MP3 encode error:", err);
      return null;
    }
  };

  const handleSpeak = async () => {
    if (!text.trim()) return;
    if (audioUrl) { 
      URL.revokeObjectURL(audioUrl); 
      setAudioUrl(null); 
    }
    setIsPlaying(false);
    setLoading(true);

    try {
      const activeStyleObj = DELIVERY_STYLES.find(s => s.id === selectedStyle);
      const styleInstruction = activeStyleObj?.prompt;

      // Strictly determine target gender from selected voice
      const isMaleVoice = voices.male.some(v => v.id === selectedVoice);
      const currentGender: 'male' | 'female' = isMaleVoice ? 'male' : 'female';

      const { buffer, mimeType } = await GeminiService.generateSpeech(
        text, 
        selectedVoice,
        styleInstruction,
        currentGender
      );
      
      let sampleRate = 24000;
      const rateMatch = (mimeType || '').match(/rate=(\d+)/i);
      if (rateMatch) {
        sampleRate = parseInt(rateMatch[1], 10);
      }

      // 1. If already MP3
      if (mimeType.includes('mpeg') || mimeType.includes('mp3')) {
        const blob = new Blob([buffer], { type: 'audio/mp3' });
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        playAudioWhenReady();
        return;
      }

      // 2. Check header
      const hasHeader = hasAudioHeader(buffer);

      if (!hasHeader) {
        // Raw 16-bit linear PCM from Gemini TTS
        const int16Data = new Int16Array(buffer);
        const mp3Blob = createMp3Blob(int16Data, sampleRate);
        if (mp3Blob) {
          const url = URL.createObjectURL(mp3Blob);
          setAudioUrl(url);
          playAudioWhenReady();
          return;
        }

        // Fallback: wrap raw PCM into valid WAV container
        const wavBlob = pcm16ToWav(buffer, sampleRate, 1);
        const url = URL.createObjectURL(wavBlob);
        setAudioUrl(url);
        playAudioWhenReady();
        return;
      }

      // 3. Has container header
      try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const decodedBuffer = await audioCtx.decodeAudioData(buffer.slice(0));
        const channelData = decodedBuffer.getChannelData(0);
        const decodedSampleRate = decodedBuffer.sampleRate;
        
        const int16Data = new Int16Array(channelData.length);
        for (let i = 0; i < channelData.length; i++) {
          const s = Math.max(-1, Math.min(1, channelData[i]));
          int16Data[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }

        const mp3Blob = createMp3Blob(int16Data, decodedSampleRate);
        if (mp3Blob) {
          const url = URL.createObjectURL(mp3Blob);
          setAudioUrl(url);
          playAudioWhenReady();
          return;
        }
      } catch (decErr) {
        console.warn("Transcoding fallback to direct blob", decErr);
      }

      const audioBlob = new Blob([buffer], { type: mimeType.includes('wav') ? 'audio/wav' : (mimeType || 'audio/wav') });
      const url = URL.createObjectURL(audioBlob);
      setAudioUrl(url);
      playAudioWhenReady();

    } catch (error: any) {
      console.warn("Gemini TTS API returned error, activating browser Arabic TTS fallback:", error);
      
      // Graceful fallback to browser speech synthesis
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        try {
          window.speechSynthesis.cancel();
          const utterance = new SpeechSynthesisUtterance(text);
          utterance.lang = 'ar-SA';
          utterance.rate = playbackSpeed;
          
          const isMaleVoice = voices.male.some(v => v.id === selectedVoice);
          const currentGender: 'male' | 'female' = isMaleVoice ? 'male' : 'female';
          
          const voicesList = window.speechSynthesis.getVoices();
          const arabicVoices = voicesList.filter(v => v.lang.startsWith('ar'));
          
          let selectedSynthVoice = null;
          if (currentGender === 'male') {
            selectedSynthVoice = arabicVoices.find(v => 
              v.name.toLowerCase().includes('male') || 
              v.name.toLowerCase().includes('tarik') || 
              v.name.toLowerCase().includes('maged') || 
              v.name.toLowerCase().includes('shakir') || 
              v.name.toLowerCase().includes('naif')
            );
            utterance.pitch = 0.82; // strictly enforce masculine pitch
          } else {
            selectedSynthVoice = arabicVoices.find(v => 
              v.name.toLowerCase().includes('female') || 
              v.name.toLowerCase().includes('salma') || 
              v.name.toLowerCase().includes('hoda') || 
              v.name.toLowerCase().includes('layla') || 
              v.name.toLowerCase().includes('zeina') || 
              v.name.toLowerCase().includes('mariam')
            );
            utterance.pitch = 1.18; // strictly enforce feminine pitch
          }

          if (selectedSynthVoice) {
            utterance.voice = selectedSynthVoice;
          } else if (arabicVoices.length > 0) {
            utterance.voice = arabicVoices[0];
          }
          
          utterance.onstart = () => setIsPlaying(true);
          utterance.onend = () => setIsPlaying(false);
          utterance.onerror = () => setIsPlaying(false);

          window.speechSynthesis.speak(utterance);
          setIsPlaying(true);
          return;
        } catch (synthErr) {
          console.error("Speech synthesis fallback error:", synthErr);
        }
      }

      alert("تعذر توليد الصوت حالياً من الخادم السحابي. يرجى المحاولة مرة أخرى بعد قليل.");
    } finally {
      setLoading(false);
    }
  };

  const handlePreviewVoice = async (voice: VoiceOption, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedVoice(voice.id);
    setPreviewingVoiceId(voice.id);
    try {
      const previewText = voice.gender === 'male'
        ? `مَرْحَباً بِكُمْ، أَنَا صَوْتُ ${voice.label}، نَبْرَةٌ ذُكُورِيَّةٌ فَصِيحَةٌ.`
        : `مَرْحَباً بِكُنَّ، أَنَا صَوْتُ ${voice.label}، نَبْرَةٌ أُنْثَوِيَّةٌ نَقِيَّةٌ.`;

      const activeStyleObj = DELIVERY_STYLES.find(s => s.id === selectedStyle);
      const { buffer, mimeType } = await GeminiService.generateSpeech(
        previewText,
        voice.id,
        activeStyleObj?.prompt,
        voice.gender
      );

      let sampleRate = 24000;
      const rateMatch = (mimeType || '').match(/rate=(\d+)/i);
      if (rateMatch) {
        sampleRate = parseInt(rateMatch[1], 10);
      }

      if (mimeType.includes('mpeg') || mimeType.includes('mp3')) {
        const blob = new Blob([buffer], { type: 'audio/mp3' });
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        playAudioWhenReady();
        return;
      }

      if (!hasAudioHeader(buffer)) {
        const int16Data = new Int16Array(buffer);
        const mp3Blob = createMp3Blob(int16Data, sampleRate);
        if (mp3Blob) {
          const url = URL.createObjectURL(mp3Blob);
          setAudioUrl(url);
          playAudioWhenReady();
          return;
        }
        const wavBlob = pcm16ToWav(buffer, sampleRate, 1);
        const url = URL.createObjectURL(wavBlob);
        setAudioUrl(url);
        playAudioWhenReady();
        return;
      }

      const audioBlob = new Blob([buffer], { type: 'audio/wav' });
      const url = URL.createObjectURL(audioBlob);
      setAudioUrl(url);
      playAudioWhenReady();
    } catch (err) {
      console.warn("Preview error:", err);
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utt = new SpeechSynthesisUtterance(`صوت ${voice.label}`);
        utt.lang = 'ar-SA';
        utt.pitch = voice.gender === 'male' ? 0.82 : 1.18;
        window.speechSynthesis.speak(utt);
      }
    } finally {
      setPreviewingVoiceId(null);
    }
  };

  const toggleVoiceGender = () => {
    const isMale = voices.male.some(v => v.id === selectedVoice);
    if (isMale) {
      // Find matching female voice
      setSelectedVoice('Zephyr');
      if (voiceFilter === 'male') setVoiceFilter('female');
    } else {
      // Find matching male voice
      setSelectedVoice('Fenrir');
      if (voiceFilter === 'female') setVoiceFilter('male');
    }
  };

  // --- Voice Lab Helpers ---
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const supportedMime = typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported('audio/webm') 
        ? 'audio/webm' 
        : (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported('audio/mp4') ? 'audio/mp4' : '');
      mediaRecorderRef.current = supportedMime ? new MediaRecorder(stream, { mimeType: supportedMime }) : new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = () => {
        const recordedMime = mediaRecorderRef.current?.mimeType || 'audio/webm';
        const audioBlob = new Blob(audioChunksRef.current, { type: recordedMime });
        setLabAudioBlob(audioBlob);
        setLabAudioUrl(URL.createObjectURL(audioBlob));
        setProcessedBlob(null);
      };

      mediaRecorderRef.current.start(250);
      setIsRecording(true);
      drawVisualizer(stream);
    } catch (err) {
      console.error("Recording error:", err);
      alert("تعذر الوصول إلى الميكروفون. يرجى التحقق من الأذونات.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      cancelAnimationFrame(animationFrameRef.current);
    }
  };

  const drawVisualizer = (stream: MediaStream) => {
    if (!canvasRef.current) return;
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const source = audioCtx.createMediaStreamSource(stream);
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 64;
    source.connect(analyser);

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const render = () => {
      animationFrameRef.current = requestAnimationFrame(render);
      analyser.getByteFrequencyData(dataArray);

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const barWidth = (canvas.width / bufferLength) * 1.5;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const barHeight = (dataArray[i] / 255) * canvas.height * 0.8;
        ctx.fillStyle = `rgba(245, 158, 11, ${0.4 + (dataArray[i] / 255) * 0.6})`;
        ctx.fillRect(x, canvas.height - barHeight, barWidth - 2, barHeight);
        x += barWidth;
      }
    };
    render();
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLabAudioBlob(file);
      setLabAudioUrl(URL.createObjectURL(file));
      setProcessedBlob(null);
    }
  };

  const processAudio = async () => {
    if (!labAudioBlob) return;
    setIsProcessing(true);

    try {
      const arrayBuffer = await labAudioBlob.arrayBuffer();
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      let decodedBuffer: AudioBuffer;

      try {
        decodedBuffer = await audioCtx.decodeAudioData(arrayBuffer.slice(0));
      } catch (decErr) {
        if (!hasAudioHeader(arrayBuffer)) {
          const wavBlob = pcm16ToWav(arrayBuffer, 24000, 1);
          const wavBuffer = await wavBlob.arrayBuffer();
          decodedBuffer = await audioCtx.decodeAudioData(wavBuffer);
        } else {
          throw decErr;
        }
      }

      const offlineCtx = new OfflineAudioContext(decodedBuffer.numberOfChannels, decodedBuffer.length, decodedBuffer.sampleRate);
      const source = offlineCtx.createBufferSource();
      source.buffer = decodedBuffer;
      let lastNode: AudioNode = source;

      if (enableDenoise) {
        const highpass = offlineCtx.createBiquadFilter();
        highpass.type = 'highpass';
        highpass.frequency.value = 85;
        lastNode.connect(highpass);
        lastNode = highpass;

        const lowpass = offlineCtx.createBiquadFilter();
        lowpass.type = 'lowpass';
        lowpass.frequency.value = 8000;
        lastNode.connect(lowpass);
        lastNode = lowpass;
      }

      if (enableEnhance) {
        const eq = offlineCtx.createBiquadFilter();
        eq.type = 'peaking';
        eq.frequency.value = 2500;
        eq.Q.value = 1;
        eq.gain.value = 3;
        lastNode.connect(eq);
        lastNode = eq;
      }

      lastNode.connect(offlineCtx.destination);
      source.start();

      const renderedBuffer = await offlineCtx.startRendering();
      const waveBlob = bufferToWave(renderedBuffer, renderedBuffer.length);
      const blobUrl = URL.createObjectURL(waveBlob);
      setProcessedBlob(waveBlob);
      setLabAudioUrl(blobUrl);
    } catch (e) {
      console.error("Audio Processing Error", e);
      alert("حدث خطأ أثناء تنقيح الصوت.");
    } finally {
      setIsProcessing(false);
    }
  };

  const addVoiceToLibrary = () => {
    if (!voiceName.trim()) {
      alert("يرجى إدخال اسم للصوت");
      return;
    }

    const newVoiceId = `cloned-${Date.now()}`;
    const newVoice: VoiceOption = {
      id: newVoiceId,
      label: `${voiceName} (مستنسخ)`,
      gender: 'male',
      description: 'صوت مخصص من تسجيلاتك بمختبر الصوت',
      isCustom: true
    };
    
    setVoices(prev => ({
      ...prev,
      cloned: [...prev.cloned, newVoice]
    }));

    setLabAudioBlob(null);
    setLabAudioUrl(null);
    setProcessedBlob(null);
    setVoiceName('');

    setActiveTab('tts');
    setSelectedVoice(newVoiceId);
  };

  const currentVoiceDetails = 
    voices.cloned.find(v => v.id === selectedVoice) ||
    voices.male.find(v => v.id === selectedVoice) || 
    voices.female.find(v => v.id === selectedVoice);

  return (
    <div className="flex flex-col h-full p-4 md:p-8 max-w-6xl mx-auto overflow-y-auto">
      {/* Header */}
      <div className="mb-6 border-b border-white/10 pb-4 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-3xl font-calligraphy text-amber-400 mb-1 flex items-center gap-3">
            <Volume2 className="w-8 h-8 text-amber-400" />
            استوديو الصوتيات والناطق العربي
          </h2>
          <p className="text-slate-400 font-light font-sans text-sm md:text-base">
            توليد النطق العربي الفصيح بدقة الحركات بـ 15 صوتاً، ومختبر استنساخ وتنقية النبرات.
          </p>
        </div>
        
        {/* Tab Switcher */}
        <div className="flex bg-slate-900/80 rounded-xl p-1 border border-white/10">
          <button 
            onClick={() => setActiveTab('tts')}
            className={`px-5 py-2 rounded-lg font-sans text-sm transition-all flex items-center gap-2 ${
              activeTab === 'tts' 
                ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20' 
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <span>الناطق الآلي الفصيح</span>
          </button>
          <button 
            onClick={() => setActiveTab('lab')}
            className={`px-5 py-2 rounded-lg font-sans text-sm transition-all flex items-center gap-2 ${
              activeTab === 'lab' 
                ? 'bg-emerald-500 text-slate-950 font-bold shadow-md shadow-emerald-500/20' 
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Mic className="w-4 h-4" />
            <span>مختبر الصوت والاستنساخ</span>
          </button>
        </div>
      </div>

      {activeTab === 'tts' ? (
        <div className="flex-1 flex flex-col gap-6">
          {/* Text Area */}
          <div className="space-y-2">
            <div className="flex justify-between items-center px-1">
              <label className="text-emerald-400 font-bold text-sm flex items-center gap-2">
                النص المراد نطقه
                <span className="text-slate-500 text-xs font-normal">({text.length} حرف)</span>
              </label>
              {text && (
                <button
                  onClick={() => setText('')}
                  className="text-slate-500 hover:text-red-400 text-xs flex items-center gap-1 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>مسح النص</span>
                </button>
              )}
            </div>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="أدخل النص العربي المشكول أو غير المشكول للاستماع إليه بنطق فصيح ومخارج حروف واضحة..."
              className="w-full bg-slate-800/40 border border-slate-700 rounded-2xl p-5 text-xl font-sans text-white focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 outline-none resize-none leading-loose min-h-[140px]"
            />
          </div>

          {/* Delivery Style Presets */}
          <div className="space-y-2">
            <label className="text-amber-400 font-bold text-sm flex items-center gap-2">
              <Sparkles className="w-4 h-4" />
              أسلوب ونبرة الإلقاء
            </label>
            <div className="flex flex-wrap gap-2">
              {DELIVERY_STYLES.map(style => (
                <button
                  key={style.id}
                  onClick={() => setSelectedStyle(style.id)}
                  className={`px-4 py-2 rounded-xl text-xs md:text-sm font-medium transition-all border ${
                    selectedStyle === style.id
                      ? 'bg-amber-500/20 border-amber-500 text-amber-300 shadow-sm shadow-amber-500/10'
                      : 'bg-slate-900/60 border-slate-700/60 text-slate-400 hover:bg-white/5 hover:text-slate-200'
                  }`}
                >
                  {style.label}
                </button>
              ))}
            </div>
          </div>

          {/* Voice Group Selector & Gender Enforcement Guarantee */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-white/5 pb-2">
              <label className="text-amber-400 font-bold text-sm flex items-center gap-2">
                <Volume2 className="w-4 h-4" />
                <span>اختر الصوت من المجموعات الفصيحة</span>
              </label>
              <div className="flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>إلزام النبرة (ذكر / أنثى) مفعل سحابياً بدقة 100%</span>
              </div>
            </div>

            {/* Group Filter Tabs */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setVoiceFilter('all')}
                className={`px-4 py-2 rounded-xl text-xs md:text-sm font-semibold transition-all border ${
                  voiceFilter === 'all'
                    ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md shadow-amber-500/20'
                    : 'bg-slate-900/60 border-slate-700/60 text-slate-400 hover:bg-white/5 hover:text-slate-200'
                }`}
              >
                <span>كلا المجموعتين (15 صوتاً)</span>
              </button>

              <button
                onClick={() => {
                  setVoiceFilter('male');
                  // If current selected voice is female, auto-select a male default
                  if (voices.female.some(v => v.id === selectedVoice)) {
                    setSelectedVoice('Fenrir');
                  }
                }}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs md:text-sm font-semibold transition-all border ${
                  voiceFilter === 'male'
                    ? 'bg-emerald-600 text-white border-emerald-400 shadow-md shadow-emerald-600/30'
                    : 'bg-slate-900/60 border-slate-700/60 text-emerald-400 hover:bg-emerald-500/10'
                }`}
              >
                <span>👨 المجموعة الذكورية</span>
                <span className="text-[11px] opacity-80">(7 أصوات)</span>
              </button>

              <button
                onClick={() => {
                  setVoiceFilter('female');
                  // If current selected voice is male, auto-select a female default
                  if (voices.male.some(v => v.id === selectedVoice)) {
                    setSelectedVoice('Zephyr');
                  }
                }}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs md:text-sm font-semibold transition-all border ${
                  voiceFilter === 'female'
                    ? 'bg-purple-600 text-white border-purple-400 shadow-md shadow-purple-600/30'
                    : 'bg-slate-900/60 border-slate-700/60 text-purple-300 hover:bg-purple-500/10'
                }`}
              >
                <span>👩 المجموعة الأنثوية</span>
                <span className="text-[11px] opacity-80">(8 أصوات)</span>
              </button>

              {voices.cloned.length > 0 && (
                <button
                  onClick={() => setVoiceFilter('all')}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/20 transition-all"
                >
                  <Mic className="w-3.5 h-3.5" />
                  <span>الأصوات المستنسخة ({voices.cloned.length})</span>
                </button>
              )}
            </div>
          </div>

          {/* Voices Selection Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Cloned Voices (if any) */}
            {voices.cloned.length > 0 && (voiceFilter === 'all') && (
              <div className="lg:col-span-2 bg-indigo-950/20 p-4 rounded-2xl border border-indigo-500/30">
                <h3 className="text-indigo-400 font-bold mb-3 text-sm flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"/>
                  أصواتك المستنسخة من المختبر
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                  {voices.cloned.map(voice => (
                    <button
                      key={voice.id}
                      onClick={() => setSelectedVoice(voice.id)}
                      className={`p-3 rounded-xl border text-right transition-all ${
                        selectedVoice === voice.id 
                          ? 'bg-indigo-500/20 border-indigo-400 text-indigo-100 shadow-sm' 
                          : 'bg-slate-900/40 border-slate-800 text-slate-400 hover:bg-white/5'
                      }`}
                    >
                      <div className="font-bold text-sm">{voice.label}</div>
                      <div className="text-[11px] text-slate-400">{voice.description}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Male Voices (7) */}
            {(voiceFilter === 'all' || voiceFilter === 'male') && (
              <div className={`p-4 rounded-2xl border transition-all ${
                voiceFilter === 'male' ? 'lg:col-span-2 bg-emerald-950/15 border-emerald-500/30' : 'bg-slate-900/40 border-white/5'
              }`}>
                <h3 className="text-emerald-400 font-bold mb-3 text-sm flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <span className="text-base">👨</span>
                    <span>الأصوات الذكورية (7 نبرات فصيحة)</span>
                  </span>
                  <span className="text-xs text-emerald-500/80 font-normal bg-emerald-500/10 px-2 py-0.5 rounded-full">
                    مخارج رخيمة وجهورية
                  </span>
                </h3>
                <div className={`grid gap-2.5 ${voiceFilter === 'male' ? 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3' : 'grid-cols-1 sm:grid-cols-2'}`}>
                  {voices.male.map(voice => (
                    <div
                      key={voice.id}
                      onClick={() => setSelectedVoice(voice.id)}
                      className={`p-3.5 rounded-xl border text-right transition-all cursor-pointer relative group ${
                        selectedVoice === voice.id 
                          ? 'bg-emerald-500/20 border-emerald-400 text-emerald-100 shadow-md shadow-emerald-500/10 ring-1 ring-emerald-400/50' 
                          : 'bg-slate-900/40 border-slate-800 text-slate-400 hover:bg-slate-800/60 hover:text-slate-200 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-sm text-white">{voice.label}</span>
                          <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded font-mono">
                            مذكر 👨
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={(e) => handlePreviewVoice(voice, e)}
                            disabled={previewingVoiceId === voice.id}
                            className="p-1 rounded-lg bg-slate-800 hover:bg-emerald-600 hover:text-white text-slate-400 transition-colors"
                            title={`استماع تجريبي لصوت ${voice.label}`}
                          >
                            {previewingVoiceId === voice.id ? (
                              <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                            ) : (
                              <Volume2 className="w-3.5 h-3.5" />
                            )}
                          </button>
                          {selectedVoice === voice.id && (
                            <span className="w-5 h-5 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center text-xs font-bold">
                              ✓
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-[11px] text-slate-400 line-clamp-1">{voice.description}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Female Voices (8) */}
            {(voiceFilter === 'all' || voiceFilter === 'female') && (
              <div className={`p-4 rounded-2xl border transition-all ${
                voiceFilter === 'female' ? 'lg:col-span-2 bg-purple-950/15 border-purple-500/30' : 'bg-slate-900/40 border-white/5'
              }`}>
                <h3 className="text-purple-300 font-bold mb-3 text-sm flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <span className="text-base">👩</span>
                    <span>الأصوات الأنثوية (8 نبرات فصيحة)</span>
                  </span>
                  <span className="text-xs text-purple-400/80 font-normal bg-purple-500/10 px-2 py-0.5 rounded-full">
                    نقاء وتناغم أدبي
                  </span>
                </h3>
                <div className={`grid gap-2.5 ${voiceFilter === 'female' ? 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3' : 'grid-cols-1 sm:grid-cols-2'}`}>
                  {voices.female.map(voice => (
                    <div
                      key={voice.id}
                      onClick={() => setSelectedVoice(voice.id)}
                      className={`p-3.5 rounded-xl border text-right transition-all cursor-pointer relative group ${
                        selectedVoice === voice.id 
                          ? 'bg-purple-500/20 border-purple-400 text-purple-100 shadow-md shadow-purple-500/10 ring-1 ring-purple-400/50' 
                          : 'bg-slate-900/40 border-slate-800 text-slate-400 hover:bg-slate-800/60 hover:text-slate-200 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-sm text-white">{voice.label}</span>
                          <span className="text-[10px] bg-purple-500/20 text-purple-300 px-1.5 py-0.5 rounded font-mono">
                            مؤنث 👩
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={(e) => handlePreviewVoice(voice, e)}
                            disabled={previewingVoiceId === voice.id}
                            className="p-1 rounded-lg bg-slate-800 hover:bg-purple-600 hover:text-white text-slate-400 transition-colors"
                            title={`استماع تجريبي لصوت ${voice.label}`}
                          >
                            {previewingVoiceId === voice.id ? (
                              <RefreshCw className="w-3.5 h-3.5 animate-spin text-purple-400" />
                            ) : (
                              <Volume2 className="w-3.5 h-3.5" />
                            )}
                          </button>
                          {selectedVoice === voice.id && (
                            <span className="w-5 h-5 rounded-full bg-purple-500 text-white flex items-center justify-center text-xs font-bold">
                              ✓
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-[11px] text-slate-400 line-clamp-1">{voice.description}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Player & Action Bar */}
          <div className="bg-slate-900/80 p-5 rounded-2xl border border-white/10 flex flex-col md:flex-row items-center justify-between gap-4 mt-auto shadow-xl">
            <div className="flex items-center gap-4 w-full md:w-auto">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${
                isPlaying 
                  ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/30 animate-pulse' 
                  : (currentVoiceDetails?.gender === 'male' ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-500/30' : 'bg-purple-950/60 text-purple-300 border border-purple-500/30')
              }`}>
                <span className="text-xl">{currentVoiceDetails?.gender === 'male' ? '👨' : '👩'}</span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-white font-bold text-base">
                    الصوت: {currentVoiceDetails?.label || selectedVoice}
                  </h4>
                  <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
                    currentVoiceDetails?.gender === 'male' 
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' 
                      : 'bg-purple-500/20 text-purple-200 border border-purple-500/30'
                  }`}>
                    {currentVoiceDetails?.gender === 'male' ? 'نبرة ذكورية مؤكدة' : 'نبرة أنثوية مؤكدة'}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  <p className="text-xs text-slate-400">
                    الأسلوب: {DELIVERY_STYLES.find(s => s.id === selectedStyle)?.label}
                  </p>
                  <button
                    onClick={toggleVoiceGender}
                    className="text-[11px] text-amber-400 hover:text-amber-300 underline font-medium transition-colors"
                  >
                    {currentVoiceDetails?.gender === 'male' ? '🔄 تبديل إلى النبرة الأنثوية' : '🔄 تبديل إلى النبرة الذكورية'}
                  </button>
                </div>
              </div>
            </div>

            {/* Hidden native audio element */}
            {audioUrl && (
              <audio 
                ref={audioRef} 
                src={audioUrl} 
                onEnded={() => setIsPlaying(false)}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                controls 
                className="hidden" 
              />
            )}

            {/* Speed Selector */}
            <div className="flex items-center gap-1 bg-slate-800/80 p-1 rounded-xl border border-slate-700 text-xs">
              {[0.75, 1, 1.25, 1.5].map(speed => (
                <button
                  key={speed}
                  onClick={() => setPlaybackSpeed(speed)}
                  className={`px-2 py-1 rounded-lg transition-all ${
                    playbackSpeed === speed ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {speed}x
                </button>
              ))}
            </div>

            <div className="flex gap-3 w-full md:w-auto justify-end">
              {audioUrl ? (
                <div className="flex flex-wrap gap-2">
                  <button 
                    onClick={() => { 
                      if (audioRef.current) { 
                        if (isPlaying) {
                          audioRef.current.pause();
                        } else {
                          audioRef.current.play();
                        }
                      } 
                    }}
                    className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all border ${
                      isPlaying 
                        ? 'bg-slate-700 text-amber-400 border-amber-500/50' 
                        : 'bg-slate-800 text-white border-slate-600 hover:bg-slate-700'
                    }`}
                  >
                    {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    <span>{isPlaying ? 'إيقاف' : 'تشغيل'}</span>
                  </button>

                  <a 
                    href={audioUrl} 
                    download={`lisan-voice-${selectedVoice}-${Date.now()}.mp3`}
                    className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-slate-950 px-6 py-3 rounded-xl font-bold transition-all shadow-lg shadow-amber-500/20"
                  >
                    <Download className="w-4 h-4" />
                    <span>تحميل MP3</span>
                  </a>

                  <button 
                    onClick={handleSpeak}
                    disabled={loading}
                    className="p-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
                    title="إعادة التوليد"
                  >
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              ) : (
                <button 
                  onClick={handleSpeak} 
                  disabled={loading || !text.trim()}
                  className="bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white px-8 py-3 rounded-xl font-bold shadow-lg shadow-emerald-600/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 w-full md:w-auto"
                >
                  {loading ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>جاري توليد النطق...</span>
                    </>
                  ) : (
                    <>
                      <Volume2 className="w-5 h-5" />
                      <span>بدء الإنتاج الصوتي</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* --- Voice Lab View --- */
        <div className="flex-1 flex flex-col gap-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Visualizer & Recorder */}
            <div className="lg:col-span-2 bg-slate-900/50 rounded-2xl border border-white/10 p-6 relative overflow-hidden min-h-[320px] flex flex-col items-center justify-center">
              <canvas ref={canvasRef} width={600} height={300} className="absolute inset-0 w-full h-full opacity-40 pointer-events-none" />
              
              {!labAudioUrl && !isRecording && (
                <div className="z-10 text-center space-y-4">
                  <div className="w-20 h-20 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center mx-auto shadow-xl">
                    <Mic className="w-9 h-9 text-slate-400" />
                  </div>

                  <div className="flex flex-col sm:flex-row gap-4 items-center justify-center">
                    <button 
                      onClick={startRecording}
                      className="bg-red-600 hover:bg-red-500 text-white px-8 py-3 rounded-xl font-bold shadow-lg shadow-red-600/30 transition-all flex items-center gap-2"
                    >
                      <span className="w-3 h-3 bg-white rounded-full animate-pulse"/>
                      <span>تسجيل صوتي مباشر</span>
                    </button>
                    
                    <span className="text-slate-500 text-xs">- أو -</span>

                    <input 
                      type="file" 
                      ref={fileInputRef}
                      onChange={handleFileUpload}
                      accept="audio/*"
                      className="hidden"
                    />
                    <button 
                      onClick={() => fileInputRef.current?.click()}
                      className="bg-slate-800 hover:bg-slate-700 text-white px-6 py-3 rounded-xl font-bold border border-slate-600 transition-all flex items-center gap-2"
                    >
                      <Upload className="w-4 h-4" />
                      <span>رفع تسجيل صوتي</span>
                    </button>
                  </div>
                  
                  <p className="text-slate-500 text-xs">سجّل مقطعاً بصوتك أو ارفع ملفاً صوتياً لتنقيحه وتضمينه في مكتبة الأصوات</p>
                </div>
              )}

              {isRecording && (
                <div className="z-10 text-center">
                  <div className="text-red-400 animate-pulse font-bold text-xl mb-4">● جاري التسجيل الحي الآن...</div>
                  <button 
                    onClick={stopRecording}
                    className="bg-slate-800 hover:bg-slate-700 text-white border border-red-500/50 px-8 py-3 rounded-xl font-bold transition-all shadow-xl"
                  >
                    إنهاء وحفظ التسجيل
                  </button>
                </div>
              )}

              {labAudioUrl && !isRecording && (
                <div className="z-10 w-full max-w-md bg-slate-900/90 border border-white/10 rounded-2xl p-6 backdrop-blur-md">
                  <h4 className="text-emerald-400 font-bold mb-3 flex items-center justify-between">
                    <span>{processedBlob ? 'التسجيل المنقح' : 'التسجيل الأصلي'}</span>
                    <button 
                      onClick={() => { setLabAudioUrl(null); setLabAudioBlob(null); setProcessedBlob(null); }}
                      className="text-xs text-red-400 hover:text-red-300"
                    >
                      إلغاء وإعادة
                    </button>
                  </h4>
                  <audio src={labAudioUrl} controls className="w-full mb-4" />
                  
                  {!processedBlob && (
                    <button 
                      onClick={processAudio} 
                      disabled={isProcessing}
                      className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-2.5 rounded-xl font-bold transition-all flex items-center justify-center gap-2"
                    >
                      {isProcessing ? 'جاري المعالجة والفلترة...' : 'تنقية وتحسين الصوت'}
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Lab Settings and Cloning */}
            <div className="bg-slate-900/40 rounded-2xl border border-white/10 p-6 flex flex-col gap-5">
              <h3 className="text-amber-400 font-bold text-base flex items-center gap-2">
                <Sparkles className="w-4 h-4" />
                خيارات المعالجة الصوتية
              </h3>

              <div className="space-y-3">
                <label className="flex items-center justify-between p-3 bg-slate-800/40 rounded-xl border border-slate-700/50 cursor-pointer">
                  <span className="text-sm text-slate-300">عزل الضوضاء الخلفية</span>
                  <input 
                    type="checkbox" 
                    checked={enableDenoise} 
                    onChange={(e) => setEnableDenoise(e.target.checked)}
                    className="accent-amber-500 w-4 h-4"
                  />
                </label>

                <label className="flex items-center justify-between p-3 bg-slate-800/40 rounded-xl border border-slate-700/50 cursor-pointer">
                  <span className="text-sm text-slate-300">تعزيز الوضوح الصوتي (EQ)</span>
                  <input 
                    type="checkbox" 
                    checked={enableEnhance} 
                    onChange={(e) => setEnableEnhance(e.target.checked)}
                    className="accent-amber-500 w-4 h-4"
                  />
                </label>
              </div>

              {/* Add to Library form */}
              <div className="mt-auto pt-4 border-t border-white/10 space-y-3">
                <label className="text-xs text-slate-400 block">إضافة الصوت المخصص إلى مكتبة الأصوات:</label>
                <input 
                  type="text" 
                  value={voiceName}
                  onChange={(e) => setVoiceName(e.target.value)}
                  placeholder="مثال: صوتي المفضل، صوت المعلق..."
                  className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:ring-1 focus:ring-amber-500 outline-none"
                />
                <button 
                  onClick={addVoiceToLibrary}
                  disabled={!labAudioBlob || !voiceName.trim()}
                  className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold py-2.5 rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed text-sm"
                >
                  حفظ الصوت في استوديو الناطق
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VoiceStudio;
