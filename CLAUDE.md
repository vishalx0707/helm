# CLAUDE.md — HELM

Guidance for any AI coding agent working in this repo. Read this first, then `product.md` for the full vision, MVP scope, and roadmap.

## What HELM is
**HELM is a mobile control interface for AI coding agents that run on your laptop.** The laptop stays the full development workstation — it holds the repos, code, `node_modules`, dependencies, credentials, API keys, compute, and the agent installations (Claude Code, Codex, Antigravity CLI). The phone is only a lightweight control surface: it never stores code or runs agents.

The user is not coding on their phone, not using a terminal, and not remote-controlling a desktop. They simply want to keep directing the AI agents already on their laptop while away from it (school, travel, commute).

**The entire product exists to serve one flow:**

> **Project → Agent → Task → Progress → Result**

Select a project, pick an available agent, give it a task, watch it work, get the result.

## The one question for every decision
Before adding anything, ask: **"Does this help the user assign work to an agent on their laptop from their phone?"**

If the answer is no, it does not belong in the MVP. Put it in the Future Roadmap (`product.md`) instead.

## The three parts
1. **HELM Desktop (`helm-desktop/`)** — an Electron app that sits in the system tray on the laptop. It lets the user choose which project folders are exposed, auto-detects installed agents, shows a QR code for pairing, runs agent tasks inside allowlisted folders, streams their output back, and keeps the laptop awake while an agent is running. **Visual reference:** `helm-desktop-prototype/index.html` (B&W prototype — full window + sidebar nav + tray popover; same monochrome language as mobile). The mobile reference is `helm-mobile-prototype/index.html`.
2. **HELM Mobile (`helm-mobile/`)** — a lightweight React Native / Expo app. It pairs by scanning the QR code, lists the approved projects, lets the user pick an agent and send a task, and shows streamed output and the final result.
3. **HELM Relay (`helm-relay/`)** — a minimal WebSocket relay that forwards messages between the paired phone and laptop so the phone can reach the laptop across networks (the laptop is behind home NAT). Keep it dumb: route messages, nothing more.

## What HELM is NOT
HELM is **not a terminal product**, not a remote shell, not a remote desktop, not a file sync tool, not a cloud IDE, and not a coding-on-phone experience. The phone never becomes the workstation. Anything resembling a terminal, embedded PTY, or raw shell access is explicitly out of scope.

---

## Run / build commands

### Desktop App (`helm-desktop/`)
```powershell
cd helm-desktop
pnpm install
pnpm start            # run Desktop in development
pnpm dev              # run with devtools active
pnpm dist             # package portable Windows build
```

### Mobile App (`helm-mobile/`)
```powershell
cd helm-mobile
pnpm install
npx expo start        # start Expo dev server
```

### Relay Server (`helm-relay/`)
```powershell
cd helm-relay
pnpm install
npm start             # start the WebSocket relay
```

---

## MVP — build only this
1. **Project allowlisting** — desktop add/remove of folders; only allowlisted projects are visible from the phone.
2. **Agent detection** — scan the laptop for Claude Code, Codex, and Antigravity CLI; show only what's found.
3. **QR pairing** — desktop shows a QR code; phone scans it to pair.
4. **Remote task submission** — phone sends a task to a chosen agent in a chosen project.
5. **Streaming output + completion** — laptop runs the agent and streams progress/results back to the phone.

The goal is a **working end-to-end demo**, not a platform.

## Explicitly OUT of the MVP (Future Roadmap)
Do not build these now: advanced/E2E encryption systems, complex relay architecture, terminal access, remote shells, file browsers, code editors, rich diff engines, team features, multi-agent orchestration, plugin systems, analytics, and offline support. They live in the Future Roadmap in `product.md` and must not creep into MVP work.

---

## Architecture principles
- **Simplicity over scale.** Prefer the smallest thing that proves the flow. No infrastructure built for hypothetical future load.
- **Laptop does the work.** All execution, storage, and credentials stay on the laptop. The phone only sends instructions and renders results.
- **Directory isolation.** Agents are spawned only inside user-allowlisted project folders — never anywhere else on the laptop.
- **Keep-awake invariant.** The desktop app prevents system/screen sleep while an agent is running and restores normal settings exactly when idle or on exit. (This is already built — do not overwrite it.)
- **Reasonable transport.** Use TLS for the relay connection. Full end-to-end payload encryption is a roadmap item, not an MVP blocker — do not let it stall the demo.
- **Graceful offline.** The mobile app must handle "laptop offline / unreachable" with a clear retry state, never a blank or broken screen.

---

## Non-negotiable constraints
1. **Directory isolation:** Subprocesses run only inside allowlisted project paths.
2. **Keep-awake invariant:** Sleep-inhibitor overrides are active only during agent runs and always restore normal system settings when idle or on exit.
3. **Laptop-only secrets:** Code, credentials, API keys, and dependencies never leave the laptop; the phone receives only agent output and results.
4. **Mobile fallback:** The mobile app gracefully handles the "laptop offline" state with a retry screen.
