/**
 * Provider-neutral request/response contract.
 *
 * Xonus only needs two things from a model: the generated text and, when the
 * provider exposes them, token-level log probabilities. Adapters translate
 * vendor APIs into this small shape so the decision protocol stays identical
 * across Gemini, OpenAI-compatible endpoints, Anthropic, and custom models.
 */

export type ProviderName =
  | 'gemini'
  | 'google'
  | 'openai'
  | 'openai-compatible'
  | 'anthropic';

/** One candidate token and its natural-log probability. */
export interface ProviderTokenCandidate {
  token: string;
  logProbability: number;
}

/** The candidates observed at one decoding step. */
export interface ProviderLogprobStep {
  /** The token the model actually generated at this step, when known. */
  chosenToken?: string;
  /** Top candidate tokens at this step. */
  candidates: ProviderTokenCandidate[];
}

/** One model response chunk: text plus any logprob steps it contained. */
export interface ProviderChunk {
  text: string;
  steps: ProviderLogprobStep[];
}

/** Everything an adapter needs to make one model call. */
export interface ProviderRequest {
  model: string;
  systemInstruction: string;
  prompt: string;
  temperature: number;
  maxOutputTokens: number;
  topLogprobs: number;
  /** Ask the provider for logprobs. Adapters ignore this when unsupported. */
  logprobs: boolean;
  signal: AbortSignal;
  /** Gemini-only generation config, forwarded by the Gemini adapter. */
  generationConfig?: Record<string, unknown>;
  /** Extra vendor-specific request fields, merged into the request body. */
  providerOptions?: Record<string, unknown>;
}

/**
 * Implement this interface to use any model that is not covered by the
 * built-in adapters. `stream` may yield a single chunk for models that do not
 * support streaming.
 */
export interface XonusProvider {
  /** Stable identifier surfaced on `DecisionResponse.provider`. */
  readonly id: string;
  generate(request: ProviderRequest): Promise<ProviderChunk>;
  stream(request: ProviderRequest): Promise<AsyncIterable<ProviderChunk>>;
}

/** Shared adapter configuration. */
export interface ProviderConfig {
  apiKey?: string;
  baseURL?: string;
  headers?: Record<string, string>;
  fetch?: typeof fetch;
}
