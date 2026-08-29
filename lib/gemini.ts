import { GoogleGenAI } from '@google/genai';
import { serverLog } from './log';
import { DAILY_QUOTA_ERROR_PREFIX } from './types';

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  throw new Error('GEMINI_API_KEY is not set');
}

// Bounded per-request timeout and a small retry budget — the SDK's defaults
// (5 attempts, up to 60s backoff each) can leave a single call hanging for
// several minutes on a transient error, which just leaves the UI stuck.
const ai = new GoogleGenAI({
  apiKey,
  httpOptions: {
    timeout: 45_000,
    retryOptions: { attempts: 2, initialDelay: 1, maxDelay: 8 },
  },
});

export const MODEL = process.env.GEMINI_MODEL ?? 'gemini-2.5-flash';

export type GeminiPart =
  | { text: string }
  | { inlineData: { mimeType: string; data: string } };

/** Strips a data URL prefix, returning { mimeType, data } for inlineData parts. */
export function dataUrlToPart(dataUrl: string): GeminiPart {
  const match = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
  if (!match) throw new Error('Invalid data URL');
  return { inlineData: { mimeType: match[1], data: match[2] } };
}

// Every call in this process — across every route handler, even ones running
// concurrently — funnels through this one rolling-window limiter so the app
// self-paces instead of firing a burst that eats 429s. In practice a
// free-tier key's binding limit is usually a small *daily* request cap
// (see isDailyQuotaExhausted below), not requests-per-minute — verified
// against a live key, which allowed 10/min with no rate-limit 429 at all.
// This just needs to stay under whatever the real per-minute ceiling is; it
// doesn't need to be conservative for the daily cap's sake, since pacing
// slower doesn't make more daily quota available, it only adds wall-clock
// latency for no benefit.
const RPM_LIMIT = Number(process.env.GEMINI_RPM_LIMIT ?? 10);
const callTimestamps: number[] = [];

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForRateLimitSlot(): Promise<void> {
  for (;;) {
    const now = Date.now();
    while (callTimestamps.length && now - callTimestamps[0] > 60_000) callTimestamps.shift();
    if (callTimestamps.length < RPM_LIMIT) {
      callTimestamps.push(now);
      return;
    }
    const waitMs = 60_000 - (now - callTimestamps[0]) + 250;
    serverLog(`[gemini] at ${RPM_LIMIT}/min rate limit, waiting ${(waitMs / 1000).toFixed(1)}s`);
    await sleep(waitMs);
  }
}

/** Pulls the server-suggested retry delay out of a 429's error body, if present. */
function extractRetryDelayMs(err: unknown): number | null {
  const message = err instanceof Error ? err.message : String(err);
  const match = /"retryDelay":"(\d+(?:\.\d+)?)s"/.exec(message) ?? /retry in (\d+(?:\.\d+)?)s/i.exec(message);
  return match ? Math.ceil(parseFloat(match[1]) * 1000) : null;
}

function isRateLimitError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return message.includes('RESOURCE_EXHAUSTED') || message.includes('"code":429') || message.includes('status: 429');
}

/**
 * A per-minute 429 is worth retrying — the window rolls forward. A per-DAY
 * quota (free-tier keys can cap a model at as few as 20 requests/day) is not:
 * every retry is guaranteed to hit the same wall, so 3 retries just means
 * burning ~3 minutes to fail anyway. Detect it and fail immediately instead.
 */
function isDailyQuotaExhausted(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return message.includes('GenerateRequestsPerDay');
}

/**
 * True for the specific Error this module throws when the daily quota is
 * exhausted (see below). Callers up the stack use this to tell "the whole
 * key is out for the day, stop retrying and degrading gracefully — surface
 * this loudly" apart from a one-off glitch on a single page/batch that's
 * fine to skip and move on from.
 */
export function isQuotaExhaustedError(err: unknown): boolean {
  return err instanceof Error && err.message.startsWith(DAILY_QUOTA_ERROR_PREFIX);
}

/**
 * Calls Gemini with a JSON response schema and parses the result.
 * - Every underlying call is paced by the shared rate limiter above.
 * - A 429 is retried (honoring the API's suggested delay) rather than
 *   treated as a hard failure — it's an expected, recoverable condition on
 *   a free-tier key, not a bug.
 * - Malformed JSON from the model gets one extra retry.
 */
export async function generateJson<T>(opts: {
  systemInstruction: string;
  parts: GeminiPart[];
  schema: object;
}): Promise<T> {
  const call = async (): Promise<string> => {
    const MAX_RATE_LIMIT_RETRIES = 3;
    for (let attempt = 0; ; attempt++) {
      await waitForRateLimitSlot();
      try {
        const response = await ai.models.generateContent({
          model: MODEL,
          contents: [{ role: 'user', parts: opts.parts as never }],
          config: {
            systemInstruction: opts.systemInstruction,
            responseMimeType: 'application/json',
            responseSchema: opts.schema as never,
            // Fully greedy (temperature 0) decoding can occasionally fall into a
            // repetition loop — e.g. emitting "\n" hundreds of times in a row
            // inside a string field until it runs out of budget. A touch of
            // temperature breaks exact-repeat loops almost entirely while
            // leaving output effectively deterministic for structured extraction.
            // (frequencyPenalty/presencePenalty are NOT supported on this model —
            // the API rejects the request outright with them set.)
            temperature: 0.15,
            maxOutputTokens: 8192,
          },
        });
        const text = response.text;
        if (!text) {
          const reason = response.candidates?.[0]?.finishReason;
          throw new Error(`Empty response from Gemini (finishReason: ${reason ?? 'unknown'})`);
        }
        return text;
      } catch (err) {
        if (isDailyQuotaExhausted(err)) {
          serverLog(`[gemini] daily quota exhausted for model "${MODEL}" — failing immediately, retrying won't help`);
          throw new Error(
            `${DAILY_QUOTA_ERROR_PREFIX} for model "${MODEL}". This resets in ~24h, or use a key/model with more quota (GEMINI_MODEL env var).`,
          );
        }
        if (isRateLimitError(err) && attempt < MAX_RATE_LIMIT_RETRIES) {
          const delay = extractRetryDelayMs(err) ?? 15_000;
          serverLog(`[gemini] 429 rate limited, retrying in ${(delay / 1000).toFixed(1)}s (attempt ${attempt + 1}/${MAX_RATE_LIMIT_RETRIES})`);
          await sleep(delay);
          continue;
        }
        throw err;
      }
    }
  };

  const text = await call();
  try {
    return JSON.parse(text) as T;
  } catch {
    console.warn('[gemini] malformed JSON, retrying once. Preview:', text.slice(0, 300));
    const retryText = await call();
    return JSON.parse(retryText) as T;
  }
}
