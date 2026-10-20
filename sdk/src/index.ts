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

export { Xonus, createXonus, DEFAULT_MODEL, DEFAULT_TAU, DEFAULT_ANSWER_MASS_GATE } from './xonus';

export {
  MAX_LOG_ODDS,
  normalizeToken,
  probabilityFromLog,
  marginFromProbabilities,
  extractLabelDistribution,
  parseAnswerLetter,
  extractRationale,
} from './logprobs';
export type { LabelDistribution } from './logprobs';

export { optionLetters, buildFastPrompt, buildDeliberatePrompt } from './prompt';
export type { BuiltPrompt } from './prompt';

export type {
  XonusConfig,
  DecisionRequest,
  DecisionResponse,
  DecideBatchOptions,
} from './types';
