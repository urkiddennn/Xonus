import { GoogleGenAI } from '@google/genai';
import type { GenerateContentConfig, GenerateContentResponse } from '@google/genai';
import type {
  ProviderChunk,
  ProviderConfig,
  ProviderLogprobStep,
  ProviderRequest,
  XonusProvider,
} from './types';

export interface GeminiProviderConfig extends ProviderConfig {
  /** Pre-built client for custom auth, proxies, or tests. */
  client?: GoogleGenAI;
}

/** Default Gemini adapter. Keeps the original `responseLogprobs` behavior. */
export class GeminiProvider implements XonusProvider {
  readonly id = 'gemini';
  private readonly client: GoogleGenAI;

  constructor(config: GeminiProviderConfig = {}) {
    this.client = config.client ?? new GoogleGenAI({ apiKey: config.apiKey ?? '' });
  }

  async generate(request: ProviderRequest): Promise<ProviderChunk> {
    const response = await this.client.models.generateContent(this.params(request));
    return geminiChunk(response);
  }

  async stream(request: ProviderRequest): Promise<AsyncIterable<ProviderChunk>> {
    const stream = await this.client.models.generateContentStream(this.params(request));
    return (async function* () {
      for await (const chunk of stream) {
        yield geminiChunk(chunk);
      }
    })();
  }

  private params(request: ProviderRequest) {
    const generationConfig = (request.generationConfig ?? {}) as GenerateContentConfig;
    const config: GenerateContentConfig = {
      ...generationConfig,
      systemInstruction: request.systemInstruction,
      temperature: request.temperature,
      maxOutputTokens: request.maxOutputTokens,
      candidateCount: 1,
      // Gemini is the one provider where thinking is explicitly disabled by
      // default: it keeps the fast pass cheap and the decision token clean.
      thinkingConfig: generationConfig.thinkingConfig ?? { thinkingBudget: 0 },
      abortSignal: request.signal,
      ...(request.logprobs
        ? { responseLogprobs: true, logprobs: request.topLogprobs }
        : {}),
    };

    return {
      model: request.model,
      contents: request.prompt,
      config,
    };
  }
}

function geminiChunk(response: GenerateContentResponse): ProviderChunk {
  const candidate = response.candidates?.[0];
  const text =
    candidate?.content?.parts
      ?.filter((part) => !part.thought)
      .map((part) => part.text ?? '')
      .join('') ?? '';

  const logprobs = candidate?.logprobsResult;
  const steps: ProviderLogprobStep[] = (logprobs?.topCandidates ?? []).map(
    (step, index) => ({
      ...(logprobs?.chosenCandidates?.[index]?.token
        ? { chosenToken: logprobs.chosenCandidates[index]?.token }
        : {}),
      candidates: (step.candidates ?? []).map((item) => ({
        token: item.token ?? '',
        logProbability: item.logProbability ?? 0,
      })),
    }),
  );

  return { text, steps };
}
