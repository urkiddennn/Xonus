import { describe, expect, it } from 'vitest';
import { Xonus } from '../src';

const anyKey =
  process.env.XONUS_API_KEY ||
  process.env.GEMINI_API_KEY ||
  process.env.GOOGLE_API_KEY ||
  process.env.OPENAI_API_KEY ||
  process.env.ANTHROPIC_API_KEY;
const enabled = Boolean(anyKey) && process.env.XONUS_LIVE_TEST === '1';

/**
 * Optional live smoke test. It makes one real model request, so it only runs
 * when a provider key and XONUS_LIVE_TEST=1 are present.
 *
 *   XONUS_LIVE_TEST=1 GEMINI_API_KEY=... npm test
 *   XONUS_LIVE_TEST=1 OPENAI_API_KEY=... npm test
 */
describe.skipIf(!enabled)('live model', () => {
  it(
    'returns a usable, evidence-backed decision',
    async () => {
      const xonus = Xonus.fromEnv({ timeoutMs: 45_000 });

      const result = await xonus.decide({
        state: 'The user was charged twice for the same order.',
        question: 'Which department should handle the request?',
        options: ['Billing', 'Engineering', 'Sales'],
      });

      expect(['Billing', 'Engineering', 'Sales']).toContain(result.decision);
      expect(result.provider.length).toBeGreaterThan(0);
      expect(result.latencyMs).toBeGreaterThan(0);
      expect(result.notes).toBeInstanceOf(Array);

      if (result.source === 'text') {
        expect(result.confidence).toBe(0);
        expect(result.confident).toBe(false);
      } else {
        expect(result.probabilities[result.decision]).toBeGreaterThan(0);
        expect(result.answerMass).toBeGreaterThan(0);
        expect(result.logOdds).toBeGreaterThan(0);
      }
    },
    60_000,
  );
});
