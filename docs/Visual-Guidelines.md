# Visual Guidelines: MindFlex

## 1. Design Philosophy
MindFlex is the "resistance base" of human intellect. The design uses a premium, dark, high-contrast, technical aesthetic with neon highlights (cyberpunk-inspired) to convey focus, technology, and mental clarity.

*   **Brand Personality**: Decisive, scientific, rebellious against cognitive laziness, premium.
*   **Visual Tone**: Dark Mode default, clean grids, glassmorphism overlays, vibrant neon metrics, responsive transitions.

---

## 2. Color System
The color system relies on highly specific HSL variables to maintain accessibility and control contrast on dark backgrounds.

### 2.1 Core Palette
*   **Background (Deep Slate)**: `hsl(222, 24%, 7%)`
*   **Card Background (Navy Glass)**: `hsl(223, 20%, 12%)`
*   **Border / Divider**: `hsl(223, 14%, 20%)`
*   **Text Principal (Pure Silver)**: `hsl(210, 40%, 98%)`
*   **Text Secondary (Muted Steel)**: `hsl(215, 15%, 70%)`

### 2.2 Accent & Semantic Colors
*   **Primary Neon / Memory (Cyan Tech)**: `hsl(180, 100%, 50%)`
*   **Focus / Attention (Green Matrix)**: `hsl(145, 100%, 50%)`
*   **Logic (Purple Logic)**: `hsl(270, 100%, 65%)`
*   **Speed / Warning (Orange Lightning)**: `hsl(32, 100%, 50%)`
*   **Spatial / AI Threat Alert (Crimson Resistance)**: `hsl(355, 100%, 60%)`

### 2.3 Contrast Rules
All text elements on colored backgrounds must verify a minimum contrast ratio of **4.5:1** (WCAG AA). Neon text must use glow offsets (`text-shadow`) to maintain legibility.

---

## 3. Typography
We use clean, geometric sans-serif fonts to match the technical, futuristic theme.

*   **Primary Font Family**: `Inter`, sans-serif
*   **Monospace Font Family**: `JetBrains Mono`, monospace (for numerical scores, codes, and tickers)

### Type Scale
| Element | Font Size | Line Height | Font Weight | Usage |
| :--- | :--- | :--- | :--- | :--- |
| **H1** | `2.25rem (36px)` | `1.2` | `700 (Bold)` | Main Title / Landing Headers |
| **H2** | `1.5rem (24px)` | `1.3` | `600 (SemiBold)`| Section Titles / Modal Titles |
| **Body**| `1.0rem (16px)` | `1.5` | `400 (Regular)` | Primary reading text |
| **Muted**| `0.875rem (14px)`| `1.4` | `400 (Regular)` | Descriptions / Sub-labels |
| **Digits**| `1.25rem (20px)` | `1.0` | `700 (Bold)` | Monospace score readouts |

---

## 4. Component Standards

### 4.1 Cards
*   *Background*: Navy Glass (`hsl(223, 20%, 12%)`) with `backdrop-filter: blur(8px)`.
*   *Borders*: `1px solid hsl(223, 14%, 20%)`.
*   *Hover State*: Shift border color to cyan/green accent and scale component up by `1.03x` with transition duration `0.2s ease-out`.

### 4.2 Interactive Buttons
*   *Standard Button*: Hex border with transparent background.
*   *Primary Action Button*: Deep Navy fill with Neon Cyan border and drop-shadow glow.
*   *Touch Bounds*: Strict minimum target clickable surface of **44x44 CSS pixels**.

### 4.3 Cognitive Badges
*   *Shape*: Small pill shapes with 50% opacity neon backgrounds and solid matching borders.
*   *Padding*: `0.25rem (4px)` vertical, `0.75rem (12px)` horizontal.

---

## 5. Accessibility & Compliance

1.  **Keyboard Interactivity**:
    *   All buttons and cards must implement a clear `:focus-visible` state showing a dashed neon highlight.
2.  **Screen Readers**:
    *   Interactive items must declare explicit `aria-label` tags (e.g. `<button aria-label="Filters Memory Games">`).
    *   Iframes containing games must define `title` parameters.
3.  **Touch Lockout Rules**:
    *   Disable double-tap zoom gestures via viewport directives.
    *   Apply CSS user-select locks to prevent highlighting in-game elements:
    ```css
    .mindflex-game-canvas {
        -webkit-touch-callout: none;
        -webkit-user-select: none;
        user-select: none;
        -webkit-tap-highlight-color: transparent;
        touch-action: none;
    }
    ```
