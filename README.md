# GoalKeeper Desktop

A self-contained Electron desktop port of the **GoalKeeper CLI** — a deterministic urgency-based task manager built around a goals → projects → tasks hierarchy. The engine is a faithful TypeScript port of the original Python scoring logic, verified by a golden parity test suite.

## Features

- **Goals → Projects → Tasks** — hierarchical work organisation with per-goal progress tracking
- **Deterministic urgency engine** — tasks are scored and ranked by due date, priority, age, blocking relationships, and custom coefficients; no AI required for core operation
- **Ready board** — zero-config view of what you can work on right now (unblocked, open tasks sorted by urgency)
- **What Now? (AI)** — Gemini-powered advisor that picks the best task given your available time and energy level
- **Backlog Groomer (AI)** — reviews your task list and proposes splits, priority changes, deadline nudges, and stale-task flags
- **Decompose (AI)** — breaks a goal into a draft project + task plan you can review and commit in one click
- **Tune (AI)** — analyses your task history and proposes urgency coefficient adjustments
- **Catppuccin theme** — Mocha (dark) and Latte (light) variants, switchable in Settings
- **Command palette** — Cmd/Ctrl-K; also triggered by `/` or `g` from any non-input context
- **Keyboard shortcuts** — `n` new task, `g` / `/` open palette, `Cmd/Ctrl-K` toggle palette

## Screenshots

> Screenshots are TODO — contributions welcome.

| Dashboard | Ready Board | Goal View |
|-----------|-------------|-----------|
| ![Dashboard](docs/screenshot-dashboard.png) | ![Ready](docs/screenshot-ready.png) | ![Goal](docs/screenshot-goal.png) |

## Install & Run

```sh
# Install dependencies
pnpm install

# Start in development (hot-reload)
pnpm dev

# Production build (renderer + main, no packaging)
pnpm build

# Package into a distributable installer
pnpm dist
# Produces: AppImage + .deb on Linux, NSIS .exe on Windows
```

> **Development note — better-sqlite3 ABI gotcha**
>
> `pnpm dist` runs `electron-builder` which rebuilds `better-sqlite3` against
> Electron's ABI. After that, `pnpm test` will fail with a
> `NODE_MODULE_VERSION` mismatch because the native module is no longer
> compatible with plain Node.js. To restore the dev build, run:
>
> ```sh
> pnpm rebuild better-sqlite3
> ```
>
> CI avoids this by running tests *before* packaging. Local dev: build dist
> last, or rebuild before testing.

## Gemini Setup (optional)

AI features (What Now?, Groom, Decompose, Tune) require a Gemini API key:

1. Get a free key at [aistudio.google.com](https://aistudio.google.com)
2. Open **Settings → Gemini** in the app and paste the key
3. The key is stored encrypted in your OS keychain (via `keytar`); it is never written to disk in plain text
4. LLM features are fully optional — the app runs without a key, and the urgency engine, task board, and all CRUD operations work offline

## Data Migration

If you have an existing **GoalKeeper CLI** database (`~/.goalkeeper/goalkeeper.db` or the default CLI data path), you can import it:

1. Open **Settings → Data**
2. Click **Import legacy data…**
3. Goals, projects, and tasks are imported; records that already exist are skipped safely

## Unsigned Binary Warning

The packaged installers are not code-signed. On macOS, Gatekeeper will warn that the app is from an unidentified developer — right-click → Open to bypass. On Windows, SmartScreen may show a similar prompt. This is expected for unsigned indie apps and does not indicate a security risk.

## Technical Notes

- **Urgency engine** — `core/engine/` is a line-for-line TypeScript port of `goalkeeper/engine.py`. The golden parity test (`tests/engine.golden.test.ts`) confirms identical numeric output for a representative fixture.
- **Database** — SQLite via `better-sqlite3` (synchronous, runs in Electron's main process). Schema is managed in `core/db/`.
- **IPC** — all renderer ↔ main communication goes through a type-safe `window.gk` preload bridge (`src/gk.d.ts`, `electron/preload.ts`).
- **State management** — TanStack Query with optimistic updates for task mutations.

## License

ISC © Mohammed
