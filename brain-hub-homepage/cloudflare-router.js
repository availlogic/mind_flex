export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Intercept dynamic games registry endpoint
    if (url.pathname === '/api/v1/games/registry' && request.method === 'GET') {
      let gamesJson = null;
      if (env.MINDFLEX_REGISTRY) {
        gamesJson = await env.MINDFLEX_REGISTRY.get('games_list');
      }
      // Fallback default listing containing the benchmark game
      if (!gamesJson) {
        gamesJson = JSON.stringify([
          {
            id: 'flashmatrix',
            title: 'Flash Matrix',
            category: 'memory',
            categoryLabel: 'Memory',
            path: '/games/memory/flashmatrix/index.html',
            difficulty: 'Medium',
            icon: '▣',
          }
        ]);
      }
      return new Response(gamesJson, {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    // API requests

    if (url.pathname.startsWith('/api/')) {
      url.hostname = 'mindflex-api.maxithome.com';

      // Clear 'host' in the requests (cloudflare will recreate it based on the 'url.hostname')
      const newHeaders = new Headers(request.headers);
      newHeaders.delete('host');
      
      const fetchOptions = {
        method: request.method,
        headers: newHeaders
      };
      if (request.method !== 'GET' && request.method !== 'HEAD') {
        fetchOptions.body = request.body;
      }

      return fetch(url.toString(), fetchOptions);
    }

    // Dynamic routing for games: /games/:tag/:game_id/
    // Example: /games/memory/flashmatrix/ -> game-memory-flashmatrix.pages.dev/
    const gameMatch = url.pathname.match(/^\/games\/([^\/]+)\/([^\/]+)(\/.*)?$/);
    if (gameMatch) {
      const tag = gameMatch[1];
      const gameId = gameMatch[2];
      const rest = gameMatch[3] || '';

      if (!rest) {
        // Redirect to add trailing slash: e.g., /games/memory/flashmatrix -> /games/memory/flashmatrix/
        url.pathname = `/games/${tag}/${gameId}/`;
        return Response.redirect(url.toString(), 301);
      }

      // Route request to the specific game's Pages project
      url.hostname = `game-${tag}-${gameId}.pages.dev`;
      url.pathname = rest;
      return fetch(url.toString());
    }

    // Other requests (Dashboard homepage)
    url.hostname = 'brain-hub-homepage.pages.dev';
    return fetch(url.toString());
  }
};
