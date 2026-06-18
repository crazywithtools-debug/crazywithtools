import { NextRequest, NextResponse } from 'next/server';
import { error as logError } from '@/lib/logger';
import { GoogleGenAI, Type } from '@google/genai';
import type { GenerateRequestBody, GenerateResponseBody, GenerateErrorBody } from '@/types';

// Ordered fallback chain: tried in sequence if the previous model/attempt fails.
// Flash-lite models are fast & cheap, used as a fallback if the primary is
// overloaded or rate limited.
const MODEL_CHAIN = (process.env.GEN_MODEL_CHAIN && process.env.GEN_MODEL_CHAIN.split(',')) || [
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-2.0-flash',
];

const REQUEST_TIMEOUT_MS = Number(process.env.GEN_REQUEST_TIMEOUT_MS || 180_000);
const MAX_ATTEMPTS_PER_MODEL = 2;

// Tunable defaults for generation quality and length. Can be overridden via
// environment variables: GEN_MAX_OUTPUT_TOKENS, GEN_TEMPERATURE.
const DEFAULT_GEN_MAX_OUTPUT_TOKENS = Number(process.env.GEN_MAX_OUTPUT_TOKENS || 8000);
const DEFAULT_GEN_TEMPERATURE = Number(process.env.GEN_TEMPERATURE || 0.28);

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description:
        'A unique, catchy, SEO and Google-friendly title for the content.',
    },
    content: {
      type: Type.STRING,
      description:
        'The main body of the content, formatted in HTML using <p>, <ul>, <li>, <h2>, <h3>, <strong> tags where appropriate. Make it engaging, informative, and original.',
    },
  },
  required: ['title', 'content'],
};

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Request timed out')), ms);
    promise
      .then((val) => {
        clearTimeout(timer);
        resolve(val);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableError(err: unknown): boolean {
  const message = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
  return (
    message.includes('overloaded') ||
    message.includes('503') ||
    message.includes('429') ||
    message.includes('rate limit') ||
    message.includes('timed out') ||
    message.includes('timeout') ||
    message.includes('internal') ||
    message.includes('500') ||
    message.includes('unavailable') ||
    message.includes('fetch failed') ||
    message.includes('network')
  );
}

function safeJsonParse(text: string): { title?: string; content?: string } | null {
  // Strip markdown code fences if the model wraps the JSON despite instructions
  let cleaned = text.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(json)?/i, '').replace(/```$/, '').trim();
  }

  try {
    return JSON.parse(cleaned);
  } catch {
    // Attempt to extract the first {...} block as a last resort
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {
        return null;
      }
    }
    return null;
  }
}

export async function POST(req: NextRequest) {
  let body: GenerateRequestBody;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json<GenerateErrorBody>(
      { error: 'Invalid JSON request body.' },
      { status: 400 }
    );
  }

  const { prompt, apiKey } = body;

  if (!prompt || !prompt.trim()) {
    return NextResponse.json<GenerateErrorBody>(
      { error: 'A prompt is required.' },
      { status: 400 }
    );
  }

  // Accept multiple environment variable names to avoid deployment mismatches.
  // Some deployments set `GENAI_API_KEY` or expose a public key as
  // `NEXT_PUBLIC_GENAI_API_KEY`. We prefer a server-side secret `GEMINI_API_KEY`.
  const resolvedKey =
    (apiKey && apiKey.trim()) ||
    process.env.GEMINI_API_KEY ||
    process.env.GENAI_API_KEY ||
    process.env.NEXT_PUBLIC_GENAI_API_KEY ||
    '';

  if (!resolvedKey) {
    return NextResponse.json<GenerateErrorBody>(
      {
        error:
          'No AI API key configured. Provide one in the request or set GEMINI_API_KEY on the server.',
      },
      { status: 400 }
    );
  }

  const ai = new GoogleGenAI({ apiKey: resolvedKey });

  let lastError: unknown = null;

  for (const model of MODEL_CHAIN) {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS_PER_MODEL; attempt++) {
      try {
        const response = await withTimeout(
          ai.models.generateContent({
            model,
            contents: prompt,
            config: {
              responseMimeType: 'application/json',
              responseSchema: RESPONSE_SCHEMA,
              // Request longer, focused outputs and reduce randomness for
              // more consistent marketing copy.
              maxOutputTokens: DEFAULT_GEN_MAX_OUTPUT_TOKENS,
              temperature: DEFAULT_GEN_TEMPERATURE,
              candidateCount: 1,
            },
          }) as Promise<{ text?: string }>,
          REQUEST_TIMEOUT_MS
        );

        const text = typeof response === 'object' && response !== null && 'text' in response && typeof response.text === 'string'
          ? response.text
          : '';
        const parsed = safeJsonParse(text);

        if (parsed?.title && parsed?.content) {
          return NextResponse.json<GenerateResponseBody>({
            title: parsed.title,
            content: parsed.content,
          });
        }

        // Got a response but it didn't match the expected shape.
        lastError = new Error(
          `Model "${model}" returned an unexpected response shape.`
        );
        // Don't retry the same model again for a malformed (but successful) response —
        // move to the next model in the chain instead.
        break;
      } catch (err) {
        lastError = err;
        logError(
          `[generate] model=${model} attempt=${attempt} failed:`,
          err instanceof Error ? err.message : err
        );

        if (!isRetryableError(err)) {
          // Non-retryable error (e.g. bad API key, invalid request) — stop entirely.
          const message = err instanceof Error ? err.message : 'Generation failed.';
          return NextResponse.json<GenerateErrorBody>(
            { error: message },
            { status: 502 }
          );
        }

        if (attempt < MAX_ATTEMPTS_PER_MODEL) {
          // Exponential-ish backoff before retrying same model
          await sleep(500 * attempt);
        }
        // otherwise fall through to next model
      }
    }
  }

  const message =
    lastError instanceof Error
      ? lastError.message
      : 'All generation attempts failed.';

  return NextResponse.json<GenerateErrorBody>(
    { error: `Generation failed after trying all available models: ${message}` },
    { status: 502 }
  );
}
