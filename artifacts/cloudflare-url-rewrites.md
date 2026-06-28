# Cloudflare URL Rewrite Rules (set in the Cloudflare dashboard or via API)

## Rule 1: rewrite /games/memory/flashmatrix/* to the game sub-project
```
Expression:        http.request.uri.path matches "^/games/memory/flashmatrix(/.*)?$"
Action:            Rewrite
Destination URL:   https://game-memory-flashmatrix.pages.dev${matched_uri}
Status:            301 (or 302)
```

## Rule 2: rewrite /sdk/* to the dashboard's own deployment (no-op since it lives in brain-hub-homepage, but listed for clarity)
```
Expression:        http.request.uri.path matches "^/sdk/.*$"
Action:            Rewrite
Destination URL:   https://brain-hub-homepage.pages.dev${matched_uri}
```

## Production host
- Dashboard: `https://brain-hub-homepage.pages.dev` mapped via Cloudflare for SaaS to `https://maxithome.com/`
- Game:      `https://game-memory-flashmatrix.pages.dev` served at `https://maxithome.com/games/memory/flashmatrix/*`

The Cloudflare for SaaS custom hostname config:
- Origin: brain-hub-homepage.pages.dev
- Fallback origin: game-memory-flashmatrix.pages.dev (per-rule)
