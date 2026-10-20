# Xonus site

Astro site for the Xonus landing page and documentation. Requires Node 22.22+.
```bash
npm install
npm run dev       # http://localhost:4173
npm run build     # static output in dist/
npm run preview
npm run check
```

From the repository root, use `npm run dev:landing`, `npm run build:landing`,
`npm run preview:landing`, and `npm run check:landing`.

## Structure

- `src/pages/index.astro` — landing page, provider band, 50-scenario benchmark, AnyJev comparison
- `src/pages/docs.astro` — documentation, provider guide, benchmark, and comparison
- `src/layouts/Layout.astro` — shared document shell
- `src/components/Nav.astro`, `Footer.astro`, `CodeBlock.astro`
- `src/components/GitHubIcon.astro`, `HeartIcon.astro` — contribution and sponsor icons
- `src/data/snippets.ts` — code samples shared across pages
- `src/data/site.ts` — repo, issues, npm, and sponsor links
- `src/styles/global.css` — design system, benchmark animation, and page styles
- `public/main.js` — navigation, tabs, copy buttons, scroll reveal, scrollspy, benchmark counters
- `public/assets/` — logo and favicon

Code samples are rendered at build time with Astro's built-in `<Code>` component
(Shiki), so they are highlighted without shipping a client-side highlighter.
The copy buttons in `public/main.js` read the rendered code text.
