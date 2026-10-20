// Code samples shared by the landing page and the docs.
// Kept as plain strings so Astro's <Code> component can highlight them safely.

export const snippets = {
  decide: `import { Xonus } from 'xonus';

const xonus = Xonus.fromEnv();

const result = await xonus.decide({
  state: ticket.body,
  question: 'Which team should handle this ticket?',
  options: ['Billing', 'Engineering', 'Sales'],
});

if (result.confident) {
  await route(result.decision);
} else {
  // Low answer mass or a narrow margin: don't guess.
  await escalateToHuman(result);
}`,
  providerGemini: `import { Xonus } from 'xonus';

const xonus = new Xonus({
  provider: 'gemini',
  apiKey: process.env.GEMINI_API_KEY!,
  modelName: 'gemini-2.5-flash',
});`,
  providerOpenAI: `import { Xonus } from 'xonus';

const xonus = new Xonus({
  provider: 'openai',
  apiKey: process.env.OPENAI_API_KEY!,
  modelName: 'gpt-4o-mini',
});`,
  providerLocal: `const xonus = new Xonus({
  provider: 'openai',                 // OpenAI-compatible API
  baseURL: 'http://localhost:11434/v1', // Ollama
  modelName: 'llama3.2',
  logprobs: false,                    // text-only model
});`,
  providerAnthropic: `const xonus = new Xonus({
  provider: 'anthropic',
  apiKey: process.env.ANTHROPIC_API_KEY!,
  modelName: 'claude-3-5-haiku-latest',
});`,
  providerCustom: `import { Xonus } from 'xonus';
import type { XonusProvider } from 'xonus';

const provider: XonusProvider = {
  id: 'my-model',
  async generate(request) {
    const result = await myModel.complete(request);
    return { text: result.text, steps: result.logprobs ?? [] };
  },
  async stream(request) {
    return myModel.stream(request);
  },
};

const xonus = new Xonus({ provider, modelName: 'my-model-v1' });`,
  providerResponse: `{
  "decision": "Billing",
  "confidence": 0.998,
  "logOdds": 6.21,
  "answerMass": 0.999,
  "confident": true,
  "provider": "openai",
  "model": "gpt-4o-mini",
  "passes": 1,
  "source": "fast"
}`,
  landingResult: `{
  "decision": "Billing",
  "probabilities": {
    "Billing": 0.998,
    "Engineering": 0.002,
    "Sales": 0
  },
  "confidence": 0.998,
  "logOdds": 6.21,
  "answerMass": 0.999,
  "gatePassed": true,
  "decisive": true,
  "confident": true,
  "escalated": false,
  "earlyStopped": true,
  "passes": 1,
  "source": "fast",
  "provider": "gemini",
  "latencyMs": 184,
  "notes": []
}`,
  batch: `const results = await xonus.decideBatch(
  tickets.map((ticket) => ({
    state: ticket.body,
    question: 'Route this ticket.',
    options: ['Billing', 'Engineering', 'Sales'],
  })),
  { concurrency: 4 },
);

const needsReview = results.filter((r) => !r.confident);`,
  hello: `import { Xonus } from 'xonus';

const xonus = Xonus.fromEnv();

const result = await xonus.decide({
  question: 'Is this message a refund request?',
  options: ['Yes', 'No'],
});

if (result.confident && result.decision === 'Yes') {
  await openRefundFlow();
}`,
  install: `npm install xonus`,
  envFile: `# Pick a provider. Gemini is the default.
XONUS_PROVIDER="gemini"       # gemini | openai | anthropic
XONUS_API_KEY="your-key"      # or GEMINI_API_KEY / OPENAI_API_KEY / ANTHROPIC_API_KEY
# XONUS_BASE_URL="https://api.openai.com/v1"
# XONUS_MODEL="gpt-4o-mini"`,
  powershell: `# Pick the provider that matches your key.
$env:XONUS_PROVIDER = "gemini"
$env:GEMINI_API_KEY = "your-key-here"
# $env:OPENAI_API_KEY = "your-key-here"
# $env:ANTHROPIC_API_KEY = "your-key-here"`,
  esm: `import { Xonus, createXonus } from 'xonus';`,
  commonjs: `const { Xonus, createXonus } = require('xonus');`,
  triage: `import { Xonus } from 'xonus';

const xonus = new Xonus({
  provider: 'gemini',
  apiKey: process.env.GEMINI_API_KEY!,
  modelName: 'gemini-2.5-flash',
  tau: 6.0,               // log-odds needed to accept early
  answerMassGate: 0.99,      // mass needed on valid options
});

const result = await xonus.decide({
  state: 'Customer: "I was charged twice for order #4412."',
  question: 'Which team should handle this ticket?',
  options: ['Billing', 'Engineering', 'Sales'],
});

console.log(result.decision);   // "Billing"
console.log(result.confident);  // true
console.log(result.logOdds);    // 6.21`,
  routeOnConfidence: `if (result.confident) {
  await route(result.decision);
} else {
  // Send the evidence to a human or a stronger fallback.
  await reviewQueue.push({
    decision: result.decision,
    probabilities: result.probabilities,
    answerMass: result.answerMass,
    logOdds: result.logOdds,
  });
}`,
  fromEnv: `const xonus = Xonus.fromEnv({
  provider: 'openai',      // optional: inferred from env when omitted
  modelName: 'gpt-4o-mini',
  tau: 4.5,
});`,
  fastConfig: `{
  // Gemini fields; other adapters request the same evidence.
  responseLogprobs: true,
  logprobs: 20,
  temperature: 0,
  thinkingConfig: { thinkingBudget: 0 },
}`,
  conditions: `logOdds   >= tau              // decisive
answerMass >= answerMassGate  // on-protocol`,
  finalAnswer: `Option B best matches the reported stack trace.
FINAL ANSWER: B`,
  advancedConfig: `const xonus = new Xonus({
  provider: 'gemini',
  apiKey: process.env.GEMINI_API_KEY!,
  modelName: 'gemini-2.5-flash',
  tau: 7,
  answerMassGate: 0.995,
  topLogprobs: 20,
  maxOutputTokens: 768,
  timeoutMs: 12_000,
  maxRetries: 1,
  generationConfig: {
    thinkingConfig: { thinkingBudget: 256 },
    safetySettings: [/* ... */],
  },
});`,
  apiResponse: `{
  "decision": "Engineering",
  "probabilities": {
    "Billing": 0.002,
    "Engineering": 0.997,
    "Sales": 0.001
  },
  "confidence": 0.997,
  "logOdds": 6.21,
  "answerMass": 0.998,
  "gatePassed": true,
  "decisive": true,
  "confident": true,
  "optionIndex": 1,
  "escalated": true,
  "earlyStopped": true,
  "passes": 2,
  "source": "deliberate",
  "provider": "gemini",
  "model": "gemini-2.5-flash",
  "latencyMs": 612,
  "rationale": "The stack trace points to the deploy pipeline.",
  "notes": []
}`,
  batchAdvanced: `const results = await xonus.decideBatch(
  tickets.map((ticket) => ({
    state: ticket.body,
    question: 'Route this ticket.',
    options: ['Billing', 'Engineering', 'Sales'],
  })),
  {
    concurrency: 6,
    signal: request.signal,
  },
);

const confident = results.filter((result) => result.confident);
const review = results.filter((result) => !result.confident);`,
  errorHandling: `import {
  XonusError,
  XonusTimeoutError,
  XonusParseError,
} from 'xonus';

try {
  const result = await xonus.decide(request);
  return result;
} catch (error) {
  if (error instanceof XonusTimeoutError) {
    return fallbackDecision();
  }
  if (error instanceof XonusParseError) {
    return reviewQueue.push(request);
  }
  if (error instanceof XonusError) {
    logger.warn({ code: error.code, message: error.message });
  }
  throw error;
}`,
  supportTriage: `const result = await xonus.decide({
  state: ticket.body,
  question: 'Which team should handle this ticket?',
  options: ['Billing', 'Engineering', 'Sales'],
});

return result.confident
  ? routeTo(result.decision)
  : enqueueForReview(ticket, result);`,
  toolRouting: `const result = await xonus.decide({
  state: conversationSummary,
  question: 'Which tool should handle the next step?',
  options: [
    'search_docs',
    'create_invoice',
    'ask_clarifying_question',
  ],
});

if (!result.confident) return askClarifyingQuestion();
return tools[result.decision]();`,
  moderation: `const result = await xonus.decide({
  state: comment,
  question: 'How should this comment be handled?',
  options: ['Allow', 'Review', 'Remove'],
});

if (result.confident && result.decision === 'Allow') {
  return publish(comment);
}
return sendToModerator(comment, result);`,
  leadScoring: `const result = await xonus.decide({
  state: JSON.stringify(lead),
  question: 'What priority should this lead receive?',
  options: ['Hot', 'Warm', 'Cold'],
});

if (result.confident) {
  crm.update(lead.id, { priority: result.decision });
}`,
  publishSteps: `# from the repository root
cd sdk
npm install
npm run typecheck
npm test
npm run build
npm pack --dry-run`,
  publishCommand: `npm login
npm publish --access public`,
  packageContents: `dist/
  index.js       ESM
  index.cjs      CommonJS
  index.d.ts     ESM types
  index.d.cts    CommonJS types
README.md
LICENSE`,
} as const;

export type SnippetKey = keyof typeof snippets;
