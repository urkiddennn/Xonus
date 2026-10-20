export {
  XonusError,
  XonusConfigError,
  XonusInputError,
  XonusApiError,
  XonusParseError,
  XonusAbortError,
  XonusTimeoutError,
} from './errors';
export type { XonusErrorCode } from './errors';

export {
  Xonus,
  createXonus,
  DEFAULT_MODEL,
  DEFAULT_OPENAI_MODEL,
  DEFAULT_ANTHROPIC_MODEL,
  DEFAULT_TAU,
  DEFAULT_ANSWER_MASS_GATE,
} from './xonus';

export {
  GeminiProvider,
  OpenAIProvider,
  AnthropicProvider,
} from './providers';
export type {
  ProviderChunk,
  ProviderConfig,
  ProviderLogprobStep,
  ProviderName,
  ProviderRequest,
  ProviderTokenCandidate,
  XonusProvider,
} from './providers';

export {
  MAX_LOG_ODDS,
  normalizeToken,
  probabilityFromLog,
  marginFromProbabilities,
  extractLabelDistribution,
  parseAnswerLetter,
  extractRationale,
} from './logprobs';
export type { LabelDistribution, LogprobCandidate, LogprobStep } from './logprobs';

export { optionLetters, buildFastPrompt, buildDeliberatePrompt } from './prompt';
export type { BuiltPrompt } from './prompt';

export type {
  XonusConfig,
  DecisionRequest,
  DecisionResponse,
  DecideBatchOptions,
} from './types';
