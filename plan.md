# plan.md — HELM Implementation Checklist

Tracks the build toward **one goal: a working end-to-end demo** of the core flow —
**Project → Agent → Task → Progress → Result.**

Build the MVP phases in order. The Future Roadmap section at the bottom is deliberately *not* part of this milestone — do not start it until the demo works.

For every task, ask: **"Does this help the user assign work to an agent on their laptop from their phone?"** If no, it does not belong here.

---

## Phase 1: Relay Server (`helm-relay/`) — keep it dumb
- [ ] Scaffold a Node.js app using the `ws` WebSocket library.
- [ ] Maintain a simple in-memory routing table: pairing/session token → connected sockets (laptop + phone).
- [ ] Route messages between the paired phone and laptop. No business logic, no storage of user data.
- [ ] Handle disconnect / reconnect cleanly.
- [ ] Serve over TLS. Deploy to a cheap host (Fly.io / Railway / a small VPS).

## Phase 2: Desktop App (`helm-desktop/`)
- [ ] **Tray + minimal window:** tray menu (Show window, Quit); window with Projects / Pairing / Status sections.
- [ ] Retain and integrate the existing **keep-awake** logic (active only while an agent runs; restores on idle/exit).
- [ ] **Project allowlisting:**
  - [ ] Native directory picker to add folders.
  - [ ] Persist the allowlist (local JSON or SQLite).
  - [ ] Remove a folder → immediately unavailable from the phone.
- [ ] **Agent detection:**
  - [ ] Scan for `claude` (Claude Code), `codex` (Codex), `antigravity`/`ag` (Antigravity CLI).
  - [ ] Produce the available-agents list to send to the phone.
- [ ] **QR pairing:**
  - [ ] Generate a pairing token tied to this laptop session.
  - [ ] Render it as a QR code in the window.
  - [ ] Accept and store the pairing when the phone connects.
- [ ] **Relay client:** persistent outbound WebSocket (TLS) to the relay.
- [ ] **Agent runner + stream bridge:**
  - [ ] On task submit, spawn the selected agent **inside the selected allowlisted folder** only.
  - [ ] Pass the task via stdin or CLI arg (per agent).
  - [ ] Stream stdout/stderr lines back to the phone as plain text.
  - [ ] Emit a clear `task_complete` / `agent_error` signal at the end.

## Phase 3: Mobile App (`helm-mobile/`) — built (Expo SDK 53, plain JS)
- [x] Scaffold an Expo / React Native workspace. (`pnpm install` clean; `expo export` bundles 889 modules with no errors.)
- [x] Store the pairing token securely with `expo-secure-store`. (`src/lib/storage.js` — only the relay URL + token are ever stored.)
- [x] **Pairing:** camera QR scanner → connect through the relay. (`ScanScreen` via `expo-camera`; parses the desktop's `{v,relay,token}` QR. Manual relay/token entry for same-LAN dev.)
- [x] **Projects screen:** list the allowlisted projects from the laptop. (Dashboard Projects tab from the `catalog`.)
- [x] **Agent select screen:** list the detected agents for the chosen project. (Dashboard Agents tab; merges known agents to show not-installed ones dimmed; selection feeds the Task breadcrumb.)
- [x] **Task screen:** text input to submit a task; render streamed output as readable text; show a completion/result state. (`TaskScreen` input → mono streaming console → result stats: lines / exit / elapsed.)
- [x] **Relay client:** WebSocket connection; connection indicator (connected / reconnecting / laptop offline) with a retry action — never a blank screen. (`src/lib/connection.js` — port of the proven `sim.js` flow; backoff reconnect; soft `ReconnectBar` + hard `OfflineScreen` with Try again.)
- [ ] **Polish (deferred):** drop Geist/Geist Mono `.ttf` into `assets/` (+ `expo-font`); add `assets/icon.png`/splash; remote `cancel_task` (protocol has no cancel yet — Cancel is a local reset).

## Phase 4: End-to-end demo
- [ ] Walk the full flow on real devices: leave the laptop running, pair the phone, select a project, pick an agent, send a task, watch streamed progress, receive the result.
- [ ] Confirm the non-negotiables hold: agents run only in allowlisted folders; no code/secrets leave the laptop; keep-awake engages during the run and restores after; the phone handles "laptop offline" gracefully.

---

## Future Roadmap (NOT this milestone)

Deferred until the demo above works. See `product.md` §3 for the full list. Do not start these now:

- [ ] End-to-end payload encryption (libsodium / Web Crypto) and per-device key pairs.
- [ ] Hardened pairing: device-password second factor, token expiry, rotating session tokens, remote device revocation, paired-devices management UI.
- [ ] Rich structured events (`file_change`, `shell_command`, `approval_request`, `progress`) and in-app approval cards.
- [ ] Visual diff cards (green/red) and file-change summaries.
- [ ] Terminal / remote shell access *(explicitly excluded — HELM is not a terminal product)*.
- [ ] File browser / editor, multi-agent orchestration, team features, plugins, analytics/history, offline queuing, and scale infrastructure (Redis routing, multi-region).
