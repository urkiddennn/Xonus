import { afterEach, describe, expect, it, vi } from 'vitest';
import type { GenerateContentResponse } from '@google/genai';
import {
  Xonus,
  XonusAbortError,
  XonusConfigError,
  XonusInputError,
  XonusParseError,
  XonusTimeoutError,
  createXonus,
} from '../src';
import {
  chunk,
  confidentFastClient,
  fakeClient,
  response,
  streamOf,
} from './fixtures';

const baseRequest = {
  question: 'Which department should handle this ticket?',
  options: ['Billing', 'Engineering'],
};

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('configuration', () => {
  it('requires an API key when no client is supplied', () => {
    expect(() => new Xonus({ apiKey: '' })).toThrow(XonusConfigError);
  });

  it('validates thresholds and logprob settings', () => {
    const fake = confidentFastClient();
    expect(
      () => new Xonus({ apiKey: 'k', client: fake.client, tau: -1 }),
    ).toThrow(XonusConfigError);
    expect(
      () => new Xonus({ apiKey: 'k', client: fake.client, answerMassGate: 1.01 }),
    ).toThrow(XonusConfigError);
    expect(
      () => new Xonus({ apiKey: 'k', client: fake.client, topLogprobs: 21 }),
    ).toThrow(XonusConfigError);
    expect(
      () => new Xonus({ apiKey: 'k', client: fake.client, timeoutMs: 0 }),
    ).toThrow(XonusConfigError);
  });

  it('builds from environment variables', () => {
    vi.stubEnv('XONUS_API_KEY', '');
    vi.stubEnv('GEMINI_API_KEY', '');
    vi.stubEnv('GOOGLE_API_KEY', '');

    expect(() => Xonus.fromEnv()).toThrow(XonusConfigError);

    vi.stubEnv('XONUS_API_KEY', 'env-key');
    expect(() => Xonus.fromEnv()).not.toThrow();
  });

  it('accepts a pre-built client without an API key in fromEnv', () => {
    vi.stubEnv('XONUS_API_KEY', '');
    vi.stubEnv('GEMINI_API_KEY', '');
    vi.stubEnv('GOOGLE_API_KEY', '');
    const fake = confidentFastClient();
    expect(() => Xonus.fromEnv({ client: fake.client })).not.toThrow();
  });

  it('exposes a factory', () => {
    const fake = confidentFastClient();
    const xonus = createXonus({ apiKey: 'test-key', client: fake.client });
    expect(xonus).toBeInstanceOf(Xonus);
  });
});

describe('input validation', () => {
  const xonus = new Xonus({ apiKey: 'test-key', client: confidentFastClient().client });

  it('rejects empty questions and invalid option lists', async () => {
    await expect(xonus.decide({ question: '', options: ['A', 'B'] })).rejects.toBeInstanceOf(
      XonusInputError,
    );
    await expect(xonus.decide({ question: 'Which?', options: ['A'] })).rejects.toBeInstanceOf(
      XonusInputError,
    );
    await expect(
      xonus.decide({ question: 'Which?', options: ['A', 'A'] }),
    ).rejects.toBeInstanceOf(XonusInputError);
    await expect(
      xonus.decide({ question: 'Which?', options: ['A', ' '] }),
    ).rejects.toBeInstanceOf(XonusInputError);
  });

  it('rejects more than 26 options', async () => {
    const options = Array.from({ length: 27 }, (_, index) => `Option ${index}`);
    await expect(xonus.decide({ question: 'Which?', options })).rejects.toBeInstanceOf(
      XonusInputError,
    );
  });
});

describe('fast path', () => {
  it('returns immediately when the margin clears tau', async () => {
    const fake = confidentFastClient('A');
    const xonus = new Xonus({ apiKey: 'test-key', client: fake.client });

    const result = await xonus.decide({
      ...baseRequest,
      state: 'The customer was charged twice.',
    });

    expect(result.decision).toBe('Billing');
    expect(result.optionIndex).toBe(0);
    expect(result.probabilities.Billing).toBeCloseTo(0.999);
    expect(result.probabilities.Engineering).toBeCloseTo(0.001);
    expect(result.confidence).toBeCloseTo(0.999);
    expect(result.logOdds).toBeCloseTo(Math.log(999));
    expect(result.answerMass).toBeCloseTo(1);
    expect(result.gatePassed).toBe(true);
    expect(result.decisive).toBe(true);
    expect(result.confident).toBe(true);
    expect(result.escalated).toBe(false);
    expect(result.earlyStopped).toBe(true);
    expect(result.passes).toBe(1);
    expect(result.source).toBe('fast');
    expect(fake.generateContentStream).not.toHaveBeenCalled();

    const params = fake.generateContent.mock.calls[0]?.[0];
    expect(params?.config?.responseLogprobs).toBe(true);
    expect(params?.config?.temperature).toBe(0);
    expect(params?.contents).toContain('Which department should handle this ticket?');
    expect(params?.contents).toContain('A) Billing');
    expect(params?.contents).toContain('B) Engineering');
  });

  it('finds the decision token after a leading whitespace token', async () => {
    const fake = fakeClient({
      generateContent: () =>
        ({
          candidates: [
            {
              content: { parts: [{ text: ' A' }] },
              logprobsResult: {
                topCandidates: [
                  { candidates: [{ token: ' ', logProbability: Math.log(0.9) }] },
                  {
                    candidates: [
                      { token: 'A', logProbability: Math.log(0.999) },
                      { token: 'B', logProbability: Math.log(0.001) },
                    ],
                  },
                ],
                chosenCandidates: [
                  { token: ' ', logProbability: Math.log(0.9) },
                  { token: 'A', logProbability: Math.log(0.999) },
                ],
              },
            },
          ],
        }) as unknown as GenerateContentResponse,
    });
    const xonus = new Xonus({ apiKey: 'test-key', client: fake.client });

    const result = await xonus.decide(baseRequest);

    expect(result.decision).toBe('Billing');
    expect(result.confident).toBe(true);
    expect(result.passes).toBe(1);
    expect(fake.generateContentStream).not.toHaveBeenCalled();
  });

  it('returns option text verbatim', async () => {
    const fake = confidentFastClient('A');
    const xonus = new Xonus({ apiKey: 'test-key', client: fake.client });

    const result = await xonus.decide({
      question: 'Which?',
      options: [' Billing ', 'Engineering'],
    });

    expect(result.decision).toBe(' Billing ');
    expect(Object.keys(result.probabilities)).toEqual([' Billing ', 'Engineering']);
  });

  it('respects escalate: false and reports an uncertain result', async () => {
    const fake = fakeClient({
      generateContent: () =>
        response({ letter: 'A', distribution: { A: 0.55, B: 0.45 }, text: 'A' }),
    });
    const xonus = new Xonus({ apiKey: 'test-key', client: fake.client, escalate: false });

    const result = await xonus.decide(baseRequest);

    expect(result.decision).toBe('Billing');
    expect(result.escalated).toBe(false);
    expect(result.earlyStopped).toBe(false);
    expect(result.passes).toBe(1);
    expect(result.decisive).toBe(false);
    expect(result.confident).toBe(false);
    expect(result.logOdds).toBeCloseTo(Math.log(0.55 / 0.45));
    expect(fake.generateContentStream).not.toHaveBeenCalled();
  });

  it('fails the answer-mass gate when probability leaks outside the options', async () => {
    const fake = fakeClient({
      generateContent: () =>
        response({ letter: 'A', distribution: { A: 0.9, B: 0.02 }, text: 'A' }),
    });
    const xonus = new Xonus({ apiKey: 'test-key', client: fake.client, escalate: false });

    const result = await xonus.decide(baseRequest);

    expect(result.decision).toBe('Billing');
    expect(result.answerMass).toBeCloseTo(0.92);
    expect(result.gatePassed).toBe(false);
    expect(result.confident).toBe(false);
    expect(result.probabilities.Billing).toBeCloseTo(0.9 / 0.92);
  });
});

describe('deliberation and early stopping', () => {
  it('escalates an uncertain fast pass and stops at a decisive final answer', async () => {
    let aborted = false;
    let yielded = 0;
    const fake = fakeClient({
      generateContent: () =>
        response({ letter: 'A', distribution: { A: 0.55, B: 0.45 }, text: 'A' }),
      generateContentStream: (params) => {
        params.config?.abortSignal?.addEventListener('abort', () => {
          aborted = true;
        });
        const chunks = [
          chunk({
            letter: 'A',
            distribution: { A: 0.9, B: 0.1 },
            text: 'Billing is plausible, but ',
          }),
          chunk({
            letter: 'B',
            distribution: { B: 0.999, A: 0.001 },
            text: 'the stack trace points to Engineering. FINAL ANSWER: B',
          }),
          chunk({
            letter: 'B',
            distribution: { B: 0.999, A: 0.001 },
            text: ' This trailing text should never be needed.',
          }),
        ];
        return (async function* () {
          for (const item of chunks) {
            yielded += 1;
            yield item;
          }
        })();
      },
    });
    const xonus = new Xonus({ apiKey: 'test-key', client: fake.client });

    const result = await xonus.decide(baseRequest);

    expect(result.decision).toBe('Engineering');
    expect(result.optionIndex).toBe(1);
    expect(result.escalated).toBe(true);
    expect(result.earlyStopped).toBe(true);
    expect(result.passes).toBe(2);
    expect(result.source).toBe('deliberate');
    expect(result.logOdds).toBeCloseTo(Math.log(999));
    expect(result.confident).toBe(true);
    expect(result.rationale).toContain('stack trace points to Engineering');
    expect(fake.generateContentStream).toHaveBeenCalledTimes(1);
    expect(aborted).toBe(true);
    expect(yielded).toBe(2);
  });

  it('reads the whole stream when the final answer is not decisive', async () => {
    const fake = fakeClient({
      generateContent: () =>
        response({ letter: 'A', distribution: { A: 0.55, B: 0.45 }, text: 'A' }),
      generateContentStream: () =>
        streamOf([
          chunk({
            letter: 'B',
            distribution: { B: 0.7, A: 0.3 },
            text: 'Engineering is the better fit. FINAL ANSWER: B',
          }),
          chunk({ letter: '.', distribution: { '.': 0.9 }, text: '.' }),
        ]),
    });
    const xonus = new Xonus({ apiKey: 'test-key', client: fake.client });

    const result = await xonus.decide(baseRequest);

    expect(result.decision).toBe('Engineering');
    expect(result.escalated).toBe(true);
    expect(result.earlyStopped).toBe(false);
    expect(result.decisive).toBe(false);
    expect(result.confident).toBe(false);
    expect(result.logOdds).toBeCloseTo(Math.log(0.7 / 0.3));
  });

  it('falls back to text when deliberation has no logprobs', async () => {
    const fake = fakeClient({
      generateContent: () =>
        response({ letter: 'A', distribution: { A: 0.55, B: 0.45 }, text: 'A' }),
      generateContentStream: () =>
        streamOf([
          chunk({
            letter: 'B',
            distribution: {},
            text: 'The evidence favors Engineering. FINAL ANSWER: B',
            withLogprobs: false,
          }),
        ]),
    });
    const xonus = new Xonus({ apiKey: 'test-key', client: fake.client });

    const result = await xonus.decide(baseRequest);

    expect(result.decision).toBe('Engineering');
    expect(result.source).toBe('text');
    expect(result.answerMass).toBe(0);
    expect(result.confidence).toBe(0);
    expect(result.confident).toBe(false);
    expect(result.notes).toContain('deliberate_logprobs_unavailable');
  });

  it('throws when no option can be recovered', async () => {
    const fake = fakeClient({
      generateContent: () => response({ text: 'I cannot help with that.', withLogprobs: false }),
    });
    const xonus = new Xonus({
      apiKey: 'test-key',
      client: fake.client,
      escalate: false,
    });

    await expect(xonus.decide(baseRequest)).rejects.toBeInstanceOf(XonusParseError);
  });
});

describe('resilience', () => {
  it('retries retryable Gemini failures', async () => {
    let attempts = 0;
    const fake = fakeClient({
      generateContent: () => {
        attempts += 1;
        if (attempts < 2) {
          throw Object.assign(new Error('Service unavailable'), { status: 503 });
        }
        return response({ letter: 'A', distribution: { A: 0.999, B: 0.001 } });
      },
    });
    const xonus = new Xonus({ apiKey: 'test-key', client: fake.client, maxRetries: 2 });

    const result = await xonus.decide(baseRequest);

    expect(result.confident).toBe(true);
    expect(attempts).toBe(2);
  });

  it('honours caller aborts before making a request', async () => {
    const fake = confidentFastClient();
    const xonus = new Xonus({ apiKey: 'test-key', client: fake.client });
    const controller = new AbortController();
    controller.abort();

    await expect(
      xonus.decide({ ...baseRequest, signal: controller.signal }),
    ).rejects.toBeInstanceOf(XonusAbortError);
    expect(fake.generateContent).not.toHaveBeenCalled();
  });

  it('times out hanging requests', async () => {
    const fake = fakeClient({
      generateContent: (params) =>
        new Promise((_resolve, reject) => {
          params.config?.abortSignal?.addEventListener('abort', () =>
            reject(params.config?.abortSignal?.reason ?? new Error('aborted')),
          );
        }),
    });
    const xonus = new Xonus({
      apiKey: 'test-key',
      client: fake.client,
      timeoutMs: 30,
      maxRetries: 0,
    });

    await expect(xonus.decide(baseRequest)).rejects.toBeInstanceOf(XonusTimeoutError);
  });
});

describe('decideBatch', () => {
  it('preserves input order and respects the concurrency limit', async () => {
    const fake = confidentFastClient('A');
    const xonus = new Xonus({ apiKey: 'test-key', client: fake.client });

    const results = await xonus.decideBatch(
      [
        { question: 'First?', options: ['first-a', 'first-b'] },
        { question: 'Second?', options: ['second-a', 'second-b'] },
        { question: 'Third?', options: ['third-a', 'third-b'] },
      ],
      { concurrency: 2 },
    );

    expect(results.map((result) => result.decision)).toEqual([
      'first-a',
      'second-a',
      'third-a',
    ]);
    expect(fake.generateContent).toHaveBeenCalledTimes(3);
  });

  it('validates concurrency', async () => {
    const xonus = new Xonus({ apiKey: 'test-key', client: confidentFastClient().client });
    await expect(xonus.decideBatch([], { concurrency: 0 })).rejects.toBeInstanceOf(
      XonusInputError,
    );
  });
});
