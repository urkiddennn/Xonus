import { describe, expect, it } from 'vitest';
import {
  MAX_LOG_ODDS,
  extractLabelDistribution,
  extractRationale,
  marginFromProbabilities,
  normalizeToken,
  parseAnswerLetter,
  probabilityFromLog,
} from '../src';
import { topCandidates } from './fixtures';

describe('normalizeToken', () => {
  it.each([
    ['A', 'A'],
    [' a ', 'A'],
    ['**B**', 'B'],
    [' C)', 'C'],
    ['D.', 'D'],
    ['`E`', 'E'],
    ['F:', 'F'],
  ])('normalizes %j to %j', (input, expected) => {
    expect(normalizeToken(input)).toBe(expected);
  });

  it('rejects multi-character and empty tokens', () => {
    expect(normalizeToken('AB')).toBeNull();
    expect(normalizeToken('Answer')).toBeNull();
    expect(normalizeToken('')).toBeNull();
    expect(normalizeToken(undefined)).toBeNull();
  });
});

describe('probabilityFromLog', () => {
  it('converts log probabilities and guards invalid values', () => {
    expect(probabilityFromLog(Math.log(0.5))).toBeCloseTo(0.5);
    expect(probabilityFromLog(undefined)).toBe(0);
    expect(probabilityFromLog(Number.NaN)).toBe(0);
    expect(probabilityFromLog(Number.POSITIVE_INFINITY)).toBe(0);
  });
});

describe('extractLabelDistribution', () => {
  it('sums token spellings and normalizes over valid options', () => {
    const distribution = extractLabelDistribution(
      topCandidates({ A: 0.8, ' A': 0.1, B: 0.1 }),
      ['A', 'B'],
    );

    expect(distribution.mass).toBeCloseTo(1);
    expect(distribution.probabilities.A).toBeCloseTo(0.9);
    expect(distribution.probabilities.B).toBeCloseTo(0.1);
    expect(distribution.margin).toBeCloseTo(Math.log(9));
    expect(distribution.top).toBe('A');
  });

  it('reports answer mass below 1 when probability lands outside the options', () => {
    const distribution = extractLabelDistribution(
      topCandidates({ A: 0.7, ' C': 0.2, '?': 0.1 }),
      ['A', 'B'],
    );

    expect(distribution.mass).toBeCloseTo(0.7);
    expect(distribution.probabilities.A).toBe(1);
    expect(distribution.probabilities.B).toBe(0);
    expect(distribution.margin).toBe(MAX_LOG_ODDS);
  });

  it('returns an empty distribution when no option appears', () => {
    const distribution = extractLabelDistribution(topCandidates({ '?': 0.9 }), ['A', 'B']);
    expect(distribution.mass).toBe(0);
    expect(distribution.top).toBeNull();
    expect(distribution.probabilities).toEqual({});
  });

  it('handles missing steps', () => {
    expect(extractLabelDistribution(undefined, ['A', 'B']).mass).toBe(0);
  });
});

describe('marginFromProbabilities', () => {
  it('computes log-odds and caps the result', () => {
    expect(marginFromProbabilities({ A: 0.5, B: 0.5 })).toBe(0);
    expect(marginFromProbabilities({ A: 0.9, B: 0.1 })).toBeCloseTo(Math.log(9));
    expect(marginFromProbabilities({ A: 1, B: 0 })).toBe(MAX_LOG_ODDS);
    expect(marginFromProbabilities({})).toBe(0);
  });
});

describe('parseAnswerLetter', () => {
  const letters = ['A', 'B', 'C'];

  it('reads the explicit protocol marker', () => {
    expect(parseAnswerLetter('Reasoning here.\nFINAL ANSWER: B', letters)).toBe('B');
    expect(parseAnswerLetter('FINAL ANSWER: **C**', letters)).toBe('C');
    expect(parseAnswerLetter('final answer - a', letters)).toBe('A');
  });

  it('reads a standalone or leading letter', () => {
    expect(parseAnswerLetter('B', letters)).toBe('B');
    expect(parseAnswerLetter('B) second option', letters)).toBe('B');
    expect(parseAnswerLetter('**A.** first', letters)).toBe('A');
  });

  it('rejects letters outside the option range', () => {
    expect(parseAnswerLetter('FINAL ANSWER: Z', letters)).toBeNull();
    expect(parseAnswerLetter('banana', letters)).toBeNull();
    expect(parseAnswerLetter('', letters)).toBeNull();
  });
});

describe('extractRationale', () => {
  it('returns text before the final answer marker', () => {
    expect(extractRationale('Option B fits best.\nFINAL ANSWER: B')).toBe('Option B fits best.');
    expect(extractRationale('FINAL ANSWER: B')).toBeUndefined();
    expect(extractRationale('no marker')).toBeUndefined();
  });
});
