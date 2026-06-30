/* MindFlex — Static registry of available sub-games
 * Spec: docs/PRD.md §11.1.4 (Main Content Grid)
 *       docs/Architecture.md §5 (Edge Router)
 *
 * Each game has a `path` that maps to the dynamic Cloudflare Worker Router.
 * The router maps `/games/:category/:game_id/*` to `game-:category-:game_id.pages.dev`.
 * MVP scope (PRD §20) ships only Flash Matrix under the Memory category.
 */

export const GAMES = [
  {
    id: 'flashmatrix',
    title: 'Flash Matrix',
    category: 'memory',
    categoryLabel: 'Memory',
    path: '/games/memory/flashmatrix/index.html',
    difficulty: 'Medium',
    icon: '▣',
  },
  {
    id: 'color-stroop',
    title: 'Color Stroop',
    category: 'focus',
    categoryLabel: 'Focus',
    path: '/games/focus/color-stroop/index.html',
    difficulty: 'Hard',
    icon: '◐',
    disabled: true,
  },
  {
    id: 'grid-rotator',
    title: 'Grid Rotator',
    category: 'spatial',
    categoryLabel: 'Spatial',
    path: '/games/spatial/grid-rotator/index.html',
    difficulty: 'Hard',
    icon: '◊',
    disabled: true,
  },
  {
    id: 'speed-search',
    title: 'Speed Search',
    category: 'speed',
    categoryLabel: 'Speed',
    path: '/games/speed/speed-search/index.html',
    difficulty: 'Easy',
    icon: '⚡',
    disabled: true,
  },
  {
    id: 'logic-deduction',
    title: 'Logic Deduction',
    category: 'logic',
    categoryLabel: 'Logic',
    path: '/games/logic/logic-deduction/index.html',
    difficulty: 'Medium',
    icon: '∴',
    disabled: true,
  },
];

export function gameById(id) {
  return GAMES.find(g => g.id === id) || null;
}
