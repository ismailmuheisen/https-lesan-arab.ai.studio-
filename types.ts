export enum AppView {
  SPLASH = 'SPLASH',
  DASHBOARD = 'DASHBOARD',
  DEEP_SEARCH = 'DEEP_SEARCH',
  TASHKEEL = 'TASHKEEL',
  ART_STUDIO = 'ART_STUDIO',
  VOICE_STUDIO = 'VOICE_STUDIO',
  DICTIONARY = 'DICTIONARY'
}

export type TermCategoryKey = 'all' | 'nahw' | 'bayan' | 'badee' | 'maani' | 'sarf';

export interface DictionaryTerm {
  id: string;
  term: string;
  category: 'nahw' | 'bayan' | 'badee' | 'maani' | 'sarf';
  categoryLabel: string;
  summary: string;
  simplifiedRule: string;
  example: string;
  exampleAnalysis: string;
  tags: string[];
  commonMistake?: string;
}

export interface Message {
  id: string;
  role: 'user' | 'model';
  content: string;
  type?: 'text' | 'image' | 'audio';
  metadata?: any;
}

export type TashkeelMode = 'full' | 'ending' | 'proofread';

export interface DiacriticResult {
  original: string;
  diacritized: string;
  analysis?: string;
  mode?: TashkeelMode;
}

export enum FileFormat {
  PNG = 'png',
  JPEG = 'jpeg',
  PDF = 'pdf',
  DOCX = 'docx',
  TXT = 'txt'
}

export interface VoiceOption {
  id: string;
  label: string;
  gender: 'male' | 'female';
  toneDesc: string;
  isCustom?: boolean;
}

export interface VoiceDeliveryStyle {
  id: string;
  label: string;
  promptInstruction: string;
  icon?: string;
}

export type CalligraphyScript = 'thuluth' | 'kufi' | 'diwani' | 'ruqaa' | 'naskh';
export type ArtAtmosphere = 'royal-gold' | 'parchment-manuscript' | 'modern-islamic';
