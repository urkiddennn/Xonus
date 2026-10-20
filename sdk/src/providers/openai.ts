import { XonusApiError } from '../errors';
import { parseSse } from './sse';
import type {
  ProviderChunk,
  ProviderConfig,
  ProviderLogprobStep,
  ProviderRequest,
  XonusProvider,
} from './types';

const DEFAULT_BASE_URL = 'https://api.openai.com/v1';

interface OpenAITopLogprob {
  token?: string;
  logprob?: number;
}

interface OpenAIContentLogprob {
  token?: string;
  logprob?: number;
  top_logprobs?: OpenAITopLogprob[];
}

interface OpenAIContentPart {
  text?: string;
}

interface OpenAIChoice {
  message?: { content?: string | OpenAIContentPart[] | null };
  delta?: { content?: string | OpenAIContentPart[] | null };
  logprobs?: { content?: OpenAIContentLogprob[] } | null;
}

interface OpenAIResponse {
  choices?: OpenAIChoice[];
  error?: { message?: string };
}

/**
 * Adapter for OpenAI's Chat Completions API and every API that mirrors it.
 *
 * Works with OpenAI, Azure OpenAI, OpenRouter, Groq, Together, Fireworks,
 * DeepSeek, Mistral, xAI, Ollama, vLLM, LM Studio, and similar endpoints.
 * Set `baseURL` to the API root, including the version segment (`/v1`).
 */
export class OpenAIProvider implements XonusProvider {
  readonly id = 'openai';
  private readonly apiKey: string;
  private readonly baseURL: string;
  private readonly headers: Record<string, string>;
  private readonly fetchImpl: typeof fetch;

  constructor(config: ProviderConfig = {}) {
    this.apiKey = config.apiKey?.trim() ?? '';
    this.baseURL = (config.baseURL ?? DEFAULT_BASE_URL).replace(/\/+$/, '');
    this.headers = config.headers ?? {};
    this.fetchImpl = config.fetch ?? fetch;
  }

  async generate(request: ProviderRequest): Promise<ProviderChunk> {
    const response = await this.request(request, false);
    const payload = (await response.json()) as OpenAIResponse;
    return openAIChunk(payload);
  }

  async stream(request: ProviderRequest): Promise<AsyncIterable<ProviderChunk>> {
    let response: Response;
    try {
      response = await this.request(request, true);
    } catch (error) {
      // Some OpenAI-compatible servers implement Chat Completions but not
      // streaming. Fall back to a single non-streaming response so the
      // deliberation pass still completes.
      if (
        error instanceof XonusApiError &&
        (error.status === 400 || error.status === 404 || error.status === 405)
      ) {
        const chunk = await this.generate(request);
        return (async function* () {
          yield chunk;
        })();
      }
      throw error;
    }

    if (!response.body) {
      throw new XonusApiError('The OpenAI-compatible stream returned no response body.');
    }

    const body = response.body;
    return (async function* () {
      for await (const payload of parseSse(body)) {
        yield openAIChunk(payload as OpenAIResponse);
      }
    })();
  }

  private async request(request: ProviderRequest, stream: boolean): Promise<Response> {
    const extra = request.providerOptions ?? {};
    const usesCompletionTokens = Object.prototype.hasOwnProperty.call(
      extra,
      'max_completion_tokens',
    );

    const response = await this.fetchImpl(`${this.baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(this.apiKey ? { authorization: `Bearer ${this.apiKey}` } : {}),
        ...this.headers,
      },
      body: JSON.stringify({
        ...extra,
        model: request.model,
        messages: [
          { role: 'system', content: request.systemInstruction },
          { role: 'user', content: request.prompt },
        ],
        temperature: request.temperature,
        ...(usesCompletionTokens ? {} : { max_tokens: request.maxOutputTokens }),
        ...(request.logprobs
          ? {
              logprobs: true,
              top_logprobs: Math.min(20, Math.max(1, request.topLogprobs)),
            }
          : {}),
        stream,
      }),
      signal: request.signal,
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new XonusApiError(
        `OpenAI-compatible request failed (${response.status})` +
          (detail ? `: ${detail.slice(0, 300)}` : '.'),
        { status: response.status },
      );
    }

    return response;
  }
}

function openAIChunk(payload: OpenAIResponse): ProviderChunk {
  const choice = payload.choices?.[0];
  const content = choice?.message?.content ?? choice?.delta?.content;
  const text =
    typeof content === 'string'
      ? content
      : Array.isArray(content)
        ? content.map((part) => part.text ?? '').join('')
        : '';

  const tokens = choice?.logprobs?.content;
  const steps: ProviderLogprobStep[] = Array.isArray(tokens)
    ? tokens.map((item) => {
        const alternatives =
          Array.isArray(item.top_logprobs) && item.top_logprobs.length > 0
            ? item.top_logprobs
            : [{ token: item.token, logprob: item.logprob }];

        return {
          ...(typeof item.token === 'string' ? { chosenToken: item.token } : {}),
          candidates: alternatives.map((alternative) => ({
            token: alternative.token ?? '',
            logProbability:
              typeof alternative.logprob === 'number' ? alternative.logprob : 0,
          })),
        };
      })
    : [];

  return { text, steps };
}
