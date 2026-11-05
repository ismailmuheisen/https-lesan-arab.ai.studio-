/**
 * Strips Arabic diacritics (Harakat / Tashkeel / Tatweel) for accurate base letter comparison.
 */
export function stripDiacritics(text: string): string {
  if (!text) return '';
  return text
    // Remove Arabic Tashkeel: Fathatan, Dammatan, Kasratan, Fatha, Damma, Kasra, Shadda, Sukun
    .replace(/[\u064B-\u065F]/g, '')
    // Remove Superscript Alef
    .replace(/\u0670/g, '')
    // Remove Quranic annotation signs
    .replace(/[\u06D6-\u06ED]/g, '')
    // Remove Tatweel (Kashida)
    .replace(/\u0640/g, '')
    // Normalize white spaces
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Compares two texts to check if their base letters match (ignoring diacritics).
 */
export function areBaseLettersEqual(input: string, output: string): boolean {
  return stripDiacritics(input) === stripDiacritics(output);
}

/**
 * Splits text into chunks of ~1500 characters at sentence boundaries
 * (periods, commas, semicolons, question/exclamation marks, or newlines)
 * so long Arabic texts can be reliably diacritized without degradation.
 */
export function splitIntoSentenceChunks(text: string, maxChunkLength = 1500): string[] {
  if (text.length <= maxChunkLength) {
    return [text];
  }

  const chunks: string[] = [];
  // Match sentences including their trailing punctuation / newline
  const sentenceRegex = /([^.،؛؟!؟\n]+[.،؛؟!؟\n]+|[^\n]+\n+)/g;
  const parts = text.match(sentenceRegex);

  if (!parts || parts.length === 0) {
    // Fallback: split by words
    const words = text.split(' ');
    let currentChunk = '';
    for (const word of words) {
      if ((currentChunk + ' ' + word).length > maxChunkLength && currentChunk) {
        chunks.push(currentChunk.trim());
        currentChunk = word;
      } else {
        currentChunk = currentChunk ? `${currentChunk} ${word}` : word;
      }
    }
    if (currentChunk) chunks.push(currentChunk.trim());
    return chunks;
  }

  let current = '';
  for (const part of parts) {
    if ((current + part).length > maxChunkLength && current) {
      chunks.push(current);
      current = part;
    } else {
      current += part;
    }
  }
  if (current) {
    chunks.push(current);
  }

  // Check if any leftover trailing text was not matched by sentence regex
  const reconstructed = chunks.join('');
  if (reconstructed.length < text.length) {
    const remainder = text.slice(reconstructed.length);
    if (remainder.trim()) {
      chunks.push(remainder);
    }
  }

  return chunks;
}
