import { stripDiacritics } from './utils/textUtils';

interface VerifiedAyah {
  uthmaniText: string;
  surahName: string;
  surahNumber: number;
  numberInSurah: number;
}

// In-memory cache for verified verses: cleanQuery -> VerifiedAyah
const verseCache = new Map<string, VerifiedAyah | null>();

/**
 * Clean surah name for clean Arabic display (e.g., 'سُورَةُ فَاطِرٍ' -> 'سورة فاطر')
 */
export function cleanSurahName(rawName: string): string {
  const stripped = stripDiacritics(rawName).trim();
  if (stripped.startsWith('سورة ')) {
    return stripped;
  }
  return `سورة ${stripped.replace(/^سورة\s*/, '')}`;
}

/**
 * Searches api.alquran.cloud (Uthmani edition) for a given verse snippet.
 */
export async function searchAndVerifyQuranVerse(verseSnippet: string): Promise<VerifiedAyah | null> {
  const cleanSnippet = stripDiacritics(verseSnippet)
    .replace(/[^\u0600-\u06FF\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  // Need at least 2 words or 8 characters to avoid false matches
  if (!cleanSnippet || cleanSnippet.split(' ').length < 2 || cleanSnippet.length < 8) {
    return null;
  }

  // Check cache
  if (verseCache.has(cleanSnippet)) {
    return verseCache.get(cleanSnippet) || null;
  }

  // Use top 5-7 words for search query if snippet is long
  const words = cleanSnippet.split(' ');
  const searchQuery = words.length > 7 ? words.slice(0, 7).join(' ') : cleanSnippet;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    const searchUrl = `https://api.alquran.cloud/v1/search/${encodeURIComponent(searchQuery)}/all/quran-simple-clean`;
    const searchRes = await fetch(searchUrl, { signal: controller.signal });
    clearTimeout(timeout);

    if (!searchRes.ok) {
      verseCache.set(cleanSnippet, null);
      return null;
    }

    const searchData = await searchRes.json();
    const match = searchData?.data?.matches?.[0];

    if (!match || !match.surah) {
      verseCache.set(cleanSnippet, null);
      return null;
    }

    const surahNum = match.surah.number;
    const ayahNum = match.numberInSurah;

    // Fetch verified Uthmani edition for this ayah
    const ayahController = new AbortController();
    const ayahTimeout = setTimeout(() => ayahController.abort(), 4000);
    const ayahUrl = `https://api.alquran.cloud/v1/ayah/${surahNum}:${ayahNum}/quran-uthmani`;
    const ayahRes = await fetch(ayahUrl, { signal: ayahController.signal });
    clearTimeout(ayahTimeout);

    if (!ayahRes.ok) {
      verseCache.set(cleanSnippet, null);
      return null;
    }

    const ayahData = await ayahRes.json();
    const uthmaniFullText: string = ayahData?.data?.text || match.text;

    const result: VerifiedAyah = {
      uthmaniText: uthmaniFullText,
      surahName: cleanSurahName(match.surah.name || `سورة رقم ${surahNum}`),
      surahNumber: surahNum,
      numberInSurah: ayahNum,
    };

    verseCache.set(cleanSnippet, result);
    return result;
  } catch (err: any) {
    console.warn('[quranVerification] Error querying alquran.cloud:', err?.message || err);
    return null;
  }
}

/**
 * Scans an entire Arabic text, detects Quranic verses (in ﴿...﴾ or cited quotes),
 * verifies them against api.alquran.cloud (Uthmani edition), and replaces them
 * with the verified Uthmani text plus [سورة: آية] reference.
 */
export async function verifyQuranicVersesInText(text: string): Promise<string> {
  if (!text) return text;

  let updatedText = text;

  // 1. Match verses enclosed in traditional Quranic brackets: ﴿...﴾
  const bracketMatches = Array.from(text.matchAll(/﴿([^﴾]+)﴾/g));
  for (const match of bracketMatches) {
    const originalFullMatch = match[0];
    const candidateVerse = match[1].trim();

    const verified = await searchAndVerifyQuranVerse(candidateVerse);
    if (verified) {
      const replacement = `﴿${verified.uthmaniText}﴾ [${verified.surahName}: الآية ${verified.numberInSurah}]`;
      updatedText = updatedText.replace(originalFullMatch, replacement);
    }
  }

  // 2. Match verses following phrases like: قال تعالى / قوله تعالى / في التنزيل العزيز: "..." or «...»
  const quotePattern = /(?:قال\s+تعالى|قوله\s+تعالى|قول\s+الله\s+تعالى|كقوله\s+تعالى|في\s+قوله\s+تعالى|الآية\s+الكريمة)[\s:،]*([«"“][^»"”]{8,}[»"”])/gu;
  const quoteMatches = Array.from(updatedText.matchAll(quotePattern));

  for (const match of quoteMatches) {
    const quotedString = match[1];
    const rawVerse = quotedString.replace(/^[«"“]|[\s»"”]+$/g, '').trim();

    // Skip if already converted to ﴿...﴾
    if (rawVerse.startsWith('﴿') || quotedString.startsWith('﴿')) {
      continue;
    }

    const verified = await searchAndVerifyQuranVerse(rawVerse);
    if (verified) {
      const replacement = `﴿${verified.uthmaniText}﴾ [${verified.surahName}: الآية ${verified.numberInSurah}]`;
      updatedText = updatedText.replace(quotedString, replacement);
    }
  }

  return updatedText;
}
