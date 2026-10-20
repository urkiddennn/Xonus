import type { GenerateContentConfig, GoogleGenAI } from '@google/genai';

/**
 * Tuning knobs for the Xonus decision engine.
 *
 * Only `apiKey` is required. Everything else has a safe default, which makes
 * Xonus portable across projects: the same call site can run in a script, an
 * API route, a serverless function, or a browser bundle.
 */
export interface XonusConfig {
  /** Google AI Studio API key. Can be omitted only when a custom `client` is supplied. */
  apiKey?: string;
  /** Gemini model used for decisions. Default: `gemini-2.5-flash`. */
  modelName?: string;
  /** Log-odds early-stop threshold between the top two options. Default: `6.0`. */
  tau?: number;
  /** Minimum probability mass placed on valid options to pass the quality gate. Default: `0.99`. */
  answerMassGate?: number;
  /** Number of top candidate tokens requested per step. Default: `20`. Max: `20`. */
  topLogprobs?: number;
  /** Token budget for the optional deliberation pass. Default: `512`. */
  maxOutputTokens?: number;
  /** Sampling temperature for the deliberation pass. The fast pass is always `0`. Default: `0`. */
  temperature?: number;
  /** Escalate uncertain decisions to a second, deliberate pass. Default: `true`. */
  escalate?: boolean;
  /** Return the model's short justification when one was generated. Default: `true`. */
  includeRationale?: boolean;
  /** Per-decision deadline in milliseconds. Default: `30000`. */
  timeoutMs?: number;
  /** Retries for retryable Gemini failures (429, 5xx, network). Default: `2`. */
  maxRetries?: number;
  /** Extra Gemini generation config. Xonus always forces logprobs on. */
  generationConfig?: GenerateContentConfig;
  /** Pre-built `GoogleGenAI` instance (useful for proxies, tests, or custom auth). */
  client?: GoogleGenAI;
}

/** A single multiple-choice decision. */
export interface DecisionRequest {
  /** Optional context: retrieved documents, conversation state, user profile, etc. */
  state?: string;
  /** The question to decide. */
  question: string;
  /** Two to twenty-six options. The model picks one of them. */
  options: string[];
  /** Cancel the decision (and its in-flight Gemini request). */
  signal?: AbortSignal;
}

/** The result of a decision, including the evidence behind it. */
export interface DecisionResponse {
  /** The chosen option, verbatim from `DecisionRequest.options`. */
  decision: string;
  /** Normalized probability for every option, keyed by the option text. Sums to 1 when evidence exists. */
  probabilities: Record<string, number>;
  /** Probability assigned to the chosen option. */
  confidence: number;
  /** Log-odds margin between the top two options. Higher means more decisive. */
  logOdds: number;
  /** Raw probability mass the model put on valid option tokens (0 to 1). */
  answerMass: number;
  /** Whether `answerMass >= answerMassGate`. */
  gatePassed: boolean;
  /** Whether `logOdds >= tau`. */
  decisive: boolean;
  /** Whether the decision passed the gate and was decisive. */
  confident: boolean;
  /** Zero-based index of the chosen option. */
  optionIndex: number;
  /** Whether a deliberation pass ran. */
  escalated: boolean;
  /** Whether generation stopped as soon as the decision was settled. */
  earlyStopped: boolean;
  /** Number of Gemini passes used (1 or 2). */
  passes: 1 | 2;
  /** Where the final evidence came from. */
  source: 'fast' | 'deliberate' | 'text';
  /** The model that produced the decision. */
  model: string;
  /** Wall-clock latency in milliseconds. */
  latencyMs: number;
  /** A short, user-facing justification, when available. */
  rationale?: string;
  /** Non-fatal diagnostics (for example, a fallback that was used). */
  notes: string[];
}

/** Options for `Xonus.decideBatch`. */
export interface DecideBatchOptions {
  /** Maximum concurrent decisions. Default: `4`. */
  concurrency?: number;
  /** Cancel every decision in the batch. */
  signal?: AbortSignal;
}

export type { GenerateContentConfig, GoogleGenAI };
