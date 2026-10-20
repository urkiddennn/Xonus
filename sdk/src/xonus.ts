import { GoogleGenAI } from '@google/genai';
import type {
  GenerateContentConfig,
  GenerateContentResponse,
} from '@google/genai';
import {
  XonusAbortError,
  XonusConfigError,
  XonusError,
  XonusInputError,
  XonusParseError,
  XonusTimeoutError,
} from './errors';
import {
  extractLabelDistribution,
  extractRationale,
  normalizeToken,
  parseAnswerLetter,
} from './logprobs';
import type { LabelDistribution } from './logprobs';
import { buildDeliberatePrompt, buildFastPrompt, optionLetters } from './prompt';
import type {
  DecideBatchOptions,
  DecisionRequest,
  DecisionResponse,
  XonusConfig,
} from './types';
import {
  anySignal,
  createDeadline,
  throwIfAborted,
  toApiError,
  withRetry,
} from './utils';

export const DEFAULT_MODEL = 'gemini-2.5-flash';
export const DEFAULT_TAU = 6.0;
export const DEFAULT_ANSWER_MASS_GATE = 0.99;

const FAST_MAX_OUTPUT_TOKENS = 32;
const FAST_THINKING_BUDGET = 0;

interface ResolvedOptions {
  modelName: string;
  tau: number;
  answerMassGate: number;
  topLogprobs: number;
  maxOutputTokens: number;
  temperature: number;
  escalate: boolean;
  includeRationale: boolean;
  timeoutMs: number;
  maxRetries: number;
  generationConfig?: GenerateContentConfig;
}

interface PassEvidence {
  distribution: LabelDistribution;
  text: string;
  source: 'fast' | 'deliberate' | 'text';
}

interface DeliberateResult {
  evidence: PassEvidence;
  earlyStopped: boolean;
}

/**
 * Xonus turns a stochastic language model into a calibrated multiple-choice
 * decision engine.
 *
 * 1. A fast pass asks for a single option letter and reads the token-level
 *    logprobs. If the log-odds margin clears `tau`, the decision is returned
 *    immediately — no reasoning tokens are generated.
 * 2. Otherwise, the decision escalates to a short deliberation pass. Xonus
 *    streams it, watches the logprobs at the final answer token, and stops the
 *    stream as soon as the margin clears `tau`.
 * 3. Every decision is checked by `answerMassGate`: the probability mass the
 *    model put on *valid* options. If that mass is too low, `confident` is
 *    `false`, so callers can route to a human or a stronger model.
 */
export class Xonus {
  private readonly client: GoogleGenAI;
  private readonly options: ResolvedOptions;

  constructor(config: XonusConfig) {
    this.options = resolveOptions(config);
    this.client = config.client ?? new GoogleGenAI({ apiKey: config.apiKey });
  }

  /** Build a client from `XONUS_API_KEY`, `GEMINI_API_KEY`, or `GOOGLE_API_KEY`. */
  static fromEnv(
    overrides: Omit<Partial<XonusConfig>, 'apiKey'> & { apiKey?: string } = {},
  ): Xonus {
    const env = typeof process !== 'undefined' ? process.env : undefined;
    const apiKey =
      overrides.apiKey ??
      env?.XONUS_API_KEY ??
      env?.GEMINI_API_KEY ??
      env?.GOOGLE_API_KEY;

    if (!apiKey && !overrides.client) {
      throw new XonusConfigError(
        'No API key found. Pass `apiKey`, set XONUS_API_KEY, GEMINI_API_KEY, or GOOGLE_API_KEY.',
      );
    }

    return new Xonus({ ...overrides, apiKey: apiKey ?? '' });
  }

  /** Decide one multiple-choice question. */
  async decide(request: DecisionRequest): Promise<DecisionResponse> {
    const startedAt = Date.now();
    const normalized = validateRequest(request);
    const letters = optionLetters(normalized.options.length);
    const deadline = createDeadline(normalized.signal, this.options.timeoutMs);
    const notes: string[] = [];

    try {
      throwIfAborted(deadline.signal);

      const fast = await this.runFast(normalized, letters, deadline.signal);
      const fastAccepted = this.isAccepted(fast);
      const escalate = this.options.escalate && !fastAccepted;

      let evidence = fast;
      let earlyStopped = fastAccepted;
      let escalated = false;

      if (escalate) {
        escalated = true;
        const deliberate = await this.runDeliberate(
          normalized,
          letters,
          fast,
          notes,
          deadline.signal,
        );
        evidence = deliberate.evidence;
        earlyStopped = deliberate.earlyStopped;
      }

      throwIfAborted(deadline.signal);
      return this.buildResponse({
        normalized,
        letters,
        evidence,
        escalated,
        earlyStopped,
        notes,
        startedAt,
      });
    } catch (error) {
      throw this.normalizeError(error, deadline, normalized.signal);
    } finally {
      deadline.cleanup();
    }
  }

  /** Decide many questions with bounded concurrency, preserving input order. */
  async decideBatch(
    requests: DecisionRequest[],
    options: DecideBatchOptions = {},
  ): Promise<DecisionResponse[]> {
    if (!Array.isArray(requests)) {
      throw new XonusInputError('`requests` must be an array of decisions.');
    }

    const concurrency = options.concurrency ?? 4;
    if (!Number.isInteger(concurrency) || concurrency < 1) {
      throw new XonusInputError('`concurrency` must be a positive integer.');
    }

    const results = new Array<DecisionResponse>(requests.length);
    let cursor = 0;

    const worker = async (): Promise<void> => {
      for (;;) {
        const index = cursor;
        cursor += 1;
        if (index >= requests.length) return;

        const request = requests[index];
        if (!request) continue;

        results[index] = await this.decide({
          ...request,
          signal: anySignal([request.signal, options.signal]),
        });
      }
    };

    await Promise.all(
      Array.from({ length: Math.min(concurrency, requests.length) }, () => worker()),
    );

    return results;
  }

  private isAccepted(evidence: PassEvidence): boolean {
    const gatePassed = evidence.distribution.mass >= this.options.answerMassGate;
    const decisive = evidence.distribution.margin >= this.options.tau;
    return gatePassed && decisive;
  }

  private async runFast(
    request: DecisionRequest,
    letters: readonly string[],
    signal: AbortSignal,
  ): Promise<PassEvidence> {
    const prompt = buildFastPrompt(request, letters);

    const response = await withRetry(
      () =>
        this.client.models.generateContent({
          model: this.options.modelName,
          contents: prompt.contents,
          config: {
            ...this.generationConfig(),
            systemInstruction: prompt.systemInstruction,
            temperature: 0,
            maxOutputTokens: FAST_MAX_OUTPUT_TOKENS,
            candidateCount: 1,
            responseLogprobs: true,
            logprobs: this.options.topLogprobs,
            thinkingConfig: this.thinkingConfig(),
            abortSignal: signal,
          },
        }),
      { retries: this.options.maxRetries, signal },
    );

    const text = responseText(response);
    const logprobs = response.candidates?.[0]?.logprobsResult;
    const steps = logprobs?.topCandidates ?? [];
    const chosen = logprobs?.chosenCandidates ?? [];

    // The first token is not always the letter: some tokenizers emit a leading
    // space or markdown marker first. Use the first step whose *chosen* token
    // is an option letter, then read that step's distribution.
    let distribution: LabelDistribution = {
      probabilities: {},
      mass: 0,
      margin: 0,
      top: null,
    };
    for (let index = 0; index < steps.length; index += 1) {
      const step = steps[index];
      if (!step) continue;

      const chosenLetter = normalizeToken(chosen[index]?.token);
      if (chosen.length > 0 && (!chosenLetter || !letters.includes(chosenLetter))) {
        continue;
      }

      const candidate = extractLabelDistribution(step, letters);
      if (candidate.mass > 0) {
        distribution = candidate;
        break;
      }
    }

    if (distribution.mass <= 0) {
      const letter = parseAnswerLetter(text, letters);
      distribution = {
        probabilities: {},
        mass: 0,
        margin: 0,
        top: letter,
      };
    }

    return {
      distribution,
      text,
      source: distribution.mass > 0 ? 'fast' : 'text',
    };
  }

  private async runDeliberate(
    request: DecisionRequest,
    letters: readonly string[],
    fast: PassEvidence,
    notes: string[],
    signal: AbortSignal,
  ): Promise<DeliberateResult> {
    const prompt = buildDeliberatePrompt(request, letters);
    const streamAbort = new AbortController();
    const streamSignal = anySignal([signal, streamAbort.signal]);

    const stream = await withRetry(
      () =>
        this.client.models.generateContentStream({
          model: this.options.modelName,
          contents: prompt.contents,
          config: {
            ...this.generationConfig(),
            systemInstruction: prompt.systemInstruction,
            temperature: this.options.temperature,
            maxOutputTokens: this.options.maxOutputTokens,
            candidateCount: 1,
            responseLogprobs: true,
            logprobs: this.options.topLogprobs,
            thinkingConfig: this.thinkingConfig(),
            abortSignal: streamSignal,
          },
        }),
      { retries: this.options.maxRetries, signal: streamSignal },
    );

    let text = '';
    let earlyStopped = false;
    const labelSteps: Array<{ letter: string; distribution: LabelDistribution }> = [];

    try {
      for await (const chunk of stream) {
        const candidate = chunk.candidates?.[0];
        if (!candidate) continue;

        text += candidateText(candidate);
        const stepLogprobs = candidate.logprobsResult;
        const steps = stepLogprobs?.topCandidates ?? [];
        const chosen = stepLogprobs?.chosenCandidates ?? [];

        for (let index = 0; index < steps.length; index += 1) {
          const step = steps[index];
          if (!step) continue;

          const distribution = extractLabelDistribution(step, letters);
          if (distribution.mass <= 0 || !distribution.top) continue;

          const chosenLetter = normalizeToken(chosen[index]?.token) ?? distribution.top;
          if (!letters.includes(chosenLetter)) continue;

          labelSteps.push({ letter: chosenLetter, distribution });

          // Stop generating the moment the final answer is both present and
          // decisive. If the final answer is not yet in the text, keep reading.
          if (
            hasFinalAnswerProtocol(text, chosenLetter) &&
            distribution.margin >= this.options.tau
          ) {
            earlyStopped = true;
            streamAbort.abort();
            break;
          }
        }

        if (earlyStopped) break;
      }
    } catch (error) {
      if (!earlyStopped) throw error;
    }

    const finalLetter = parseAnswerLetter(text, letters);
    const matchingStep = finalLetter
      ? [...labelSteps].reverse().find((step) => step.letter === finalLetter)
      : undefined;

    if (matchingStep) {
      return {
        evidence: { distribution: matchingStep.distribution, text, source: 'deliberate' },
        earlyStopped,
      };
    }

    if (finalLetter) {
      notes.push('deliberate_logprobs_unavailable');
      return {
        evidence: {
          distribution: { probabilities: {}, mass: 0, margin: 0, top: finalLetter },
          text,
          source: 'text',
        },
        earlyStopped,
      };
    }

    if (labelSteps.length > 0) {
      // The model produced option letters but never committed to a final
      // answer. Do not promote a rationale mention into a confident decision.
      notes.push('deliberate_protocol_marker_missing');
      return { evidence: fast, earlyStopped };
    }

    notes.push('deliberate_unparsed');
    return { evidence: fast, earlyStopped };
  }

  private buildResponse(args: {
    normalized: DecisionRequest;
    letters: readonly string[];
    evidence: PassEvidence;
    escalated: boolean;
    earlyStopped: boolean;
    notes: string[];
    startedAt: number;
  }): DecisionResponse {
    const { normalized, letters, evidence, escalated, earlyStopped, notes, startedAt } = args;
    const { distribution } = evidence;
    const letter = distribution.top ?? parseAnswerLetter(evidence.text, letters);

    if (!letter) {
      throw new XonusParseError(
        'Xonus received no usable option from Gemini. The response may have been blocked, ' +
          'or the model may not support logprobs.',
      );
    }

    const optionIndex = letters.indexOf(letter);
    if (optionIndex < 0) {
      throw new XonusParseError(`Gemini returned an out-of-range option letter: ${letter}.`);
    }

    const probabilities: Record<string, number> = {};
    if (distribution.mass > 0) {
      normalized.options.forEach((option, index) => {
        probabilities[option] = distribution.probabilities[letters[index] ?? ''] ?? 0;
      });
    }

    const decision = normalized.options[optionIndex] as string;
    const confidence = probabilities[decision] ?? 0;
    const gatePassed = distribution.mass >= this.options.answerMassGate;
    const decisive = distribution.margin >= this.options.tau;
    const rationale =
      this.options.includeRationale && evidence.source === 'deliberate'
        ? extractRationale(evidence.text)
        : undefined;

    return {
      decision,
      probabilities,
      confidence,
      logOdds: distribution.margin,
      answerMass: distribution.mass,
      gatePassed,
      decisive,
      confident: gatePassed && decisive,
      optionIndex,
      escalated,
      earlyStopped,
      passes: escalated ? 2 : 1,
      source: evidence.source,
      model: this.options.modelName,
      latencyMs: Date.now() - startedAt,
      ...(rationale ? { rationale } : {}),
      notes,
    };
  }

  private thinkingConfig(): { thinkingBudget: number } | GenerateContentConfig['thinkingConfig'] {
    return this.options.generationConfig?.thinkingConfig ?? { thinkingBudget: FAST_THINKING_BUDGET };
  }

  private generationConfig(): GenerateContentConfig {
    const source = this.options.generationConfig ?? {};
    // These fields would fight the decision protocol; Xonus always owns them.
    const {
      responseMimeType: _mimeType,
      responseSchema: _schema,
      responseJsonSchema: _jsonSchema,
      ...rest
    } = source;
    return rest;
  }

  private normalizeError(
    error: unknown,
    deadline: { didTimeout(): boolean; signal: AbortSignal },
    callerSignal: AbortSignal | undefined,
  ): XonusError {
    if (error instanceof XonusError) return error;
    if (deadline.didTimeout()) {
      return new XonusTimeoutError(
        `The decision timed out after ${this.options.timeoutMs}ms.`,
        { cause: error },
      );
    }
    if (callerSignal?.aborted) {
      return new XonusAbortError('The decision was aborted.', { cause: error });
    }
    if (deadline.signal.aborted) {
      return new XonusAbortError('The decision was aborted.', { cause: error });
    }
    return toApiError(error);
  }
}

/** Convenience factory with the same signature as `new Xonus(config)`. */
export function createXonus(config: XonusConfig): Xonus {
  return new Xonus(config);
}

function resolveOptions(config: XonusConfig): ResolvedOptions {
  if (!config || typeof config !== 'object') {
    throw new XonusConfigError('Xonus requires a configuration object.');
  }

  if (!config.client && !isNonEmptyString(config.apiKey)) {
    throw new XonusConfigError('`apiKey` is required. Get one at https://aistudio.google.com/apikey');
  }

  const modelName = config.modelName ?? DEFAULT_MODEL;
  if (!isNonEmptyString(modelName)) {
    throw new XonusConfigError('`modelName` must be a non-empty string.');
  }

  const tau = config.tau ?? DEFAULT_TAU;
  if (!Number.isFinite(tau) || tau < 0) {
    throw new XonusConfigError('`tau` must be a finite number greater than or equal to 0.');
  }

  const answerMassGate = config.answerMassGate ?? DEFAULT_ANSWER_MASS_GATE;
  if (!Number.isFinite(answerMassGate) || answerMassGate <= 0 || answerMassGate > 1) {
    throw new XonusConfigError('`answerMassGate` must be greater than 0 and at most 1.');
  }

  const topLogprobs = config.topLogprobs ?? 20;
  if (!Number.isInteger(topLogprobs) || topLogprobs < 1 || topLogprobs > 20) {
    throw new XonusConfigError('`topLogprobs` must be an integer between 1 and 20.');
  }

  const maxOutputTokens = config.maxOutputTokens ?? 512;
  if (!Number.isInteger(maxOutputTokens) || maxOutputTokens < 1) {
    throw new XonusConfigError('`maxOutputTokens` must be a positive integer.');
  }

  const temperature = config.temperature ?? 0;
  if (!Number.isFinite(temperature) || temperature < 0 || temperature > 2) {
    throw new XonusConfigError('`temperature` must be between 0 and 2.');
  }

  const timeoutMs = config.timeoutMs ?? 30_000;
  if (!Number.isInteger(timeoutMs) || timeoutMs <= 0) {
    throw new XonusConfigError('`timeoutMs` must be a positive integer.');
  }

  const maxRetries = config.maxRetries ?? 2;
  if (!Number.isInteger(maxRetries) || maxRetries < 0 || maxRetries > 10) {
    throw new XonusConfigError('`maxRetries` must be an integer between 0 and 10.');
  }

  if (config.escalate !== undefined && typeof config.escalate !== 'boolean') {
    throw new XonusConfigError('`escalate` must be a boolean.');
  }
  if (config.includeRationale !== undefined && typeof config.includeRationale !== 'boolean') {
    throw new XonusConfigError('`includeRationale` must be a boolean.');
  }

  return {
    modelName,
    tau,
    answerMassGate,
    topLogprobs,
    maxOutputTokens,
    temperature,
    escalate: config.escalate ?? true,
    includeRationale: config.includeRationale ?? true,
    timeoutMs,
    maxRetries,
    ...(config.generationConfig ? { generationConfig: config.generationConfig } : {}),
  };
}

function validateRequest(request: DecisionRequest): DecisionRequest {
  if (!request || typeof request !== 'object') {
    throw new XonusInputError('`request` must be a decision object.');
  }
  if (!isNonEmptyString(request.question)) {
    throw new XonusInputError('`question` must be a non-empty string.');
  }
  if (!Array.isArray(request.options)) {
    throw new XonusInputError('`options` must be an array of strings.');
  }

  const options = request.options.map((option) => {
    if (!isNonEmptyString(option)) {
      throw new XonusInputError('Every option must be a non-empty string.');
    }
    return option;
  });

  if (options.length < 2) {
    throw new XonusInputError('A decision needs at least 2 options.');
  }
  if (options.length > 26) {
    throw new XonusInputError('A decision supports at most 26 options.');
  }

  const seen = new Set<string>();
  for (const option of options) {
    const key = option.trim();
    if (seen.has(key)) {
      throw new XonusInputError(`Duplicate option: "${key}". Options must be unique.`);
    }
    seen.add(key);
  }

  if (request.state !== undefined && typeof request.state !== 'string') {
    throw new XonusInputError('`state` must be a string when provided.');
  }

  const state = request.state?.trim();
  return {
    question: request.question.trim(),
    options,
    ...(state ? { state } : {}),
    ...(request.signal ? { signal: request.signal } : {}),
  };
}

function responseText(response: GenerateContentResponse): string {
  const candidate = response.candidates?.[0];
  return candidate ? candidateText(candidate) : '';
}

function candidateText(candidate: {
  content?: { parts?: Array<{ text?: string; thought?: boolean }> };
}): string {
  return (
    candidate.content?.parts
      ?.filter((part) => !part.thought)
      .map((part) => part.text ?? '')
      .join('') ?? ''
  );
}

function hasFinalAnswerProtocol(text: string, letter: string): boolean {
  return new RegExp(`FINAL\\s+ANSWER\\s*[:\\-][^A-Za-z]*${letter}\\b`, 'i').test(text);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}
