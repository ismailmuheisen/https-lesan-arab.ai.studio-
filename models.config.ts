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
  console.log(`[models] Model '${modelName}' recorded 404. Skipping for 10 minutes.`);
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

// Cooldown memory cache for 503/429 errors: modelName -> expiration timestamp (60 seconds)
const modelCooldownCache = new Map<string, number>();
const modelRecent503or429Failures = new Map<string, number>();
const COOLDOWN_DURATION_MS = 60 * 1000;

export function recordModelCooldown(modelName: string): void {
  const expiresAt = Date.now() + COOLDOWN_DURATION_MS;
  modelCooldownCache.set(modelName, expiresAt);
  console.log(`[fallback] Model ${modelName} hit 503/429 limits twice. Cooled down for 60s.`);
}

export function register503or429Failure(modelName: string): void {
  const currentCount = (modelRecent503or429Failures.get(modelName) || 0) + 1;
  modelRecent503or429Failures.set(modelName, currentCount);
  if (currentCount >= 2) {
    recordModelCooldown(modelName);
    modelRecent503or429Failures.delete(modelName);
  }
}

export function registerModelSuccess(modelName: string): void {
  modelRecent503or429Failures.delete(modelName);
}

export function isModelCoolingDown(modelName: string): boolean {
  const expiresAt = modelCooldownCache.get(modelName);
  if (!expiresAt) return false;
  if (Date.now() > expiresAt) {
    modelCooldownCache.delete(modelName);
    return false;
  }
  return true;
}

/**
 * Checks whether an error is retryable (503, 429, or 500) and whether it is a rate/availability issue.
 */
export function isRetryableError(err: any): { retryable: boolean; status?: number; isRateOrUnavailable: boolean } {
  const status = Number(err?.status) || (err?.code === 429 || err?.code === 503 || err?.code === 500 ? Number(err.code) : undefined);
  const msg = (err?.message || '').toLowerCase();

  const is503 = status === 503 || msg.includes('503') || msg.includes('unavailable');
  const is429 = status === 429 || msg.includes('429') || msg.includes('resource_exhausted') || msg.includes('quota');
  const is500 = status === 500 || msg.includes('500') || msg.includes('internal error');

  if (is503) return { retryable: true, status: 503, isRateOrUnavailable: true };
  if (is429) return { retryable: true, status: 429, isRateOrUnavailable: true };
  if (is500) return { retryable: true, status: 500, isRateOrUnavailable: false };

  return { retryable: false, status, isRateOrUnavailable: false };
}

/**
 * Returns candidate models for a category:
 * 1. Excludes models that returned 404 (cached for 10m).
 * 2. Prioritizes normal models first, placing cooling-down models last.
 * 3. Limits the list up to maxModels.
 */
export function getCandidateModels(category: keyof ModelCategoryConfig, maxModels = 4): string[] {
  const list = activeModels[category] || defaultModelConfig[category] || HARDCODED_DEFAULTS[category];

  // Exclude 404 models
  const validModels = list.filter((modelName) => !isModel404Cached(modelName));

  if (validModels.length === 0) {
    return [HARDCODED_DEFAULTS[category][0]];
  }

  // Ready models first; cooling down models tried last
  const readyModels = validModels.filter((modelName) => !isModelCoolingDown(modelName));
  const coolingDownModels = validModels.filter((modelName) => isModelCoolingDown(modelName));

  const prioritized = [...readyModels, ...coolingDownModels];
  return prioritized.slice(0, maxModels);
}

/**
 * Executes a unary model call with resilient fallback:
 * - Retries the SAME model once after a random 1-2s delay on 503/429/500 errors.
 * - If a model returns 503 or 429 twice, marks it as cooling down for 60 seconds (skipped first, tried last).
 * - Caps total attempts per request at max 4.
 * - Logs each decision in one concise line.
 */
export async function executeWithModelFallback<T>(
  category: keyof ModelCategoryConfig,
  executeFn: (modelId: string) => Promise<T>
): Promise<T> {
  const candidateModels = getCandidateModels(category, 4);
  let totalAttempts = 0;
  const MAX_TOTAL_ATTEMPTS = 4;
  let lastError: any = null;

  for (const modelId of candidateModels) {
    if (totalAttempts >= MAX_TOTAL_ATTEMPTS) {
      console.log(`[fallback] Reached max ${MAX_TOTAL_ATTEMPTS} attempts for ${category}.`);
      break;
    }

    // Attempt 1 for this model
    totalAttempts++;
    console.log(`[fallback] Trying model ${modelId} for ${category} (attempt ${totalAttempts}/${MAX_TOTAL_ATTEMPTS})...`);

    try {
      const result = await withAttemptTimeout(executeFn(modelId), 30000);
      registerModelSuccess(modelId);
      return result;
    } catch (err: any) {
      lastError = err;

      if (err?.message === 'CONTENT_SAFETY_BLOCKED') {
        throw err;
      }

      if (err?.status === 404 || err?.message?.includes('404') || err?.message?.toLowerCase().includes('not found')) {
        recordModel404(modelId);
        continue;
      }

      const retryInfo = isRetryableError(err);
      if (retryInfo.isRateOrUnavailable) {
        register503or429Failure(modelId);
      }

      if (retryInfo.retryable && totalAttempts < MAX_TOTAL_ATTEMPTS) {
        const delayMs = Math.floor(1000 + Math.random() * 1000);
        console.log(`[fallback] Model ${modelId} failed with ${retryInfo.status}. Retrying same model after ${delayMs}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delayMs));

        totalAttempts++;
        try {
          const retryResult = await withAttemptTimeout(executeFn(modelId), 30000);
          registerModelSuccess(modelId);
          return retryResult;
        } catch (retryErr: any) {
          lastError = retryErr;

          if (retryErr?.message === 'CONTENT_SAFETY_BLOCKED') {
            throw retryErr;
          }

          const retry2Info = isRetryableError(retryErr);
          if (retry2Info.isRateOrUnavailable) {
            register503or429Failure(modelId);
          }
          console.log(`[fallback] Model ${modelId} failed retry (${retryErr?.status || 'error'}). Moving to next model.`);
        }
      } else {
        console.log(`[fallback] Model ${modelId} failed (${err?.status || 'error'}). Moving to next model.`);
      }
    }
  }

  throw lastError || new Error('ALL_MODELS_FAILED');
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
