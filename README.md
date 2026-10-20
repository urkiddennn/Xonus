# Xonus

A Gemini-native decision engine with **log-odds early stopping** and an **answer-mass quality gate**.

```
Xonus/
├── sdk/        # the `xonus` npm package (TypeScript, ESM + CJS)
└── landing/    # Astro landing page + documentation site
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

See [`sdk/README.md`](sdk/README.md) for the full API.

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

## Publishing the package

The package name `xonus` is available on npm as of this scaffold.

```bash
cd sdk
npm run build
npm publish --access public
```

Build everything (SDK + site) with `npm run build:all`.

Publishing requires an authenticated npm account (`npm login`). Publishing is intentionally not automated from this repository.

## License

MIT
