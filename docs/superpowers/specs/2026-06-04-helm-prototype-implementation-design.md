# HELM — Bring the apps to match the B&W prototypes

> Design spec · 2026-06-04

## Goal

Make the real desktop and mobile apps faithfully match the approved black-and-white
prototypes, wired to the **existing** (reused) backend. The prototypes are the source
of truth for visual design:

- Mobile → `helm-mobile-prototype/index.html` (5 screens)
- Desktop → `helm-desktop-prototype/index.html` (7 frames)

This is an **implementation strategy**, not new visual design — the look is already
specified by the prototypes. The work is closing the gap between the current app code
and those prototypes, without changing the security-critical backend.

## Decisions (locked with the user)

1. **Reuse the backend.** The relay router, desktop main-process logic
   (`runner.js`, `power.js`, `agents.js`, `pairing.js`, `projects.js`,
   `relay-client.js`), and the mobile `RelayConnection` state machine are all built
   and working (packaged `v1.2.0` exists). The "backend phase" means **wire the new
   UIs to the existing backend, fill gaps, and verify end-to-end** — never rewrite.
2. **Build both UIs in parallel.** Mobile and desktop frontends are independent
   tracks; they converge on a backend-wiring + verification pass.

## Non-negotiable constraints (must still hold afterward)

These are unchanged from `CLAUDE.md` and must be preserved by every change:

1. **Directory isolation** — agents spawn only inside allowlisted folders
   (`runner.js` via `projects.resolvePath`). Renderer/UI work must not bypass it.
2. **Laptop-only secrets** — code, credentials, API keys never leave the laptop; the
   phone receives only agent output. The catalog stays `{ id, name }` only.
3. **Keep-awake invariant** — sleep inhibitor + lid override active only while a run
   or manual hold exists, always restoring the saved original on idle/exit
   (`power.js` holder set). Do not weaken.
4. **Mobile never blanks** — offline/unreachable is the designed retry screen.

## Current state vs. prototype (the gap)

### Mobile (`helm-mobile/`)
- **Dashboard** — already has all 4 tabs (Projects / Agents / Settings / Account)
  matching the prototype. Largely aligned.
- **Login / Scan / Offline** — present and close to the prototype; polish only.
- **Task (Screen 4)** — the **one real gap**. Current `TaskScreen.js` is the old
  three-pane design (idle / running / done / error as separate panes). The prototype
  redesigns it into a **conversational** flow.

### Desktop (`helm-desktop/`)
- Main process + IPC are built and working.
- **Renderer (`src/renderer/index.html`, `styles.css`, `renderer.js`)** is the *old*
  UI — the **biggest gap**. Needs a full rebuild to the 7-frame prototype, wired to
  the existing preload IPC channels.

### Relay (`helm-relay/`)
- Done. No UI. Only touched if the wire protocol needs a change (it should not).

## Track A — Mobile frontend

Rebuild **Screen 4 (Task)** from the 3-pane design into the prototype's conversational
flow, wired to the existing `RelayConnection` (`conn.submitTask`, `task.status`,
`task.lines`). No backend change.

Components of the new Task screen:
- **Sticky composer** at the bottom: auto-grow textarea, `+` spawn button (opens the
  spawn sheet), send button. Placeholder shifts: "Message Claude Code…" →
  "Reply to Claude Code…" after a run completes.
- **Thread** (scrollable):
  - *Empty / input* — centered hint bubble ("Message Claude Code to spawn it in
    <project>…").
  - *Running* — user message bubble (white fill) + agent label
    ("✦ Claude Code · working") + **embedded live console** with the shimmer top edge,
    streaming `task.lines`.
  - *Done* — user bubble + agent label + **disclose** chip ("N log lines", collapses
    the console) + **result card** (check, "Task completed", "View") + **stats grid**
    (count-up animation) + "Start a new task". **Stats note:** the prototype mockup
    shows lines / files / elapsed, but the backend does not track files-changed. Use
    the real data we have: lines / exit / elapsed (as the current TaskScreen.js already
    does). Do not invent a files-changed metric — that would be a new feature.
  - *Error* — failure reason in the result card style, retry/new-task affordance.
- **Status badge** in the header tracks `idle → running → done → error`
  (Ready dot → spinner "Running" → check "Done" → alert "Error").
- **Spawn sheet** — bottom sheet to pick Project + Agent, then "Start conversation".
- **Polish pass** so shared tokens/animations match the prototype: breathing
  connection dot, grain/top-glow where feasible in RN, rise/pop animations. Optionally
  load real **Geist / Geist Mono** via `expo-font` (tokens already reserve them);
  acceptable to keep system-font fallback if font loading risks the `expo export`
  check — fallback is already wired in `theme.js`.

Verification for the track: `npx expo export` produces a clean bundle.

## Track B — Desktop frontend

Full **renderer** rebuild to the 7-frame prototype, wired to the **existing**
main-process IPC. The renderer stays the thin, sandboxed view it is today
(`contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`); it reaches the
main process only through the channels already whitelisted in `main.js` +
`preload/preload.js`. **No main-process logic changes** unless a channel is genuinely
missing for a prototype affordance — and any such addition is called out, minimal, and
preserves the four constraints.

The 7 frames:
1. **Pairing** — QR + session token from `pairing.js` (`{ v, relay, token }`).
2. **Projects** — the allowlist; "Authorize directory" opens the native folder picker
   (existing IPC); shows resolved paths.
3. **Agents** — detection results from `agents.js`; only installed agents shown.
4. **Status + live run** — connection state, the laptop side of an in-flight task
   (streamed output), and the keep-awake strip lit while a run holds.
5. **Settings** — app / connection / keep-awake / reset pairing.
6. **Awake Mode** — the single keep-awake switch; opened from the minimized card on
   Status. Uses the FULL ↔ MINI window reshape that already exists.
7. **Tray popover** — the compact menu-bar surface.

Approach: rebuild `index.html` + `styles.css` + `renderer.js` against the prototype
markup/styles and the existing preload surface. Reuse the prototype's CSS tokens
verbatim where possible (same `--bg`, `--fill`, Geist, hairlines, grain).

## Track C — Convergence: wiring + verification

1. **Protocol parity** — confirm the wire protocol is byte-identical in intent across
   all three copies: `helm-relay/protocol.js`, `helm-mobile/src/protocol.js`, and the
   desktop inline literals. If any message type changes, update all three. Expectation:
   **no protocol change is needed** for this work.
2. **Constraint re-check** — verify each non-negotiable still holds after the UI work
   (dir isolation, no secrets leave laptop, keep-awake + restore, mobile never blanks).
3. **End-to-end** — relay up → desktop shows QR → mobile pairs (QR or backup code) →
   submit task → output streams to both desktop Status and the phone thread →
   task_complete renders the result card + stats. On a real phone this needs a tunnel
   in front of the relay with the desktop's `publicRelayUrl` set so the QR carries a
   reachable `wss://` URL; locally, `helm-relay/sim` exercises the same pipe.

## Out of scope (Future Roadmap — do not build)

End-to-end payload encryption, hardened/rotating pairing, terminal/remote-shell,
file browser/editor, rich structured events/diff cards, multi-agent orchestration,
team/plugin/analytics. No `cancel_task` (phone "cancel" stays a local UI reset). HELM
is not a terminal, remote shell, remote desktop, file-sync tool, or cloud IDE.

## Success criteria

- Mobile Task screen matches the prototype's conversational design and drives a real
  task through the existing connection; `npx expo export` is clean.
- Desktop renderer matches all 7 prototype frames, wired to existing IPC; the app runs
  (`pnpm start`) and a task can be driven from the desktop side.
- A task submitted from the phone streams to both surfaces and completes, with the
  four non-negotiables intact.
