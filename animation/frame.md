---
name: Xonus — Certainty
canvas: 1920x1080
aspect: "16:9"
fps: 30
duration: 32s
source: derived from landing/src/styles/global.css and landing/public/assets/logo.svg
---

# Xonus motion frame

A dark, precision-instrument brand world for a decision engine. The visual
language is the landing page brought into motion: near-black navy, a single
lime signal, cyan and violet only as secondary data hues, hairline rules,
tabular numerals, and a persistent production chrome.

## Palette

| Token | Value | Use |
| --- | --- | --- |
| `--bg` | `#05070b` | Canvas, end fade |
| `--surface` | `#0c111a` | Panels, terminal cards |
| `--text` | `#eef2f8` | Primary copy |
| `--text-soft` | `#c3ccda` | Secondary copy |
| `--muted` | `#8e9aab` | Labels, mono metadata |
| `--accent` | `#b8ff5c` | The signal: certainty, pass, brand |
| `--cyan` | `#5ce1e6` | Calibration, probability, secondary |
| `--violet` | `#a99cff` | Syntax, keys, infrastructure |
| `--danger` | `#ff8585` | The cost of not stopping |

Accent is used at full saturation only for the thing the viewer should notice
in each beat. Backgrounds stay near-black; depth comes from radial glows,
grid lines, ghost display type, grain, and vignette.

## Typography

- **Display** — Space Grotesk, 600/700, tight tracking (`-0.05em`), 76–178px.
- **Body** — Inter, 400, 26–40px, comfortable 1.3–1.5 line height.
- **Data / chrome** — JetBrains Mono, 10–27px, uppercase tracking
  (`0.08–0.2em`), tabular numerals.

Headlines are 60–80% of frame width. Body copy never drops below 24px.
Mono labels never carry essential copy unless they are at least 12px.

## Composition

- 1920×1080, safe content inset: 140px sides, 126px top.
- Persistent chrome: brand top-left, promo metadata top-right, chapter
  readout bottom-right, 2px progress line along the bottom edge.
- Split frames over centered stacks, except the closing logo lockup.
- Every scene has a background layer (glow/grid/ghost type), a midground
  product idea, and foreground data details.
- Panels use 22–24px radii, 1px borders, and a soft lime edge glow.

## Motion

- Precise and mechanical: draw, slot, lock, count, abort.
- Eases are deliberate: `expo.out` for arrivals, `power3.inOut` for reveals,
  `power2.in` for exits, `back.out` only for small confirmations.
- Entrances 0.35–0.95s; exits 0.4–0.55s faster than entrances.
- Every scene has a build → breathe → resolve phase.
- Ambient motion is one shared background drift plus per-scene pulses; no
  decorative element is static.
- Transitions are content-led: a hard cut into the problem, a cut at tau,
  a flash into the gate, a zoom through the core, and an end fade.

## Audio

120 BPM, A minor → F major → C major → G major → A minor → F major → A major.
A synthesized score of pads, sub bass, soft kicks, ticking clocks, terminal
ticks, chimes, risers, and impacts. No narration. The score lands on the seven
scene starts and the tau cut at 12.15s.

## Do / Don't

- Do keep the lime signal rare and meaningful.
- Do use real product language from the Xonus README and landing page.
- Do keep numbers and their labels visually paired.
- Don't add generic AI sparkles, chatbot bubbles, or 3D blobs.
- Don't use full-screen linear gradients on the dark canvas.
- Don't let decorative copy compete with the headline.
