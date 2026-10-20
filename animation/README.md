# Xonus — promotional video

A 32-second motion-graphics promo for Xonus, authored as HTML in
[HyperFrames](https://hyperframes.heygen.com) and rendered to MP4.

- **Canvas:** 1920×1080 (16:9), 30fps
- **Length:** 32 seconds
- **Narration:** none
- **Score:** original 120 BPM synth cue, generated deterministically
- **Output:** `output/xonus-promo.mp4` (poster: `output/xonus-promo-poster.jpg`)

The film follows the product's real story: most models keep talking after the
answer is settled, Xonus stops on log-odds, gates confidence with answer mass,
works with any backend, and gives you one boolean that is safe to branch on.

## Commands

```bash
npm run dev       # HyperFrames Studio preview
npm run check     # lint + runtime + layout + motion + contrast
npm run render    # render output/xonus-promo.mp4
npm run score     # regenerate the original music score
npm run build     # score + render
```

Requirements: Node 22+ and FFmpeg on `PATH`.

The render is deterministic: the same HTML, fonts, and audio produce the same
frames. The only network request is the initial HyperFrames CLI install; the
composition itself uses local GSAP and local font files.

## Structure

```
animation/
├── index.html                    # root composition: shared world, chrome, audio, 7 scene slots
├── compositions/
│   ├── scene-01-intro.html
│   ├── scene-02-problem.html
│   ├── scene-03-early-stop.html
│   ├── scene-04-gate.html
│   ├── scene-05-backends.html
│   ├── scene-06-proof.html
│   └── scene-07-outro.html
├── assets/
│   ├── base.css                  # brand tokens + shared chrome
│   ├── fonts/                    # local Inter / Space Grotesk / JetBrains Mono
│   ├── vendor/gsap.min.js
│   └── audio/xonus-score.mp3
├── scripts/build-score.mjs       # deterministic score generator
├── frame.md                      # design spec
├── BRIEF.md                      # confirmed creative brief
├── STORYBOARD.md                 # beat sheet + layer plan
└── output/
    ├── xonus-promo.mp4           # delivery render
    └── xonus-promo-poster.jpg    # poster frame
```

## Editing

- **Timing / scene order:** the seven `data-composition-src` slots in
  `index.html`. Each slot has `data-start` and `data-duration`; the root has
  `data-duration="32"`.
- **Look / brand:** `assets/base.css` and the per-scene `<style>` blocks.
- **Copy / choreography:** the scene files. Each scene registers one paused
  GSAP timeline on `window.__timelines["<composition-id>"]`.
- **Music:** `scripts/build-score.mjs` (edit the arrangement, then
  `npm run score`). The audio file is 32 seconds; if you change the film length,
  update the score and the root `data-duration` together.
- **Preview:** `npm run dev`, or `npx hyperframes preview --background` for a
  persistent Studio server.

The seven scenes are transparent sub-compositions over one shared background.
That is deliberate: the film should feel like one continuous instrument, not
seven slides. Scene-local ghost type, chart panels, and ring gauges are
intentionally full-bleed or partly off-canvas; the layout opt-out attributes
are there to keep the audits focused on readable content.

## Design notes

- Palette and type come from the landing page: `#05070b` canvas, `#b8ff5c`
  signal, `#5ce1e6` calibration cyan, `#a99cff` syntax violet.
- The mark is an inline SVG recreation of `landing/public/assets/logo.svg`,
  drawn on with `pathLength` dash offsets.
- The terminal response uses the landing page's sample values exactly.
- The outro pairs the install command with a GitHub contribution pill and a Sponsor/donate pill.
- No stock footage, no stock music, no third-party logo assets.
