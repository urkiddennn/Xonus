# Storyboard — Xonus promo

**Format** 1920×1080 · 30fps · 32 seconds · no narration · 120 BPM score
**Rhythm** open → pressure → explanation → release → breadth → proof → close

The film is one continuous dark instrument panel. Seven transparent scenes
move over a shared background and chrome layer. Each scene owns its own
motion; the root only handles the world, progress, audio, and the final fade.

| # | Time | Scene | What the viewer sees | Motion | Audio |
| --- | --- | --- | --- | --- | --- |
| 01 | 0.0–4.0 | **Intro / certainty** | The X tile draws in beside a 178px XONUS wordmark, then the line “Decisions that stop the moment they’re certain.” Four product facts anchor the right edge. | Tile scales in, X strokes draw, letters lift in 3D, underline sweeps, orbit ring turns, scan line crosses the mark. Exit lifts and blurs. | Low impact, bright chime, soft kick, airy pad, short riser. |
| 02 | 4.0–9.0 | **The problem / wasted certainty** | A completion stream keeps emitting tokens long after the answer “Billing” is known. The token and latency counters climb. Two chips contrast “Settled at token 3” with “Billed for 1,284.” | Headline lands line by line; panel slides in; stream scrolls continuously; counters race; chips snap in; border turns red. Exit slides left. | Clock ticks, low drone, tension riser, whoosh into the cut. |
| 03 | 9.0–15.0 | **The mechanism / early stop** | A live log-odds chart climbs toward tau 6.0. The curve crosses the threshold, the stream is cut, a stop ring locks, and a result bar reads Billing / 0.998 / 184 ms. A dashed path shows the tokens that were never generated. | Chart draws; readout counts; pass dots light; tau line pulses; stop ring snaps; abort line draws; ghost path appears; result bar rises. | Kick pulse, arpeggio, riser, impact and a short duck at the cut, confirmation chime. |
| 04 | 15.0–20.0 | **The gate / answer mass** | A 0.999 answer-mass ring fills to the 0.99 gate while the terminal response shows `confident: true`. The card says it is safe to branch. | Ring and count fill; gate tick and pill snap; card tilts in, floats, and lights a lime edge; code lines stagger; safe-to-branch footer appears. | Soft pulse, terminal ticks, shimmering pad, gate chime, flash. |
| 05 | 20.0–24.0 | **The interface / any backend** | A constellation of eight providers connects to one X core. The same call site swaps `provider: 'openai'` for `'anthropic'` and stays locked. | Core scales in, connector lines draw, nodes fly outward into place, orbit turns, provider line crossfades, core glows. Exit zooms through the core. | Provider blips, plucked arpeggio, bass pulse, whoosh. |
| 06 | 24.0–28.0 | **The proof / built for real routing** | Four oversized numbers: 6.0 tau, 0.99 gate, 1–2 passes, 0 extra infra. A use-case ticker runs beneath them. | Rule draws, columns rise, numbers count up, bars fill, ticker scrolls, ghost “ROUTING” drifts. Exit lifts columns away. | Four-on-the-floor kick, hats, bass, stat ticks, riser. |
| 07 | 28.0–32.0 | **Outro / CTA** | The X tile and XONUS lockup return over the line “Decisions that stop the moment they’re certain.” The primary CTA is `npm i xonus`; below it, a GitHub contribution pill and a Sponsor/donate pill; footer is MIT · TypeScript · ESM + CJS. | Tile pops, strokes draw, letters lift, tagline and install CTA settle, contribution/donation icons pop in, lime ring expands, end fade to black. | Impact, resolved A-major chime, wide pad, long fade. |

## Layer plan (every scene)

1. **Background** — shared lime/cyan/violet radial glows, 80px grid, grain,
   vignette. Scene-local ghost display type.
2. **Midground** — the idea: logo, stream, chart, ring, constellation, stats,
   lockup.
3. **Foreground** — kickers, hairlines, counters, chips, registration marks,
   progress, chapter readout.

## Continuity

- One brand mark, one wordmark, one accent lime.
- One continuous score at 120 BPM.
- The top-left brand and bottom progress line never leave the frame.
- Scene cuts land on the music grid: 4.0, 9.0, 15.0, 20.0, 24.0, 28.0.
- Each hard cut is bridged by a 0.3s lime/cyan light leak and a one-pixel
  scan line, so the incoming beat builds inside a designed transition rather
  than from black.
- The tau cut is 12.15s; the gate opens at 17.55s; the CTA lands at 29.72s.
