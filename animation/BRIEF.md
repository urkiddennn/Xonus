---
workflow: product-launch-video
flow: automation
storyboard: no
message: "Xonus stops model generation the moment the answer is certain — and proves the confidence with calibrated probability mass."
destination: web / YouTube embed
aspect: "16:9"
language: en
audience: AI engineers and product teams building routing, triage, and classification
length: 32s
angle: "The engine that knows when to stop."
---

# Brief — Xonus promo

## Intent

A 32-second, unnarrated motion-graphics promo for Xonus, built from the
product's own positioning: a model-agnostic decision engine with log-odds
early stopping and an answer-mass quality gate. The film should feel like a
precision instrument, not a generic AI ad. It opens on certainty, shows the
cost of a model that keeps talking, demonstrates the early stop and the gate,
proves the provider-agnostic contract, lands four proof points, and closes on
the install command plus GitHub contribution and sponsorship CTAs.

## Reference material

- `../README.md` — product definition, API, providers.
- `../landing/src/pages/index.astro` — hero copy, terminal example, features,
  benchmark copy.
- `../landing/src/styles/global.css` — palette, typography, surfaces.
- `../landing/public/assets/logo.svg` — X mark gradient.

## Assets

- Brand tokens derived from the landing page; local WOFF2 copies of Inter,
  Space Grotesk, and JetBrains Mono in `assets/fonts/`.
- Logo recreated as inline SVG for deterministic draw-on animation.
- Original score synthesized in `scripts/build-score.mjs` (no third-party
  music, no licensing dependency).

## Customizations

- 1920×1080, 30fps, 32 seconds.
- No voiceover. Music and sound design carry the pacing.
- Seven transparent scene sub-compositions over one continuous background
  and chrome layer, so the film reads as one world rather than seven slides.
- The terminal response uses the exact example values from the landing page:
  decision Billing, confidence 0.998, logOdds 6.21, answerMass 0.999,
  confident true, passes 1, 184 ms.

## Notes

- The deliverable is intentionally a promo, not a site tour: no captured
  screenshots. The brand world is rebuilt in HTML/CSS/SVG.
- The audio is an original synth score at 120 BPM, not a stock track.
- Render command: `npm run render` → `output/xonus-promo.mp4`.
