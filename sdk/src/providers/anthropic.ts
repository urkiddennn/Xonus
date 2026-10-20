import { XonusApiError } from '../errors';
import { parseSse } from './sse';
import type {
  ProviderChunk,
  ProviderConfig,
  ProviderRequest,
  XonusProvider,
} from './types';

const DEFAULT_BASE_URL = 'https://api.anthropic.com/v1';
const ANTHROPIC_VERSION = '2023-06-01';

interface AnthropicContentBlock {
  type?: string;
  text?: string;
}

interface AnthropicResponse {
  content?: AnthropicContentBlock[];
  error?: { message?: string };
}

interface AnthropicEvent {
  type?: string;
  delta?: { type?: string; text?: string };
  error?: { message?: string };
}

/**
 * Adapter for Anthropic's Messages API.
 *
 * Anthropic does not expose token log probabilities, so Xonus reads the text
 * answer and reports `confidence: 0`, `answerMass: 0`, and `confident: false`.
 * That is intentional: the provider is supported, but the calibrated evidence
 * path requires a logprob-capable model.
 */
export class AnthropicProvider implements XonusProvider {
  readonly id = 'anthropic';
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
    const payload = (await response.json()) as AnthropicResponse;
    const text = Array.isArray(payload.content)
      ? payload.content
          .filter((block) => block.type === 'text')
          .map((block) => block.text ?? '')
          .join('')
      : '';
    return { text, steps: [] };
  }

  async stream(request: ProviderRequest): Promise<AsyncIterable<ProviderChunk>> {
    const response = await this.request(request, true);
    if (!response.body) {
      throw new XonusApiError('The Anthropic stream returned no response body.');
    }

    const body = response.body;
    return (async function* () {
      for await (const payload of parseSse(body)) {
        const event = payload as AnthropicEvent;
        if (event.type === 'content_block_delta' && event.delta?.text) {
          yield { text: event.delta.text, steps: [] };
        }
      }
    })();
  }

  private async request(request: ProviderRequest, stream: boolean): Promise<Response> {
    const response = await this.fetchImpl(`${this.baseURL}/messages`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'anthropic-version': ANTHROPIC_VERSION,
        ...(this.apiKey ? { 'x-api-key': this.apiKey } : {}),
        ...this.headers,
      },
      body: JSON.stringify({
        ...request.providerOptions,
        model: request.model,
        system: request.systemInstruction,
        messages: [{ role: 'user', content: request.prompt }],
        max_tokens: request.maxOutputTokens,
        temperature: request.temperature,
        stream,
      }),
      signal: request.signal,
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new XonusApiError(
        `Anthropic request failed (${response.status})` +
          (detail ? `: ${detail.slice(0, 300)}` : '.'),
        { status: response.status },
      );
    }

    return response;
  }
}
