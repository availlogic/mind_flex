# Screen Specifications: MindFlex

## 1. Screen: Host Lobby Dashboard

### 1.1 Overview
*   **Screen Name**: Host Lobby (`lobby-view`)
*   **Purpose**: Act as the main hub where users browse games, view their overall scores, and access profile details.
*   **User Goals**: Quickly select a game to play and monitor their anti-AI safety score margin.

### 1.2 Layout & Hierarchy
*   **Layout Sections**:
    1.  **Top Navigation Bar**: Permanent header containing branding, global rating, live ticker, and user avatar.
    2.  **Left Sidebar (Desktop / Tablet)**: Collapsible navigation containing tag filters (visible on desktop/tablet, hidden on mobile) and daily objectives tracker.
    3.  **Main Content Grid**: Scrollable grid displaying responsive game cards, with a top horizontal tags filter bar that is visible on mobile and tablet but hidden on desktop.
*   **Responsive Behavior**:
    *   *Desktop (≥1024px)*: Left sidebar visible with full tag filters. Top horizontal tags filter bar is hidden. Main grid shows 4–6 columns.
    *   *Tablet (768px - 1023px)*: Sidebar collapses to icon-only (showing tag filter checkbox icons). Top horizontal tags filter bar is hidden (shares desktop logic). Grid shows 3 columns.
    *   *Mobile (<768px)*: Sidebar completely hidden (collapses into top bar hamburger drawer) and left sidebar tag filters are hidden inside the drawer. Top horizontal tags filter bar is visible on the main page. Grid shows 1–2 columns.

### 1.3 Key Components
*   **Global Rating Badge**:
    *   *Behavior*: Displays the cumulative average of the five cognitive ratings.
    *   *States*: Populated (shows e.g. `685` with active rating color) or Loading (shows animated dash `--`).
*   **Live Activity Ticker**:
    *   *Behavior*: Cycles through system announcements and user game-over messages in a running marquee stream.
    *   *States*: Active or Idle (hidden if offline).
*   **Game Card**:
    *   *Interactions*: Hover scales card up by `3%`. Click opens the Game Stage container.
    *   *States*: Populated (Active Title, Tag Badge, Difficulty Level indicator, and Best Score).

### 1.4 Screen States
*   **Loading**: Shows skeleton screens for cards; rating badge displays a pulse animation.
*   **Populated**: Renders grid of cards and user score state.
*   **Offline**: Disables ticker, displays a warning banner at the top, and marks cards that require backend authorization as disabled.

---

## 2. Screen: Game Stage Viewport

### 2.1 Overview
*   **Screen Name**: Game View (`game-stage-view`)
*   **Purpose**: Sandbox frame for executing games.
*   **User Goals**: Play games with zero interface distractions.

### 2.2 Layout & Hierarchy
*   **Layout Sections**:
    1.  **Stage Header**: Minimalist overlay displaying "Back to Lobby" button and current Game Title.
    2.  **Iframe Stage Area**: Centered canvas view.
*   **Responsive Behavior**:
    *   *Fluid Layout*: Logic games scale canvas to fill `100vw/100vh` boundaries.
    *   *Letterbox Layout*: Memory games lock aspect ratio using CSS `aspect-ratio: 1 / 1`. The stage remains centered horizontally and vertically, showing black margins on widescreen monitors.

### 2.3 Key Components
*   **Back to Lobby Button**:
    *   *Behavior*: Located in the top bar. Pressing discards the game state and returns to the lobby.
    *   *States*: Enabled (default) or Disabled (during scoring telemetry uploads to prevent data loss).
*   **Iframe Sandbox Container**:
    *   *Behavior*: Sandboxed sandbox stage. Renders target game page.
    *   *Attributes*: `sandbox="allow-scripts allow-same-origin"`.

---

## 3. Screen/Modal: Profile & Achievement Dropdown

### 3.1 Overview
*   **Screen Name**: Profile Overlay (`profile-dropdown-overlay`)
*   **Purpose**: Display cognitive radar charts, streaks, backup codes, and achievements.
*   **User Goals**: Review cognitive strengths and manage profile keys.

### 3.2 Layout & Hierarchy
*   **Structure**: Slides down as a side-drawer or modal card.
*   **Sections**:
    1.  **Radar Graphic Panel**: Centered Chart.js element showing cognitive ratings.
    2.  **Telemetry Streak Panel**: Displays days active count.
    3.  **Token Backup Panel**: Contains copyable recovery mnemonics and paste input fields.

### 3.3 Key Components
*   **Cognitive Radar Chart**:
    *   *Behavior*: Renders ratings across: Memory, Focus, Logic, Speed, Spatial.
    *   *Special Layer*: Renders a shaded "AI Replacement Threat Line" polygon.
*   **Recovery Token Box**:
    *   *Behavior*: Click to copy recovery string to clipboard.
    *   *Validation*: Paste input box must contain exactly 4 dash-separated words.
*   **Data Eraser Button**:
    *   *Behavior*: Triggers confirm modal. Upon confirmation, clears local storage and calls profile deletion API.
