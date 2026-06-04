# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What HELM is

**HELM is a mobile control interface for AI coding agents that run on your laptop.** The laptop stays the full workstation — it holds the repos, dependencies, credentials, compute, and the agent installations (Claude Code, Codex, Antigravity CLI). The phone is only a lightweight control surface: it never stores code or runs agents.

Everything serves one flow:

> **Project → Agent → Task → Progress → Result**

**The one question for every change:** *"Does this help the user assign work to an agent on their laptop from their phone?"* If no, it belongs in the Future Roadmap, not the MVP.

`product.md`, `plan.md`, `handoff.md`, and `design.md` hold the full vision, checklist, status, and mobile design system. They are **gitignored internal docs** (present locally, not in a fresh clone) — read them when available, but keep this file self-sufficient.

## The three parts

1. **`helm-desktop/`** — Electron tray app on the laptop (the **HOST**). Exposes allowlisted folders, detects installed agents, shows the pairing QR, dials out to the relay, spawns agents inside allowlisted folders, streams their output, and keeps the laptop awake while a run is in flight.
2. **`helm-mobile/`** — Expo / React Native control app (the **CLIENT**). Pairs by scanning the QR, lists projects + agents, submits a task, renders streamed output. Holds no code or secrets — only the pairing token and in-memory output.
3. **`helm-relay/`** — a deliberately **dumb** WebSocket router. It pairs a HOST and CLIENT presenting the same session `token` and forwards every non-control message between them verbatim. No business logic, no storage.

## Commands

This is a multi-root repo (three independent packages); there is no top-level workspace. **`cd` into each app.** Desktop and relay use the files directly; mobile is Expo.

```powershell
# Relay (helm-relay/) — Node + ws, no build step
cd helm-relay; npm install; npm start          # listens on :8787 (override with $env:PORT)
#   browser phone simulator: http://localhost:8787/sim   (exercises the full pipe w/o a phone)
#   health/health check:     http://localhost:8787/health

# Desktop (helm-desktop/) — Electron, uses pnpm
cd helm-desktop; pnpm install
pnpm start            # run the tray app
pnpm dev              # run with --dev (devtools, dev-only behaviors)
pnpm icon             # regenerate assets/icon.* from source PNG (scripts/make-icon.js)
pnpm dist             # portable Windows x64 build (electron-builder) → release/
pnpm dist:mac         # macOS arm64 .dmg

# Mobile (helm-mobile/) — Expo SDK 53, uses pnpm
cd helm-mobile; pnpm install
npx expo start        # dev server; press a / i for Android / iOS emulators, or scan in Expo Go
npx expo export       # bundle the app — the project's "does it build?" check (no test suite)
```

**Running the full local flow** (three terminals): start the relay, start the desktop (it shows the QR + token), then start mobile and pair. On a real phone `ws://localhost` won't reach the laptop — run a tunnel (cloudflared/ngrok) in front of the relay and set the desktop's `publicRelayUrl` so the QR carries a reachable `wss://…` URL.

**Tests:** there is no automated test framework in any package. Verify mobile with `npx expo export` (clean bundle), and verify end-to-end behavior manually through `helm-relay/sim` or a paired phone.

## Architecture — the big picture

### NAT-busting transport
The laptop is behind home NAT and can't accept inbound connections, so **both** sides dial *out* to the relay. `helm-relay/server.js` keeps a `token → { host, client }` map: a `host_hello` / `client_hello` registers a socket into its slot; once both slots are filled each side gets `peer_online`. Anything the relay doesn't itself understand (the `RELAY_CONTROL` set) is forwarded to the peer untouched — the relay never parses task content. A 30s ping/`terminate` heartbeat drops dead sockets.

### The wire protocol is the contract — and it's duplicated
`helm-relay/protocol.js` defines every message type. The mobile app mirrors it **verbatim** in `helm-mobile/src/protocol.js`; the desktop uses the same string literals inline in `relay-client.js` / `runner.js`. **If you change a message type, update all three.** Control types (`*_hello`, `ping`/`pong`, `peer_*`, `relay_error`) are handled by the relay; the rest are opaque payload it routes:

| Direction | Message | Payload |
|---|---|---|
| client → host | `list` | — |
| host → client | `catalog` | `{ projects[], agents[] }` (each `{ id, name }` only) |
| client → host | `submit_task` | `{ projectId, agentId, task }` |
| host → client | `task_started` | `{ taskId }` |
| host → client | `output` | `{ taskId, stream:'stdout'\|'stderr', chunk }` |
| host → client | `task_complete` / `task_error` | `{ taskId, code }` / `{ taskId, message }` |

There is **no `cancel_task`** in the MVP — the phone's "cancel" is a local UI reset; the laptop run finishes on its own.

### Desktop (host) — `src/main/`
A classic Electron main/preload/renderer split. The **main process** owns everything; the renderer reaches it *only* through the IPC channels whitelisted in `main.js` + `preload/preload.js` (contextIsolation on, sandbox on, nodeIntegration off). One `BrowserWindow` is reshaped between a **FULL** dashboard and a fixed always-on-top **MINI** widget; closing the window hides to tray rather than quitting.

- **`runner.js`** — the directory-isolation + keep-awake core. On `submit_task` it resolves `projectId` to an **allowlisted absolute path** (refuses otherwise — agents never run outside an allowlisted folder), resolves `agentId` to its installed binary, and `spawn()`s it with `cwd` = that folder, `shell:false`, **argv-only** (the task is a single argv element, never concatenated into a command line). Tasks beginning with `-` are rejected and agent recipes insert a `--` end-of-options sentinel to defeat argv flag-smuggling. `.cmd`/`.bat` shims route through `cmd.exe /c` (still argv).
- **`power.js`** — keep-awake engine with a **holder set** (`'user'` = manual toggle, `'agent'` = a run in progress). It physically blocks sleep (`powerSaveBlocker`) + overrides lid-close (platform backend `power.win.js`→`powercfg` / `power.mac.js`→`pmset`) only while ≥1 holder exists, and **always restores the saved original lid value** when the last holder leaves or on quit. This is why the first running task takes an `'agent'` hold and the last to finish releases it — a manual OFF can't cut protection out from under a running agent.
- **`agents.js`** — `which`/`where` scan for `claude` / `codex` / `antigravity`|`ag`; only found agents are exposed. Each registry entry carries the non-interactive `args(task)` recipe (e.g. `claude -p -- <task>`, `codex exec -- <task>`). The public catalog is `{ id, name }` only — bin paths stay on the laptop.
- **`pairing.js`** — a stable per-laptop session `token` (persisted in settings). The QR encodes `{ v, relay, token }`; `publicRelayUrl` lets it carry a tunnel URL instead of the local one.
- **`relay-client.js`** — persistent outbound socket with capped-exponential-backoff reconnect; registers as host, answers `list` with the catalog and `submit_task` via `runner.js`.
- **`projects.js`** / **`settings.js`** — the folder allowlist and a JSON settings store (also holds `sessionToken`, `savedLidAction`, window mode, etc.).

### Mobile (client) — `src/`
`src/lib/connection.js` is the heart: a single long-lived `RelayConnection` instance (provided via `RelayProvider` / `useRelay`) drives the whole flow as a status machine — `idle → connecting → waiting → online → disconnected`. It auto-sends `list` the moment the laptop is `peer_online`, caps streamed output at `MAX_LINES`, keeps a 20s app-level ping, and reconnects with capped backoff so a flaky phone network never leaves the UI stuck. The React layer subscribes to its snapshot and re-renders. `App.js` is a native-stack: **Login → Scan → Dashboard → Task**; `src/lib/storage.js` persists *only* `{ relay, token }` in `expo-secure-store`. `src/theme.js` is the dark-monochrome token set (Geist with system fallbacks).

## Non-negotiable constraints (apply at every stage)

1. **Directory isolation:** agents are spawned only inside allowlisted project folders — never elsewhere on the laptop. (Enforced in `runner.js` via `projects.resolvePath`; don't bypass it.)
2. **Laptop-only secrets:** code, credentials, API keys, and dependencies never leave the laptop; the phone receives only agent output and results.
3. **Keep-awake invariant:** the sleep inhibitor and lid override are active **only** while a run (or manual hold) is present, and always restore the saved original settings when idle or on exit. (Already built in `power.js` — do not overwrite or weaken it.)
4. **Mobile never blanks:** the "laptop offline / unreachable" state is a designed retry screen, never a blank or error dump.

## Scope discipline

**In the MVP:** project allowlisting, agent detection, QR pairing, remote task submission, streaming output + completion. **Explicitly out (Future Roadmap):** end-to-end payload encryption, hardened/rotating pairing, terminal/remote-shell access, file browser/editor, rich structured events & diff cards, multi-agent orchestration, team/plugin/analytics features. HELM is **not** a terminal, remote shell, remote desktop, file-sync tool, or cloud IDE — the phone never becomes the workstation.

## Design references

The approved visual language is **dark, pure monochrome** (`--bg #0A0A0B`, `--fill #FFFFFF` as the only accent, Geist + Geist Mono, hairlines + grain, no color — white breathing dot = connected, hollow ring = offline). Browser-verified prototypes are the source of truth: **mobile → `helm-mobile-prototype/index.html`** (5 screens), **desktop → `helm-desktop-prototype/index.html`** (7 frames: Pairing · Projects · Agents · Status+live run · Awake Mode · Settings · Tray popover). `design.md`'s aurora-gradient system is superseded by these for visual direction.
