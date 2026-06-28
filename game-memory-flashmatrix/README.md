# Flash Matrix (MindFlex sub-game)

Benchmark sub-game for the MindFlex platform. Trains spatial working memory.

## Spec Compliance

| Doc | Item | Implementation |
|---|---|---|
| `PRD.md §11.2.1` | Sandboxed iframe | Host loads this via `<iframe sandbox="allow-scripts allow-same-origin">` |
| `PRD.md §11.2.2` | Localized settings | Volume / Retry controls live inside this canvas (see `.fm-controls`) |
| `PRD.md §11.2.3` | Bridge SDK | Loads `mindflex-bridge.js` from the host origin and emits `MINDFLEX_GAME_OVER` |
| `PRD.md §11.2.4` | Aspect-locked (memory game) | `aspect-ratio: 1/1` letterbox container |
| `Visual-Guidelines.md §5` | Touch lockout rules | `touch-action: none`, `user-select: none`, viewport locked |
| `Constraints.md` | 44×44px targets | `.fm-btn` enforced ≥ 44×44 |

## Local development

```bash
# From the monorepo root or this directory:
python3 -m http.server 5174
# Then open: http://localhost:5174/
```

For production, deploy the static build output to Cloudflare Pages
(`game-memory-flashmatrix` project). The dashboard's Cloudflare URL
rewrite rule routes `maxithome.com/games/memory/flashmatrix/*` to this
project, preserving same-origin access to `LocalStorage`.

## Tests

```bash
npm install
npm test
```
