import { describe, expect, it } from 'vitest';
import { Xonus } from '../src';

const apiKey = process.env.GEMINI_API_KEY ?? process.env.XONUS_API_KEY;
const enabled = Boolean(apiKey) && process.env.XONUS_LIVE_TEST === '1';

/**
 * Optional live smoke test. It makes one real Gemini request, so it only runs
 * when both a key and XONUS_LIVE_TEST=1 are present.
 *
 *   XONUS_LIVE_TEST=1 GEMINI_API_KEY=... npm test
 */
describe.skipIf(!enabled)('live Gemini', () => {
  it(
    'returns a usable, evidence-backed decision',
    async () => {
      const xonus = new Xonus({
        apiKey: apiKey as string,
        timeoutMs: 45_000,
      });

      const result = await xonus.decide({
        state: 'The user was charged twice for the same order.',
        question: 'Which department should handle the request?',
        options: ['Billing', 'Engineering', 'Sales'],
      });

      expect(['Billing', 'Engineering', 'Sales']).toContain(result.decision);
      expect(result.probabilities[result.decision]).toBeGreaterThan(0);
      expect(result.answerMass).toBeGreaterThan(0);
      expect(result.logOdds).toBeGreaterThan(0);
      expect(result.latencyMs).toBeGreaterThan(0);
      expect(result.notes).toBeInstanceOf(Array);
    },
    60_000,
  );
});
