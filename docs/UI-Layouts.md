# UI Layouts: MindFlex

## 1. Global Layout Grid

MindFlex uses a flexible layout consisting of a **Top Bar**, a collapsible **Sidebar**, and the **Main Stage Area**.

### 1.1 Responsive Grid Allocation
*   **Desktop Mode (Width ≥ 1024px)**:
    *   *Top Bar*: 100% width, height `64px`.
    *   *Left Sidebar*: Fixed width `240px`, height `calc(100vh - 64px)`.
    *   *Main Stage*: Left margin `240px`, width `calc(100% - 240px)`.
*   **Mobile Mode (Width < 768px)**:
    *   *Top Bar*: 100% width, height `56px`.
    *   *Sidebar*: Off-screen drawer. Opens via Hamburg Icon button in Top Bar.
    *   *Main Stage*: 100% width, height `calc(100vh - 56px)`.

---

## 2. Wireframe: Lobby Dashboard (Desktop)

```
+-----------------------------------------------------------------------------------+
|  [Logo] MindFlex       [Ticker: Player Anonymous-4021 scored 850!]        (920) [A] |
+------------------+----------------------------------------------------------------+
|  [ ] Daily Goals |  Filter Tags: [Memory] [Focus] [Logic] [Speed] [Spatial]       |
|  Streaks: 4 Days |                                                                |
|  Progress: [2/3] |  +--------------------+  +--------------------+  +----------+  |
|  ────────────────|  | Card: Flash Matrix |  | Card: Color Stroop |  | Card...  |  |
|  [Tag Filters]   |  | Tag: Memory        |  | Tag: Focus         |  |          |  |
|  [x] Memory      |  | Diff: Medium       |  | Diff: Hard         |  |          |  |
|  [ ] Focus       |  | Personal Best: 920 |  | Personal Best: --  |  |          |  |
|  [ ] Logic       |  +--------------------+  +--------------------+  +----------+  |
|  [ ] Speed       |                                                                |
|  [ ] Spatial     |  +--------------------+  +--------------------+                |
|                  |  | Card: Grid Rotator |  | Card: Speed Search |                |
|                  |  | Tag: Spatial       |  | Tag: Speed         |                |
|                  |  | Diff: Hard         |  | Diff: Easy         |                |
|                  |  | Personal Best: 610 |  | Personal Best: 720 |                |
|                  |  +--------------------+  +--------------------+                |
+------------------+----------------------------------------------------------------+
```

*   `[A]`: User Avatar. Clicking this slides open the Profile Dropdown overlay.
*   `(920)`: Real-time global brain score.
*   `[2/3]`: Interactive Daily Progress indicator.

---

## 3. Wireframe: Game Stage Viewport (Aspect-Ratio Locked Letterbox)

This layout displays the centered, aspect-locked sub-game sandbox container.

```
+-----------------------------------------------------------------------------------+
|  [◄ Back to Lobby]    Game Title: Flash Matrix - Memory Training                  |
+-----------------------------------------------------------------------------------+
|                                                                                   |
|                   +-------------------------------------------+                   |
|                   |  Canvas Stage Area (aspect-ratio: 1 / 1)  |                   |
|                   |                                           |                   |
|  Black Margin     |  +-------------------------------------+  |      Black Margin |
|  (Left Border)    |  | Game Grid Grid (Visual flash grid)  |  |     (Right Border)|
|                   |  +-------------------------------------+  |                   |
|                   |                                           |                   |
|                   |  +-------------------------------------+  |                   |
|                   |  | In-Game Settings: [Audio] [Retry]   |  |                   |
|                   |  +-------------------------------------+  |                   |
|                   +-------------------------------------------+                   |
|                                                                                   |
+-----------------------------------------------------------------------------------+
```

---

## 4. Wireframe: Profile Dropdown Overlay (Slide-down Sheet)

When the user clicks the Avatar `[A]` in the Top Bar, this sheet slides down over the main content:

```
                                                                           [Close X]
+-----------------------------------------------------------------------------------+
|  COGNITIVE PROFILE & PROGRESS                                                     |
|                                                                                   |
|  +---------------------------------------+  +----------------------------------+  |
|  | RADAR CHART (Chart.js Panel)          |  | ACHIEVEMENTS & BACKUP            |  |
|  |                                       |  |                                  |  |
|  |                Memory                 |  | Streak: [ 4 Days ]               |  |
|  |                 /  \                  |  | Badges:                          |  |
|  |          Speed /    \ Focus           |  | [MEM_1] [FOC_FAST]               |  |
|  |            |     *   |                |  |                                  |  |
|  |          Spatial \  / Logic           |  | Recovery Code:                   |  |
|  |                 \  /                  |  | [ tiger-autumn-breeze-crimson ]  |  |
|  |                 (AI Threat overlay)   |  | [ Copy Code ]                    |  |
|  +---------------------------------------+  +----------------------------------+  |
|                                                                                   |
|  [ Import Token: [                  ] [Restore] ]          [ Delete All Data ]     |
+-----------------------------------------------------------------------------------+
```

*   `*`: Denotes current user rating overlay.
*   `(AI Threat overlay)`: Represents the shaded crimson replacement threat line polygon.
