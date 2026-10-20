# Fonts

Local WOFF2 subsets used by the promo so renders do not depend on a network
font fetch.

| File | Family | Source | License |
| --- | --- | --- | --- |
| `inter.woff2` | Inter (variable) | `@fontsource-variable/inter` | SIL Open Font License 1.1 |
| `space-grotesk.woff2` | Space Grotesk (variable) | `@fontsource-variable/space-grotesk` | SIL Open Font License 1.1 |
| `jetbrains-mono.woff2` | JetBrains Mono (variable) | `@fontsource-variable/jetbrains-mono` | SIL Open Font License 1.1 |

The `@font-face` declarations live in `../base.css` and use absolute
`/assets/fonts/...` paths so they resolve both from `index.html` and from the
mounted sub-compositions.
