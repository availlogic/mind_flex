# Cloudflare Routing & Worker Router Configurations

To achieve a same-origin Multi-Page Application (MPA) where the dashboard and sub-games share the same browser storage (`LocalStorage`, `IndexedDB`), all requests must route through a single origin (e.g., `mindflex-hub.maxithome.com`).

Since standard Cloudflare URL Transform Rules (Rewrite URL) are restricted to path rewriting on the same origin and cannot rewrite the target hostname to another Cloudflare Pages project, a **Cloudflare Worker** is used as a reverse proxy router.

## 1. Cloudflare Worker Router Code (`mindflex-router`)

Deploy a Cloudflare Worker with the following script:

```javascript
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    
    // 1. Copy original headers and remove the 'host' header.
    // This allows the fetch call to auto-generate the correct Host header based on url.hostname.
    const newHeaders = new Headers(request.headers);
    newHeaders.delete('host');

    // 2. Build options, only attaching body for non-GET/HEAD requests to prevent fetch crash
    const fetchOptions = {
      method: request.method,
      headers: newHeaders
    };
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      fetchOptions.body = request.body;
    }

    // 3. API Requests: Forward to the Cloudflare Tunnel hostname
    if (url.pathname.startsWith('/api/')) {
      url.hostname = 'mindflex-api.maxithome.com';
      return fetch(url.toString(), fetchOptions);
    }

    // 4. Game root trailing slash redirection (forces relative asset resolution to work correctly)
    if (url.pathname === '/games/memory/flashmatrix') {
      url.pathname = '/games/memory/flashmatrix/';
      return Response.redirect(url.toString(), 301);
    }

    // 5. Game Assets: Strip the prefix and fetch from the game Pages project
    if (url.pathname.startsWith('/games/memory/flashmatrix/')) {
      url.hostname = 'game-memory-flashmatrix.pages.dev';
      url.pathname = url.pathname.replace('/games/memory/flashmatrix/', '/');
      return fetch(url.toString()); // Simple GET fetch without request headers/body
    }

    // 6. Dashboard Assets: Fetch from the host dashboard Pages project
    url.hostname = 'brain-hub-homepage.pages.dev';
    return fetch(url.toString()); // Simple GET fetch without request headers/body
  }
};
```

## 2. Trigger Routes
In the Worker's **Domains** tab (or **Settings -> Triggers**), add the following:
*   **Route**: `mindflex-hub.maxithome.com/*`
*   **Zone**: `maxithome.com`

This intercepts all traffic to the dashboard subdomain and runs the routing logic at the edge.

## 3. Production Domains Setup
*   **Worker Router**: Handles `https://mindflex-hub.maxithome.com`
*   **Dashboard Pages (Target)**: `https://brain-hub-homepage.pages.dev`
*   **Game Pages (Target)**: `https://game-memory-flashmatrix.pages.dev`
*   **Backend API (Target)**: `https://mindflex-api.maxithome.com` (Cloudflare Tunnel CNAME -> `<TUNNEL_ID>.cfargotunnel.com`)
