import { vi } from 'vitest';
import type {
  GenerateContentParameters,
  GenerateContentResponse,
  GoogleGenAI,
} from '@google/genai';

export interface StepInput {
  /** Chosen token, e.g. `"A"`. */
  letter: string;
  /** Token spelling to probability map, e.g. `{ A: 0.999, B: 0.001 }`. */
  distribution: Record<string, number>;
  /** Text associated with the step's chunk. */
  text?: string;
}

export interface FakeClientOptions {
  generateContent?: (
    params: GenerateContentParameters,
  ) => Promise<GenerateContentResponse> | GenerateContentResponse;
  generateContentStream?: (
    params: GenerateContentParameters,
  ) => Promise<AsyncGenerator<GenerateContentResponse>> | AsyncGenerator<GenerateContentResponse>;
}

export interface FakeClient {
  client: GoogleGenAI;
  generateContent: ReturnType<typeof vi.fn>;
  generateContentStream: ReturnType<typeof vi.fn>;
}

/** Minimal structural fake of `GoogleGenAI` used to test Xonus without network. */
export function fakeClient(options: FakeClientOptions): FakeClient {
  const generateContent = vi.fn(async (params: GenerateContentParameters) => {
    if (!options.generateContent) throw new Error('generateContent not configured');
    return options.generateContent(params);
  });

  const generateContentStream = vi.fn(async (params: GenerateContentParameters) => {
    if (!options.generateContentStream) throw new Error('generateContentStream not configured');
    return options.generateContentStream(params);
  });

  return {
    client: { models: { generateContent, generateContentStream } } as unknown as GoogleGenAI,
    generateContent,
    generateContentStream,
  };
}

/** Build a Gemini response containing one decoding step. */
export function response(input: {
  letter?: string;
  distribution?: Record<string, number>;
  text?: string;
  withLogprobs?: boolean;
}): GenerateContentResponse {
  const { letter = 'A', distribution, text = letter, withLogprobs = true } = input;
  const logprobsResult =
    withLogprobs && distribution
      ? {
          topCandidates: [topCandidates(distribution)],
          chosenCandidates: [candidate(letter, distribution[letter] ?? 1)],
        }
      : undefined;

  return {
    candidates: [
      {
        content: { parts: text ? [{ text }] : [] },
        ...(logprobsResult ? { logprobsResult } : {}),
      },
    ],
  } as unknown as GenerateContentResponse;
}

/** Build a streamed chunk containing one decoding step. */
export function chunk(input: StepInput & { withLogprobs?: boolean }): GenerateContentResponse {
  const { letter, distribution, text = '', withLogprobs = true } = input;
  return {
    candidates: [
      {
        content: { parts: text ? [{ text }] : [] },
        ...(withLogprobs
          ? {
              logprobsResult: {
                topCandidates: [topCandidates(distribution)],
                chosenCandidates: [candidate(letter, distribution[letter] ?? 1)],
              },
            }
          : {}),
      },
    ],
  } as unknown as GenerateContentResponse;
}

/** Turn fixed chunks into the async generator Gemini returns. */
export async function* streamOf(
  chunks: GenerateContentResponse[],
): AsyncGenerator<GenerateContentResponse> {
  for (const item of chunks) yield item;
}

export function topCandidates(distribution: Record<string, number>) {
  return {
    candidates: Object.entries(distribution).map(([token, probability]) =>
      candidate(token, probability),
    ),
  };
}

function candidate(token: string, probability: number) {
  return {
    token,
    logProbability: probability > 0 ? Math.log(probability) : -Infinity,
  };
}

/** A two-option decision that the fake model answers instantly. */
export const confidentFastClient = (letter = 'A'): FakeClient =>
  fakeClient({
    generateContent: () =>
      response({
        letter,
        distribution: letter === 'A' ? { A: 0.999, B: 0.001 } : { A: 0.001, B: 0.999 },
      }),
  });
