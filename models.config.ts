import { GoogleGenAI } from '@google/genai';

export interface ModelCategoryConfig {
  deepSearch: string[];
  tashkeel: string[];
  art: string[];
  speech: string[];
}

/**
 * Hardcoded, battle-tested sensible defaults for zero-configuration operation.
 * Used whenever environment variables are not provided.
 */
export const HARDCODED_DEFAULTS: Record<keyof ModelCategoryConfig, string[]> = {
  deepSearch: ['gemini-3.8-flash', 'gemini-3.1-flash-lite', 'gemini-flash-latest'],
  tashkeel: ['gemini-3.8-flash', 'gemini-3.1-flash-lite', 'gemini-flash-latest'],
  art: ['gemini-3.1-flash-lite-image', 'gemini-nano-banana-2.1', 'gemini-3-pro-image'],
  speech: ['gemini-3.8-flash-lite-tts', 'gemini-3.8-flash-tts'],
};

/**
 * Parses optional comma-separated environment variables into a list of model IDs.
 * If the env variable is missing, empty, or whitespace, falls back to hardcoded defaults.
 */
function parseOptionalEnvModels(envValue: string | undefined, defaultList: string[]): string[] {
  if (!envValue || typeof envValue !== 'string' || !envValue.trim()) {
    return [...defaultList];
  }
  const parsed = envValue
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
  return parsed.length > 0 ? parsed : [...defaultList];
}

// Fully optional configuration with automatic hardcoded fallbacks
export const defaultModelConfig: ModelCategoryConfig = {
  deepSearch: parseOptionalEnvModels(process.env.MODELS_DEEP_SEARCH, HARDCODED_DEFAULTS.deepSearch),
  tashkeel: parseOptionalEnvModels(process.env.MODELS_TASHKEEL, HARDCODED_DEFAULTS.tashkeel),
  art: parseOptionalEnvModels(process.env.MODELS_ART, HARDCODED_DEFAULTS.art),
  speech: parseOptionalEnvModels(process.env.MODELS_SPEECH, HARDCODED_DEFAULTS.speech),
};

// Active validated models list (filtered by startup API check)
let activeModels: ModelCategoryConfig = {
  deepSearch: [...defaultModelConfig.deepSearch],
  tashkeel: [...defaultModelConfig.tashkeel],
  art: [...defaultModelConfig.art],
  speech: [...defaultModelConfig.speech],
};

// 404 memory cache: modelName -> expiration timestamp (10 minutes)
const model404Cache = new Map<string, number>();
const CACHE_404_DURATION_MS = 10 * 60 * 1000;

export function recordModel404(modelName: string): void {
  const expiresAt = Date.now() + CACHE_404_DURATION_MS;
  model404Cache.set(modelName, expiresAt);
  console.warn(`[models] Model '${modelName}' recorded 404. Skipping for 10 minutes (until ${new Date(expiresAt).toISOString()}).`);
}

export function isModel404Cached(modelName: string): boolean {
  const expiresAt = model404Cache.get(modelName);
  if (!expiresAt) return false;
  if (Date.now() > expiresAt) {
    model404Cache.delete(modelName);
    return false;
  }
  return true;
}

/**
 * Returns candidate models for a category, skipping 404-cached models
 * and capping at max 3 total attempts per request.
 * If all candidate models in a category are temporarily cached as 404,
 * falls back to the primary hardcoded default to avoid starvation.
 */
export function getCandidateModels(category: keyof ModelCategoryConfig, maxAttempts = 3): string[] {
  const list = activeModels[category] || defaultModelConfig[category] || HARDCODED_DEFAULTS[category];
  const candidates = list.filter((modelName) => !isModel404Cached(modelName)).slice(0, maxAttempts);

  if (candidates.length > 0) {
    return candidates;
  }

  // Graceful fallback: return the primary hardcoded model if all were cached as 404
  return [HARDCODED_DEFAULTS[category][0]];
}

/**
 * At startup, calls ai.models.list() to verify which configured models actually exist.
 * Logs available vs configured, and filters active lists to skip unavailable ones.
 */
export async function initializeAndVerifyModels(ai: GoogleGenAI): Promise<void> {
  console.log('[models] Initializing model registry and querying Gemini models list API...');

  try {
    const listResult = await ai.models.list();
    const availableModelNames = new Set<string>();

    for await (const m of listResult) {
      if (m.name) {
        availableModelNames.add(m.name);
        // Add name without 'models/' prefix
        availableModelNames.add(m.name.replace(/^models\//, ''));
      }
    }

    if (availableModelNames.size === 0) {
      console.warn('[models] Gemini list API returned empty model set. Retaining default hardcoded models.');
      return;
    }

    console.log(`[models] Found ${availableModelNames.size} available models from Gemini API.`);

    const filterCategory = (category: keyof ModelCategoryConfig, configuredList: string[]): string[] => {
      const verified = configuredList.filter((name) => availableModelNames.has(name) || availableModelNames.has(`models/${name}`));
      const missing = configuredList.filter((name) => !availableModelNames.has(name) && !availableModelNames.has(`models/${name}`));

      console.log(`[models] Category '${category}': Configured: [${configuredList.join(', ')}] | Available: [${verified.join(', ')}] | Missing/Skipped: [${missing.join(', ')}]`);

      // If at least one verified model exists, use verified; otherwise fallback to hardcoded default
      return verified.length > 0 ? verified : HARDCODED_DEFAULTS[category];
    };

    activeModels = {
      deepSearch: filterCategory('deepSearch', defaultModelConfig.deepSearch),
      tashkeel: filterCategory('tashkeel', defaultModelConfig.tashkeel),
      art: filterCategory('art', defaultModelConfig.art),
      speech: filterCategory('speech', defaultModelConfig.speech),
    };

    console.log('[models] Active verified model configuration ready.');
  } catch (error: any) {
    console.warn('[models] Model list API check skipped or unavailable. Running with hardcoded defaults:', error?.message || error);
  }
}

/**
 * Utility to run an async operation with a 30s timeout per attempt
 */
export async function withAttemptTimeout<T>(promise: Promise<T>, timeoutMs = 30000): Promise<T> {
  let timer: NodeJS.Timeout;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      const err: any = new Error(`Request timed out after ${timeoutMs / 1000} seconds`);
      err.code = 'ETIMEDOUT';
      reject(err);
    }, timeoutMs);
  });

  return Promise.race([
    promise.finally(() => clearTimeout(timer)),
    timeoutPromise,
  ]);
}
