# Xonus

A model-agnostic decision engine with **log-odds early stopping** and an **answer-mass quality gate**.

Xonus works with Gemini, OpenAI-compatible APIs (OpenAI, OpenRouter, Groq, Ollama, vLLM, and more), Anthropic, or a custom provider adapter. Calibrated confidence uses token logprobs when the provider exposes them; text-only models still return a flagged decision.

[![Contribute on GitHub](https://img.shields.io/badge/Contribute-GitHub-181717?logo=github&logoColor=white)](https://github.com/urkiddennn/Xonus)
[![Sponsor Xonus](https://img.shields.io/badge/Sponsor-GitHub%20Sponsors-ea4aaa?logo=github&logoColor=white)](https://github.com/sponsors/urkiddennn)

```
Xonus/
├── sdk/        # the `xonus` npm package (TypeScript, ESM + CJS)
├── landing/    # Astro landing page + documentation site
└── animation/  # 32-second HyperFrames motion-graphics promo
```

## SDK

```bash
cd sdk
npm install
npm run build
npm test
```

```ts
import { Xonus } from 'xonus';

const xonus = Xonus.fromEnv();
const result = await xonus.decide({
  question: 'Which team should handle this ticket?',
  options: ['Billing', 'Engineering'],
});

if (result.confident) route(result.decision);
```

Swap the backend without changing the call site:

```ts
const xonus = new Xonus({
  provider: 'openai',          // gemini | openai | anthropic
  apiKey: process.env.OPENAI_API_KEY!,
  modelName: 'gpt-4o-mini',
});
```

See [`sdk/README.md`](sdk/README.md) for the full API and provider guide.

## Landing page and docs

The site is an [Astro](https://astro.build) project (Node 22.22+ for the site
toolchain; the SDK itself supports Node 18+). Code samples are highlighted at build
time with Astro's built-in `<Code>` component.

```bash
npm run dev:landing      # http://localhost:4173
npm run build:landing    # static output in landing/dist
npm run preview:landing  # preview the production build
npm run check:landing    # Astro type/diagnostic check
```

Structure:

```
landing/
├── src/
│   ├── pages/
│   │   ├── index.astro     # landing page (/)
│   │   └── docs.astro      # documentation (/docs)
│   ├── layouts/Layout.astro
│   ├── components/         # Nav, Footer, CodeBlock
│   ├── data/snippets.ts    # shared, syntax-highlighted code samples
│   └── styles/global.css
├── public/                 # logo, favicon, client-side interactions
└── astro.config.mjs
```

- Landing page: `landing/src/pages/index.astro`
- Documentation: `landing/src/pages/docs.astro`
- Benchmark card and AnyJev comparison: `#benchmark` / `#anyjev` on both pages

## Promotional video

The `animation/` project is a 32-second, 1920×1080 HyperFrames promo. It is
plain HTML/CSS/GSAP plus a deterministic original score, rendered to MP4.

```bash
npm run dev:animation      # HyperFrames Studio preview
npm run check:animation    # lint + runtime + layout + motion + contrast
npm run render:animation   # output in animation/output/xonus-promo.mp4
npm run score:animation    # regenerate the 120 BPM score
```

See [`animation/README.md`](animation/README.md), [`animation/BRIEF.md`](animation/BRIEF.md),
and [`animation/STORYBOARD.md`](animation/STORYBOARD.md).

## Publishing the package

The package name `xonus` is available on npm as of this scaffold.

```bash
cd sdk
npm run build
npm publish --access public
```

Build everything (SDK + site) with `npm run build:all`.

Publishing requires an authenticated npm account (`npm login`). Publishing is intentionally not automated from this repository.

## Contributing and sponsorship

Xonus is MIT licensed and developed in public.

- **Contribute:** [github.com/urkiddennn/Xonus](https://github.com/urkiddennn/Xonus) — issues, fixes, provider adapters, and docs are welcome.
- **Sponsor / donate:** [github.com/sponsors/urkiddennn](https://github.com/sponsors/urkiddennn) — sponsorship directly supports maintenance and new provider integrations.

## License

MIT
