# MindFlex - AI时代的人类脑力健身房: Vision

## Project Vision
MindFlex is the "Human Brain Resistance Base in the AI Era." As generative AI and intelligent agents take over routine cognitive tasks, humans face a real risk of fluid intelligence regression and cognitive laziness. MindFlex provides a platform of highly engaging, quick-to-play, and visually polished HTML5 micro-games to stimulate and protect human cognitive faculties.

**Slogan**: *In the age of AI, let's keep human brains human. Train your cognition before it rusts.*

---

## Target Users
- **Modern Knowledge Workers**: Individuals who rely heavily on AI tools (e.g., LLMs, search assistants, code generators) and want to proactively prevent cognitive stagnation.
- **Casual Gamers**: Users seeking high-quality, addictive, and quick mental exercises during short breaks (commutes, queues, downtime).
- **Cognitive Fitness Enthusiasts**: People interested in tracking their mental performance, reaction times, and focus metrics over time.

---

## User Problems
- **Cognitive Decline / Laziness**: Over-reliance on AI for multi-step reasoning, writing, and problem-solving reduces the brain's exercise of its execution functions.
- **Attention Fragmentation**: Dopamine-driven algorithms and short-form video consumption degrade attention spans and make deep focus difficult.
- **Short-Term Memory Loss**: Instant search and digital assistants lead to reliance on external retrieval, causing spatial and short-term working memory to deteriorate.
- **Reaction and Processing Fog**: A lack of high-speed cognitive demands causes slower crisis decision-making and mental processing speed.
- **Spatial Awareness Weakness**: High automation in navigation and positioning tools diminishes physical and virtual spatial perception.

---

## Product Goals
- **High Engagement & Retention**: Establish a grid-based, instantly playable dashboard inspired by platforms like CrazyGames (https://www.crazygames.com/).
- **Targeted Cognitive Exercises**: Maintain an expandable library of mini-games categorized across five primary cognitive dimensions.
- **Scientific Progress Tracking**: Provide users with a visual representation of their mental fitness and highlight their ability to outperform average "AI replacement" baselines.
- **Decoupled Game Integration**: Allow independent developers or teams to build and plug in games under a standardized template with zero-coupling to the main shell.

---

## Core Capabilities
- **Universal Container Shell**:
  - **Top Navigation Bar**: Houses the brand logo, real-time total brain score, live system activity ticker, and a user profile dropdown.
  - **Profile Dropdown Menu**: Displays personal badges, achievements, and the five-dimensional cognitive radar chart.
  - **Left Navigation Sidebar**: Enables rapid filtering of games by cognitive category and displays daily training completion metrics.
- **Modular Game Stage**:
  - Independent viewport sandbox for running games in Canvas or WebGL.
  - Decoupled configuration allowing in-game settings (e.g., volume, keybinds, restarts) to live strictly inside the game area.
- **Unified Communication SDK (`mindflex-bridge.js`)**:
  - Lightweight script bridging communication between the game viewport (iframe) and the host shell via `postMessage`.
  - Transmits game scores, response times, precision rates, and session metadata.
- **Zero-Friction Identity Retention**:
  - Immediate anonymous profile creation via browser `LocalStorage`, ensuring data persistence without requiring a signup process.
- **Cognitive Radar Charting**:
  - Displays progress in five dimensions using charting libraries (e.g., Chart.js or D3.js).
  - Overlays a shaded "AI Replacement Threat Line" to motivate users to exceed minimum cognitive benchmarks.

---

## Five Core Cognitive Dimensions
- **Memory (记忆力)**: Trains spatial working memory, visual recall, and rapid retrieval.
- **Focus (注意力)**: Targets distraction filtering (inhibitory control) and dynamic multi-object tracking.
- **Logic (逻辑与执行)**: Exercises multi-step logical deduction, pattern recognition, and cognitive flexibility.
- **Speed (反应力)**: Enhances visual search speed and quick decision-making under time constraints.
- **Spatial (空间观察力)**: Focuses on mental rotation, detail scanning, and perspective-taking.

---

## Out-of-Scope (Phase 1)
- **AI-Assisted Gameplay**: AI tools or assistants are barred from participating or helping users within the games.
- **Native Applications**: Development is restricted to responsive, mobile-friendly web standards (H5).
- **Multiplayer Matchmaking**: Focus remains strictly on single-player, self-improvement gaming and tracking.
- **Monetization & Ads**: The initial MVP focuses purely on user retention, clean gameplay, and organic growth without ads or paywalls.
