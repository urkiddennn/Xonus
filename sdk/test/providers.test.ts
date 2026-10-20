import { afterEach, describe, expect, it, vi } from 'vitest';
import { Xonus } from '../src';
import type { ProviderChunk, XonusProvider } from '../src';

afterEach(() => {
  vi.unstubAllEnvs();
});

const request = {
  question: 'Which team should handle this ticket?',
  options: ['Billing', 'Engineering'],
};

function chunk(
  letter: string,
  distribution: Record<string, number>,
  text = letter,
): ProviderChunk {
  return {
    text,
    steps: [
      {
        chosenToken: letter,
        candidates: Object.entries(distribution).map(([token, probability]) => ({
          token,
          logProbability: probability > 0 ? Math.log(probability) : -Infinity,
        })),
      },
    ],
  };
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

function openAILogprob(letter: string, distribution: Record<string, number>) {
  return {
    content: [
      {
        token: letter,
        logprob: Math.log(distribution[letter] ?? 1),
        top_logprobs: Object.entries(distribution).map(([token, probability]) => ({
          token,
          logprob: probability > 0 ? Math.log(probability) : -Infinity,
        })),
      },
    ],
  };
}

describe('custom providers', () => {
  it('runs the same decision protocol with a provider object', async () => {
    const provider: XonusProvider = {
      id: 'my-model',
      async generate() {
        return chunk('A', { A: 0.999, B: 0.001 });
      },
      async stream() {
        return (async function* () {
          // No escalation needed for this decision.
        })();
      },
    };

    const xonus = new Xonus({ provider, modelName: 'my-model-v1' });
    const result = await xonus.decide(request);

    expect(result.decision).toBe('Billing');
    expect(result.provider).toBe('my-model');
    expect(result.model).toBe('my-model-v1');
    expect(result.confident).toBe(true);
    expect(result.passes).toBe(1);
  });

  it('does not require an API key for a custom provider', () => {
    const provider: XonusProvider = {
      id: 'local',
      async generate() {
        return chunk('A', { A: 1, B: 0 });
      },
      async stream() {
        return (async function* () {})();
      },
    };

    expect(() => new Xonus({ provider, modelName: 'local' })).not.toThrow();
  });
});

describe('OpenAI-compatible provider', () => {
  it('parses chat-completions logprobs and sends the expected request', async () => {
    const fetchMock = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) =>
      jsonResponse({
        choices: [
          {
            message: { content: 'A' },
            logprobs: openAILogprob('A', { A: 0.999, B: 0.001 }),
          },
        ],
      }),
    );

    const xonus = new Xonus({
      provider: 'openai',
      apiKey: 'test-key',
      modelName: 'gpt-test',
      fetch: fetchMock as unknown as typeof fetch,
    });

    const result = await xonus.decide(request);

    expect(result.decision).toBe('Billing');
    expect(result.provider).toBe('openai');
    expect(result.model).toBe('gpt-test');
    expect(result.confident).toBe(true);
    expect(result.source).toBe('fast');

    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe('https://api.openai.com/v1/chat/completions');
    const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
    expect(body.model).toBe('gpt-test');
    expect(body.logprobs).toBe(true);
    expect(body.top_logprobs).toBe(20);
    expect(body.temperature).toBe(0);
    expect(body.messages).toEqual([
      expect.objectContaining({ role: 'system' }),
      expect.objectContaining({ role: 'user' }),
    ]);
    expect((init?.headers as Record<string, string>).authorization).toBe(
      'Bearer test-key',
    );
  });

  it('works against an unauthenticated local base URL', async () => {
    const fetchMock = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) =>
      jsonResponse({ choices: [{ message: { content: 'A' } }] }),
    );

    const xonus = new Xonus({
      provider: 'openai-compatible',
      baseURL: 'http://localhost:11434/v1',
      modelName: 'llama3.2',
      logprobs: false,
      escalate: false,
      fetch: fetchMock as unknown as typeof fetch,
    });

    const result = await xonus.decide(request);

    expect(result.decision).toBe('Billing');
    expect(result.confidence).toBe(0);
    expect(result.confident).toBe(false);

    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe('http://localhost:11434/v1/chat/completions');
    const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
    expect(body.logprobs).toBeUndefined();
    expect(body.top_logprobs).toBeUndefined();
    expect((init?.headers as Record<string, string>).authorization).toBeUndefined();
  });

  it('streams deliberation and stops at a decisive final answer', async () => {
    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as { stream?: boolean };

      if (!body.stream) {
        return jsonResponse({
          choices: [
            {
              message: { content: 'A' },
              logprobs: openAILogprob('A', { A: 0.55, B: 0.45 }),
            },
          ],
        });
      }

      const frames = [
        {
          choices: [
            {
              delta: { content: 'Engineering fits the stack trace. ' },
              logprobs: openAILogprob('A', { A: 0.9, B: 0.1 }),
            },
          ],
        },
        {
          choices: [
            {
              delta: { content: 'FINAL ANSWER: B' },
              logprobs: openAILogprob('B', { B: 0.999, A: 0.001 }),
            },
          ],
        },
      ]
        .map((frame) => `data: ${JSON.stringify(frame)}\n\n`)
        .join('');

      return new Response(`${frames}data: [DONE]\n\n`, {
        status: 200,
        headers: { 'content-type': 'text/event-stream' },
      });
    });

    const xonus = new Xonus({
      provider: 'openai',
      apiKey: 'test-key',
      modelName: 'gpt-test',
      fetch: fetchMock as unknown as typeof fetch,
    });

    const result = await xonus.decide(request);

    expect(result.decision).toBe('Engineering');
    expect(result.source).toBe('deliberate');
    expect(result.escalated).toBe(true);
    expect(result.earlyStopped).toBe(true);
    expect(result.confident).toBe(true);
    expect(result.rationale).toContain('stack trace');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('falls back to a single response when streaming is unsupported', async () => {
    let call = 0;
    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      call += 1;
      const body = JSON.parse(String(init?.body)) as { stream?: boolean };

      if (body.stream) {
        return new Response('stream unsupported', { status: 400 });
      }

      if (call === 1) {
        return jsonResponse({
          choices: [
            {
              message: { content: 'A' },
              logprobs: openAILogprob('A', { A: 0.55, B: 0.45 }),
            },
          ],
        });
      }

      return jsonResponse({
        choices: [
          {
            message: { content: 'FINAL ANSWER: B' },
            logprobs: openAILogprob('B', { B: 0.999, A: 0.001 }),
          },
        ],
      });
    });

    const xonus = new Xonus({
      provider: 'openai',
      apiKey: 'test-key',
      modelName: 'gpt-test',
      fetch: fetchMock as unknown as typeof fetch,
    });

    const result = await xonus.decide(request);

    expect(result.decision).toBe('Engineering');
    expect(result.source).toBe('deliberate');
    expect(result.confident).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('surfaces provider HTTP errors', async () => {
    const fetchMock = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) =>
      new Response('model not found', { status: 404 }),
    );

    const xonus = new Xonus({
      provider: 'openai',
      apiKey: 'test-key',
      modelName: 'missing-model',
      fetch: fetchMock as unknown as typeof fetch,
    });

    await expect(xonus.decide(request)).rejects.toMatchObject({
      code: 'XONUS_API',
      status: 404,
    });
  });
});

describe('Anthropic provider', () => {
  it('falls back to text evidence because Anthropic has no logprobs', async () => {
    const fetchMock = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) =>
      jsonResponse({
        content: [
          {
            type: 'text',
            text: 'The stack trace points to the deploy pipeline.\nFINAL ANSWER: B',
          },
        ],
      }),
    );

    const xonus = new Xonus({
      provider: 'anthropic',
      apiKey: 'test-key',
      modelName: 'claude-test',
      escalate: false,
      fetch: fetchMock as unknown as typeof fetch,
    });

    const result = await xonus.decide(request);

    expect(result.decision).toBe('Engineering');
    expect(result.provider).toBe('anthropic');
    expect(result.source).toBe('text');
    expect(result.confidence).toBe(0);
    expect(result.answerMass).toBe(0);
    expect(result.confident).toBe(false);

    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe('https://api.anthropic.com/v1/messages');
    expect((init?.headers as Record<string, string>)['x-api-key']).toBe('test-key');
    const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
    expect(body.system).toEqual(expect.stringContaining('decision engine'));
    expect(body.max_tokens).toBe(32);
  });
});

describe('provider configuration', () => {
  it('rejects unknown provider names', () => {
    expect(
      () =>
        new Xonus({
          provider: 'mystery' as unknown as 'gemini',
          apiKey: 'key',
        }),
    ).toThrow(/Unsupported provider/);
  });

  it('requires a credential for hosted providers', () => {
    expect(() => new Xonus({ provider: 'openai' })).toThrow(/No credentials/);
    expect(() => new Xonus({ provider: 'anthropic' })).toThrow(/No credentials/);
  });

  it('detects the provider from environment keys', () => {
    vi.stubEnv('GEMINI_API_KEY', '');
    vi.stubEnv('GOOGLE_API_KEY', '');
    vi.stubEnv('XONUS_API_KEY', '');
    vi.stubEnv('XONUS_PROVIDER', '');
    vi.stubEnv('ANTHROPIC_API_KEY', '');
    vi.stubEnv('OPENAI_API_KEY', 'openai-key');

    expect(() => Xonus.fromEnv()).not.toThrow();
  });
});
