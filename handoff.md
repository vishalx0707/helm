# handoff.md — HELM

> Tight current-state snapshot. Deep history is in git + `docs/LEARNINGS.md`. Last updated: 2026-06-03 (helm-mobile built).

## Goal
**HELM** — a mobile control interface for AI coding agents running on the user's laptop. The laptop stays the full workstation (code, deps, credentials, agents, compute); the phone is only a control surface. The whole product serves one flow:

> **Project → Agent → Task → Progress → Result**

The aim is the **smallest possible working end-to-end demo** — leave the laptop at home, open HELM on the phone, select a project, choose an agent, assign work, watch progress, receive the result. Not a platform. See `product.md` for Vision / MVP / Roadmap.

---

## State — Refocused & terminal-free
- **Product refocus:** The spec was simplified down to the HELM MVP. Terminals, remote shells, E2E encryption, rich diff engines, multi-agent orchestration, file browsers, team/plugin/analytics features were all moved out of the MVP into the Future Roadmap.
- **Terminal removal:** The old "embedded terminal / TermWork" direction is gone — the terminal plan & spec under `docs/superpowers/`, the `concept-*.html` mockups, the desktop terminal source (deleted earlier at the repo root), and the terminal-specific entries in `docs/LEARNINGS.md` were all removed. HELM is **not** a terminal product.
- **Docs rewritten to match:** `CLAUDE.md`, `product.md` (now Vision → MVP Scope → Future Roadmap), and `plan.md` (MVP phases + a deferred roadmap section).
- **Desktop code:** `helm-desktop/` is the Electron tray app, currently the keep-awake-only template — ready for the project allowlist, agent detection, QR pairing, relay client, and agent runner work. `package.json` branding is HELM (`productName` HELM, `appId` `com.helm.app`).
- **Design system added:** `design.md` — the mobile UI/UX guide for agents. Direction: modern-startup/Framer aesthetic on a dark, developer-credible base (aurora gradients, glass, spring physics). Holds design tokens, a motion system (Reanimated 4 + Moti + gesture-handler + expo-haptics), per-screen prompt blocks (S0–S4 + offline), and a copy-paste preamble. Backed by live research (Mobbin/Cal-AI real screens, Savee, Dribbble AI-agent apps, 21st.dev components, animatereactnative QR recipe) with evidence screenshots in `docs/design-research/`.
- **B&W mobile prototype built:** `helm-mobile-prototype/index.html` — a self-contained, browser-ready phone-frame prototype of the complete HELM Mobile UI. Pure black & white / dark monochrome (supersedes the aurora-gradient direction in `design.md` for visual direction). 5 screens fully verified in a real browser:
  1. **Welcome / Login** — brand mark + Apple/Google/email auth (intro and login merged into one screen).
  2. **Scan device** — animated white corner-bracket QR scanner + 6-digit mono pairing code + TLS reassurance.
  3. **Dashboard** — 4 interactive tabs: Projects (project cards + authorize directory), Agents (selectable Claude Code / Codex / Antigravity with detected/not-installed states), Settings (toggles: notifications, keep-awake, appearance; paired laptop manage/unpair), Account (profile + Log out).
  4. **Task → Console → Result** — 3 live modes in one screen: Input (task box + Run agent), Running (summary chip + mono streaming console with edge shimmer + Cancel task), Result (✓ completion banner + stat cards with count-up numbers: lines / files / elapsed + Start new task).
  5. **Offline / Laptop unreachable** — the never-blank recovery state: animated "Reconnecting…" glass bar (soft) + full "Laptop unreachable" recovery with retry (hard). No blank error states.
- **Stitch MCP connected:** `stitch` HTTP MCP server added to project config (`✓ Connected`). Pulled all 30 screens from the user's "HELM Remote Control" Stitch project as reference; redesigned with original craft. Stitch screenshots saved in `docs/design-research/stitch/`. Note: Stitch tools only available after a session restart (MCP loads at startup).
- **Design tokens (new — monochrome):** `--bg #0A0A0B`, `--fill #FFFFFF` (only "accent"), Geist + Geist Mono. Mono used strictly for machine artifacts (paths, pairing codes, agent versions, console output). Status shown in grayscale (breathing white dot = connected, hollow ring = offline). No colored glow — depth from hairlines + specular highlights.

---

## Workspace structure
- [product.md](file:///C:/Users/visha/OneDrive/Desktop/TermWork/product.md) — Product spec: Vision, MVP Scope, Future Roadmap.
- [plan.md](file:///C:/Users/visha/OneDrive/Desktop/TermWork/plan.md) — MVP implementation checklist (relay → desktop → mobile → demo).
- [CLAUDE.md](file:///C:/Users/visha/OneDrive/Desktop/TermWork/CLAUDE.md) — Agent guidance, commands, the one decision question, constraints.
- [design.md](file:///C:/Users/visha/OneDrive/Desktop/TermWork/design.md) — Mobile UI/UX design system + per-screen agent prompts. Read before building `helm-mobile/`.
- [helm-desktop/](file:///C:/Users/visha/OneDrive/Desktop/TermWork/helm-desktop/) — Electron tray app (laptop side); keep-awake built, rest to come.
- [helm-mobile/](file:///C:/Users/visha/OneDrive/Desktop/TermWork/helm-mobile/) — Expo / React Native control app. **Built** (see below).
- `helm-relay/` — Minimal WebSocket relay (built: `server.js` + `protocol.js`, dumb token router, serves the `/sim` browser client).

> Note: `docs/LEARNINGS.md` is kept as a factual engineering log of the existing keep-awake/power, icon/tray, and build code, which still backs the keep-awake invariant. Terminal-related learnings were pruned.

---

## helm-mobile — built (Expo SDK 53, plain JS)
Ported all 5 prototype screens to React Native in the B&W monochrome system. Speaks the exact wire
protocol proven by `helm-relay/sim/sim.js` (the connection layer is a direct port). Verified by a headless
Metro export — `npx expo export` bundles 889 modules with no errors (no device/simulator available here).
- **Connection (`src/lib/connection.js`):** `RelayConnection` class + `RelayProvider`/`useRelay` hook.
  `client_hello` → `peer_online` → auto `list` → `catalog` → `submit_task` → `task_started` → `output` →
  `task_complete`/`task_error`. Capped-backoff reconnect; 20s app-level ping. `src/protocol.js` mirrors the relay.
- **Pairing:** `ScanScreen` scans the desktop's `{v,relay,token}` QR (`expo-camera`), stores it in
  `expo-secure-store` (`src/lib/storage.js` — the ONLY thing persisted), and points the live socket at it.
  Manual relay-URL + token entry covers same-LAN dev without a tunnel.
- **Screens:** `LoginScreen` (auth is roadmap — buttons advance to pairing), `ScanScreen`, `DashboardScreen`
  (Projects · Agents · Settings · Account tabs + connection pill + soft `ReconnectBar`), `TaskScreen`
  (input → mono streaming console → result: lines / exit / elapsed), `OfflineScreen` (hard "unreachable" + retry).
- **Design:** `src/theme.js` holds the monochrome tokens; icons via `@expo/vector-icons` (Feather/AntDesign).
  Geist falls back to system/mono fonts to stay runnable — drop the `.ttf` in for an exact match.
- **Run:** `cd helm-mobile && pnpm install && npx expo start`. See `helm-mobile/README.md`.

## Next steps
1. **Prove the full flow end-to-end on a real device** — run relay + desktop, expose the relay via a tunnel
   (cloudflared/ngrok) so the QR carries a `wss://` URL, scan, send a task, watch it stream, get the result.
2. Confirm the non-negotiables hold live: directory isolation, no secrets leave the laptop, keep-awake during
   the run, graceful offline.
3. Polish: load Geist `.ttf`, add app icon/splash, and (roadmap) a real `cancel_task` message so Cancel stops
   the laptop run instead of just resetting the phone UI.

Filter every task through: **"Does this help the user assign work to an agent on their laptop from their phone?"** If no, it's roadmap, not now.
