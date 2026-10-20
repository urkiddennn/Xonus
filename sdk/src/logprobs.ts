import type { LogprobsResultTopCandidates } from '@google/genai';

/** Log-odds are capped so responses stay JSON-safe (`Infinity` is not). */
export const MAX_LOG_ODDS = 99;

/**
 * Normalize a generated token into a single option letter, if it is one.
 *
 * Handles the tokenizer variants Gemini produces around multiple-choice
 * answers: `" A"`, `"**B**"`, `"C)"`, `` "`D`" ``, `"E."`, etc.
 */
export function normalizeToken(token: string | undefined): string | null {
  if (!token) return null;
  const cleaned = token
    .trim()
    .replace(/^["'`*_#>([{.\s]+/, '')
    .replace(/["'`*_#<)\]}.,:;!?\s]+$/, '');
  if (!/^[A-Za-z]$/.test(cleaned)) return null;
  return cleaned.toUpperCase();
}

/** Convert a log probability to a linear probability, guarding against bad values. */
export function probabilityFromLog(logProbability: number | undefined): number {
  if (typeof logProbability !== 'number' || !Number.isFinite(logProbability)) return 0;
  return Math.min(1, Math.max(0, Math.exp(logProbability)));
}

/** Log-odds margin between the top two entries of a distribution. */
export function marginFromProbabilities(probabilities: Record<string, number>): number {
  const values = Object.values(probabilities)
    .filter((value) => Number.isFinite(value) && value > 0)
    .sort((a, b) => b - a);
  const [first, second] = values;
  if (first === undefined) return 0;
  if (second === undefined || second <= 0) return MAX_LOG_ODDS;
  return Math.min(MAX_LOG_ODDS, Math.log(first / second));
}

/** Evidence extracted from one decoding step. */
export interface LabelDistribution {
  /** Re-normalized probabilities over the supplied option letters. */
  probabilities: Record<string, number>;
  /** Raw probability mass placed on valid option letters (not re-normalized). */
  mass: number;
  /** Log-odds margin between the two most likely option letters. */
  margin: number;
  /** The most likely option letter, or `null` when no option was possible. */
  top: string | null;
}

const EMPTY_DISTRIBUTION: LabelDistribution = {
  probabilities: {},
  mass: 0,
  margin: 0,
  top: null,
};

/**
 * Turn a Gemini logprobs step into a probability distribution over option
 * letters. Multiple token spellings of the same letter are summed; the result
 * is then normalized over the valid options only.
 */
export function extractLabelDistribution(
  step: LogprobsResultTopCandidates | undefined,
  letters: readonly string[],
): LabelDistribution {
  if (!step?.candidates?.length || letters.length === 0) {
    return { ...EMPTY_DISTRIBUTION, probabilities: {} };
  }

  const allowed = new Set(letters);
  const massByLetter = new Map<string, number>(letters.map((letter) => [letter, 0]));

  for (const candidate of step.candidates) {
    const letter = normalizeToken(candidate.token);
    if (!letter || !allowed.has(letter)) continue;
    massByLetter.set(letter, (massByLetter.get(letter) ?? 0) + probabilityFromLog(candidate.logProbability));
  }

  let mass = 0;
  for (const value of massByLetter.values()) mass += value;
  if (mass <= 0) {
    return { ...EMPTY_DISTRIBUTION, probabilities: {} };
  }

  const probabilities: Record<string, number> = {};
  let top: string | null = null;
  let topProbability = -1;
  for (const letter of letters) {
    const probability = (massByLetter.get(letter) ?? 0) / mass;
    probabilities[letter] = probability;
    if (probability > topProbability) {
      topProbability = probability;
      top = letter;
    }
  }

  return {
    probabilities,
    mass: Math.min(1, mass),
    margin: marginFromProbabilities(probabilities),
    top,
  };
}

/**
 * Recover the final answer letter from free-form text. Matches the explicit
 * `FINAL ANSWER: X` protocol first, then falls back to a standalone letter or
 * a leading letter such as `B)` / `B.`.
 */
export function parseAnswerLetter(text: string, letters: readonly string[]): string | null {
  if (!text) return null;
  const allowed = new Set(letters);

  const protocol = [
    ...text.matchAll(/FINAL\s+ANSWER\s*[:\-]\s*[*_`"'\s]*([A-Za-z])\b/gi),
  ];
  const lastProtocol = protocol.at(-1);
  if (lastProtocol?.[1]) {
    const letter = lastProtocol[1].toUpperCase();
    if (allowed.has(letter)) return letter;
  }

  const trimmed = text.trim();
  const leading = /^[\s*_`"'(]*([A-Za-z])\s*[).:\-]/u.exec(trimmed);
  if (leading?.[1]) {
    const letter = leading[1].toUpperCase();
    if (allowed.has(letter)) return letter;
  }

  if (trimmed.length === 1) {
    const letter = normalizeToken(trimmed);
    if (letter && allowed.has(letter)) return letter;
  }

  return null;
}

/** Remove a trailing `FINAL ANSWER: X` block and return the preceding rationale. */
export function extractRationale(text: string): string | undefined {
  if (!text) return undefined;
  const matches = [...text.matchAll(/FINAL\s+ANSWER\s*[:\-]\s*[*_`"'\s]*([A-Za-z])\b/gi)];
  const last = matches.at(-1);
  if (!last || last.index === undefined) return undefined;
  const rationale = text.slice(0, last.index).replace(/[\s*_`#>]+$/u, '').trim();
  return rationale || undefined;
}


