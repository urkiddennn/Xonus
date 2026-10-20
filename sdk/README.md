# Xonus

**A Gemini-native decision engine.** Xonus turns a list of options into a calibrated decision, then tells you exactly how much to trust it.

```ts
import { Xonus } from 'xonus';

const xonus = new Xonus({ apiKey: process.env.GEMINI_API_KEY! });

const result = await xonus.decide({
  state: 'The customer was charged twice and wants a refund.',
  question: 'Which team should handle this ticket?',
  options: ['Billing', 'Engineering', 'Sales'],
});

result.decision;      // "Billing"
result.confidence;    // 0.998
result.logOdds;       // 6.21
result.answerMass;    // 0.999
result.confident;     // true
```

---

## Why

An LLM answering a multiple-choice question is really producing a probability distribution over tokens. Most applications throw that distribution away and parse the text.

Xonus keeps it:

- **Log-odds early stop** — if the top option is `e^tau` times more likely than the runner-up, the decision is already settled. Xonus returns without generating a single reasoning token. Default `tau = 6` is roughly **403:1** odds.
- **Answer-mass gate** — sums the probability the model placed on *valid* options. If probability leaked onto "I'm not sure" or off-protocol text, the gate fails and `confident` is `false`. Default gate: `0.99`.
- **Deliberation when it matters** — uncertain decisions escalate to a second, streamed pass. Xonus aborts that stream the instant the final answer token is decisive.
- **Typed by default** — full TypeScript types, ESM + CJS, zero runtime dependencies beyond `@google/genai`.

This is not another agent framework. It is one small, sharp primitive for routing, triage, classification, moderation, and any other place where an application needs a discrete answer rather than a paragraph.

## Install

```bash
npm install xonus
```

Requires Node 18+ (or any modern browser with `fetch`). Set `GEMINI_API_KEY`, `GOOGLE_API_KEY`, or `XONUS_API_KEY`.

## Quick start

```ts
import { Xonus } from 'xonus';

const xonus = Xonus.fromEnv(); // reads XONUS_API_KEY / GEMINI_API_KEY / GOOGLE_API_KEY

const result = await xonus.decide({
  state: 'User message: "I was charged twice for order #4412."',
  question: 'What is the intent of this message?',
  options: ['Refund request', 'Bug report', 'Sales question'],
});

if (!result.confident) {
  // The model was not decisively behind one valid option.
  return escalateToHuman(result);
}
```

### Decide in a loop

```ts
const results = await xonus.decideBatch(
  tickets.map((ticket) => ({
    state: ticket.body,
    question: 'Route this ticket.',
    options: ['Billing', 'Engineering', 'Sales'],
  })),
  { concurrency: 4 },
);
```

Results preserve input order. A batch fails fast; pass a shared `AbortSignal` in `options.signal` to cancel everything.

## Configuration

```ts
const xonus = new Xonus({
  apiKey: process.env.GEMINI_API_KEY!,
  modelName: 'gemini-2.5-flash',
  tau: 6.0,
  answerMassGate: 0.99,
});
```

| Option | Default | Description |
| --- | --- | --- |
| `apiKey` | — | Google AI Studio API key. Required unless `client` is supplied. |
| `modelName` | `gemini-2.5-flash` | Any Gemini model that supports `responseLogprobs`. |
| `tau` | `6.0` | Log-odds margin required to accept a decision early. `0` accepts any margin. |
| `answerMassGate` | `0.99` | Minimum probability mass on valid options. Lower it for more permissive automation. |
| `topLogprobs` | `20` | Candidate tokens requested per step (1–20). |
| `maxOutputTokens` | `512` | Token budget for the deliberation pass. |
| `temperature` | `0` | Deliberation sampling temperature. The fast pass is always `0`. |
| `escalate` | `true` | Run a second, deliberate pass when the fast pass is not accepted. |
| `includeRationale` | `true` | Return the short justification from a deliberation pass. |
| `timeoutMs` | `30000` | Deadline for the whole decision. |
| `maxRetries` | `2` | Retries for 429, 5xx, and network failures at request startup. |
| `generationConfig` | — | Extra Gemini config (`thinkingConfig`, safety settings, etc.). Logprobs are forced on. |
| `client` | — | A pre-built `GoogleGenAI` instance for custom auth/proxies/tests. |

## How a decision is made

```
decide(request)
   │
   ├─ Fast pass: one short, temperature-0 request with logprobs
   │     └─ accepted if logOdds >= tau AND answerMass >= gate
   │           → return in one pass, no reasoning tokens
   │
   ├─ Deliberation pass (streamed, only if needed)
   │     ├─ read justification + "FINAL ANSWER: B"
   │     ├─ watch logprobs at the answer token
   │     └─ abort the stream as soon as logOdds >= tau
   │
   └─ Quality gate: confident = gatePassed && decisive
```

`probabilities` are re-normalized over the options you supplied. `answerMass` is *not* re-normalized: it is the raw mass the model put on valid option tokens, which is why it can reveal an off-protocol answer.

### Response

```ts
interface DecisionResponse {
  decision: string;                      // chosen option, verbatim
  probabilities: Record<string, number>; // keyed by option text, sums to 1
  confidence: number;                    // probability of the chosen option
  logOdds: number;                       // margin between top two (capped at 99)
  answerMass: number;                    // raw mass on valid options
  gatePassed: boolean;
  decisive: boolean;
  confident: boolean;                    // gatePassed && decisive
  optionIndex: number;
  escalated: boolean;
  earlyStopped: boolean;
  passes: 1 | 2;
  source: 'fast' | 'deliberate' | 'text';
  model: string;
  latencyMs: number;
  rationale?: string;
  notes: string[];
}
```

`confidence` is evidence, not a promise. Use `confident` for automation decisions, and route `false` to a human or a larger model.

## Errors

```ts
import {
  XonusError,
  XonusConfigError,
  XonusInputError,
  XonusApiError,
  XonusParseError,
  XonusAbortError,
  XonusTimeoutError,
} from 'xonus';
```

All errors extend `XonusError` and carry a stable `code` (`XONUS_CONFIG`, `XONUS_INPUT`, `XONUS_API`, `XONUS_PARSE`, `XONUS_ABORTED`, `XONUS_TIMEOUT`).

## Tuning

- **Too many human escalations?** Lower `answerMassGate` to `0.95` and/or `tau` to `4`.
- **Need maximum precision?** Raise `tau` to `8` (≈ 2,980:1) and keep the gate at `0.99`.
- **Cheapest possible mode:** `{ escalate: false, maxRetries: 1 }`. One short request per decision.
- **Latency-sensitive:** keep `escalate: true` but set `timeoutMs: 5000` and handle `XonusTimeoutError`.
- **Reasoning models:** pass `generationConfig: { thinkingConfig: { thinkingBudget: 256 } }`. Xonus defaults thinking to `0` for predictable cost and logprobs.

## Model requirements

The model must support token log probabilities via `responseLogprobs` (Gemini 2.5 Flash and compatible models do). If logprobs are unavailable, Xonus falls back to reading the text answer and returns `confidence: 0`, `answerMass: 0`, and `confident: false` — never a fabricated probability.

Because only the top `topLogprobs` candidates are returned, `answerMass` is a lower bound on the model's true mass on the options. A gate of `0.99` is deliberately strict.

## Development

```bash
npm install
npm run typecheck
npm test
npm run build
npm pack --dry-run
```

## License

MIT
