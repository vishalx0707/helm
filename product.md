# HELM — Product Specification

> Written for AI coding agents. Read this entire document before writing a line of code.
> It is organized as **Product Vision → MVP Scope → Future Roadmap**. Build the MVP. Everything in the roadmap is explicitly *later*.

---

## 1. Product Vision

**HELM is a mobile control interface for AI coding agents running on a user's laptop.**

The laptop is, and stays, the complete AI development workstation. It holds the repositories, code, dependencies, `node_modules`, credentials, API keys, compute, and the agent installations. The phone is a lightweight control surface — nothing more. It stores none of those things.

The user is **not** trying to:
- code on their phone,
- use a terminal or remote shell,
- remote-control their desktop,
- sync files or browse a filesystem,
- run a cloud IDE.

The user simply wants to **keep building projects while away from their computer** by directing the AI coding agents that already live on their laptop. They leave the laptop at home, open HELM on their phone from school, a train, or a café, and put their agents to work.

### The core flow — everything serves this

> **Project → Agent → Task → Progress → Result**

1. **Project** — pick one of the folders the user exposed on the laptop.
2. **Agent** — pick one of the agents detected on the laptop (Claude Code, Codex, Antigravity CLI).
3. **Task** — type an instruction and send it.
4. **Progress** — watch streamed output as the agent works on the laptop.
5. **Result** — receive the summary / result when it finishes.

If a feature does not help the user move through that flow, it is not part of the MVP.

### Where everything lives

| On the laptop (HELM Desktop) | On the phone (HELM Mobile) |
|---|---|
| Repositories & code | Pairing token / session |
| Dependencies & `node_modules` | The current task text being typed |
| Credentials & API keys | Streamed output being displayed |
| Compute & agent execution | Nothing else — no code, no secrets |
| Installed agents | |

---

## 2. MVP Scope

Build the **smallest possible version** that proves the core flow end-to-end. The success criterion is a working demo: *leave the laptop at home, open HELM on the phone, select a project, choose an agent, assign work, monitor progress, receive results.*

### The six MVP capabilities

1. **Project allowlisting** — On the desktop, the user adds/removes project folders. Only allowlisted folders are visible from the phone. Nothing else on the laptop is exposed.
2. **Agent detection** — On startup, the desktop scans for installed agents (Claude Code, Codex, Antigravity CLI) and lists only the ones it finds.
3. **QR pairing** — The desktop displays a QR code; the phone scans it to pair. The pairing persists so it isn't needed every time.
4. **Remote task submission** — From the phone, the user selects a project, selects an agent, types a task, and sends it to the laptop.
5. **Streaming output** — The laptop spawns the agent inside the selected project folder and streams its output back to the phone in real time.
6. **Task completion** — When the agent finishes, the phone shows that it's done and the result/summary.

### The two MVP applications

#### HELM Desktop (`helm-desktop/`)
An Electron app that runs quietly in the system tray on the laptop. It has a small window, not a big UI.

**What it does for the MVP:**
- Lets the user choose which project folders are exposed (allowlist).
- Detects installed agents and exposes that list.
- Shows a QR code to pair a phone.
- Maintains an outbound connection to the relay so the phone can reach it.
- Spawns the selected agent as a subprocess **inside the selected allowlisted folder** when a task arrives, and streams its output back.
- Keeps the laptop awake while an agent is running, and restores normal sleep settings when idle or on exit. *(Already built — do not overwrite.)*

#### HELM Mobile (`helm-mobile/`)
A lightweight React Native / Expo app. Its only job is to be the control surface.

**What it does for the MVP:**
- Pairs with a laptop by scanning the QR code.
- Shows the list of approved projects.
- Lets the user pick a project, then pick an available agent.
- Lets the user type a task and send it.
- Shows streamed output and the final result.
- Handles "laptop offline / unreachable" with a clear retry state — never a blank screen.

### Core user journey (MVP)

**Setup (one time, laptop):**
1. Install and open HELM Desktop.
2. Add the project folders to expose.
3. HELM scans for installed agents and shows what it found.
4. The app shows a QR code and moves to the tray.

**Pairing (one time, phone):**
1. Open HELM Mobile, tap "Pair with Laptop".
2. Scan the QR code on the desktop.
3. Paired — the project list appears. Pairing persists.

**Daily use (phone, from anywhere):**
1. Open HELM Mobile; it connects to the laptop through the relay automatically.
2. See the approved projects → tap one.
3. See the available agents → tap one (e.g. Claude Code).
4. Type a task (e.g. "Add input validation to the login form") and send.
5. The laptop spawns the agent inside that folder with the instruction.
6. The phone shows live output as the agent works.
7. When the task completes, the phone shows the result/summary.
8. Continue with another task or close.

### Agent detection (MVP)

On startup, the desktop scans the system for installed agents and lists only those found. This list is sent to the paired phone, which shows only these agents.

| Agent | Detection method |
|---|---|
| Claude Code | `claude` binary in PATH or common install locations |
| OpenAI Codex CLI | `codex` binary in PATH |
| Antigravity CLI | `antigravity` or `ag` binary in PATH |

### Agent I/O bridge (MVP)

Coding agents are interactive CLI tools, not HTTP APIs. The desktop bridges them to the phone with the **simplest** thing that works:

1. On task submit, spawn the selected agent as a child process **inside the selected allowlisted folder**.
2. Pass the task via stdin or a CLI argument, depending on the agent.
3. Read stdout/stderr as the agent runs.
4. Forward output lines to the phone through the relay as they arrive.
5. Emit a clear "task complete" (or "agent error") signal at the end.

Keep the stream as plain text lines plus a completion marker for the MVP. Rich structured events, diff rendering, and inline approval cards are **roadmap**, not MVP. This bridge forwards agent output — it is **not** a terminal or shell; the phone cannot run arbitrary commands.

### Connection model (MVP)

The phone and laptop talk through a small relay because the laptop is behind home NAT and the phone may be on a different network.

- The desktop keeps a persistent outbound WebSocket to the relay.
- The phone connects to the relay when opened.
- The relay routes messages between the two using the paired session token.
- Use **TLS** for the relay connection. That is the security bar for the MVP.

Keep the relay deliberately dumb: route messages, track which session goes to which socket, handle disconnect/reconnect. No business logic, no storage of user data.

### MVP security bar (intentionally minimal)

The MVP must be safe enough to demo and respect a few hard lines, without building a security platform:

- **Directory isolation:** agents run only inside allowlisted folders — no exceptions. *(Non-negotiable.)*
- **Laptop-only secrets:** code, credentials, API keys, and dependencies never leave the laptop; only agent output goes to the phone. *(Non-negotiable.)*
- **TLS transport** between phone, relay, and laptop.
- **Pairing token** tied to the laptop session via the QR code.

Full end-to-end payload encryption, device-password second factor, session-token rotation, and remote device revocation are **roadmap** — see §3. Do not let them block the demo.

### Desktop UX (MVP)
- Lives in the system tray; minimal window when clicked.
- Sections: **Projects** (add/remove folders), **Pairing** (QR code), **Status** (relay connection, detected agents, keep-awake state).

### Mobile UX (MVP)
- Primary path: **Projects → Agent → Task → Output**. Nothing else on the main path.
- Render agent output as readable text. A completion state when the task finishes.
- A persistent connection indicator (connected / reconnecting / laptop offline) with a retry action.

#### Mobile design — use the B&W prototype as the reference (not `design.md`)

A complete, browser-verified UI prototype lives at `helm-mobile-prototype/index.html`. It defines the
visual language for the real Expo/RN app. **The prototype overrides the aurora-gradient direction in
`design.md`** — the approved design is dark-first, pure monochrome.

**5 screens defined and verified:**

| Screen | Key elements |
|---|---|
| **Welcome / Login** | HELM `>_` mark, tagline, Continue with Apple (fill) / Google (outline) / email. Intro + login are one screen. |
| **Scan device** | Animated white corner-bracket QR viewport, "or" 6-digit mono code input, Pair button, TLS lock note. |
| **Dashboard — Projects tab** | Project cards (mono path, title, "active Xm ago", chevron) + "+ Authorize directory" ghost row. |
| **Dashboard — Agents tab** | Claude Code (selected) / Codex CLI / Antigravity CLI (not installed, dimmed). Pair agent CTA. |
| **Dashboard — Settings tab** | Appearance, Notifications toggle, Keep laptop awake toggle, Paired laptop / Unpair. |
| **Dashboard — Account tab** | Avatar, name, email, Plan row, Log out (outlined button). |
| **Task → Console → Result** | 3 modes: Input (task textarea + Run agent) → Running (mono streaming console + shimmer edge + Cancel) → Result (✓ banner + stat cards: lines / files / elapsed + Start new task). |
| **Offline / Unreachable** | Soft: glass reconnect bar + sweep animation. Hard: still "dead orb" + "Laptop unreachable" + Try again + Pairing details. Never a blank screen. |

**Design tokens (monochrome — use these, not `design.md`'s aurora tokens):**
```
--bg #0A0A0B  --surface #131316  --surface-2 #1B1B1F
--fill #FFFFFF (only accent — primary buttons, selected states)
--ink-hi #FAFAFA  --ink-mid #A1A1A6  --ink-lo #6B6B70
Type: Geist (UI) + Geist Mono (machine artifacts only: paths, codes, console, versions)
Radius: 12 inputs · 18 cards · 28 sheets · full pills
Status: grayscale — white breathing dot = connected, hollow ring = offline. No color.
```

### Recommended tech stack (MVP)

- **Desktop:** Electron (already in place), Node.js for the daemon logic, local JSON or SQLite for the project list and pairing info.
- **Mobile:** React Native + Expo, a WebSocket client, `expo-secure-store` for the pairing token.
- **Relay:** Node.js + `ws`. Minimal routing only. Deploy on any cheap VPS (Railway, Fly.io, a $5 droplet).
- **Transport:** TLS everywhere.

### Workspace layout

```
helm-desktop/              # Electron tray app (laptop side) — keep-awake built, rest to build
helm-mobile/               # Expo / React Native control app — to scaffold (use prototype as design ref)
helm-relay/                # Minimal WebSocket relay — to scaffold
helm-mobile-prototype/     # Browser-ready B&W design prototype — the visual reference for helm-mobile
docs/design-research/      # Reference screenshots (Mobbin, Dribbble, Savee, Stitch)
design.md                  # Original aurora design system — superseded by B&W prototype for visual direction
```

---

## 3. Future Roadmap (NOT the MVP)

Everything below is deferred. It is real long-term direction, but building any of it now works against the goal of the smallest demo. Revisit only after the core flow works end-to-end.

- **Advanced encryption** — full end-to-end payload encryption (libsodium / Web Crypto), per-device key pairs negotiated at pairing, relay seeing only ciphertext.
- **Hardened pairing & sessions** — device-password second factor, one-time tokens with expiry, long-lived rotating session tokens, immediate remote device revocation, a paired-devices management screen.
- **Rich agent interaction** — structured event types (`file_change`, `shell_command`, `approval_request`, `progress`, etc.), in-app approval cards, and back-channel responses to the agent.
- **Diff review** — visual diff cards (green/red), file-change summaries.
- **Terminal / shell access** — embedded terminals, remote shells, raw command execution. *(Explicitly excluded from the MVP — HELM is not a terminal product.)*
- **File browser / editor** — viewing or editing files from the phone.
- **Multi-agent orchestration** — multiple simultaneous agents, queues, handoffs.
- **Team & sharing features** — multiple users, shared projects, permissions.
- **Plugins & extensibility** — custom agent registration UI, plugin systems.
- **Analytics & history** — task history, metrics, dashboards.
- **Offline support & sync** — queuing tasks while the laptop is offline, richer reconnection.
- **Scale infrastructure** — Redis-backed relay routing, horizontal scaling, multi-region.
- **Cross-platform desktop** — macOS/Linux parity beyond what already exists.

---

## 4. Non-Negotiable Constraints (apply at every stage)

1. Agents run **only** inside allowlisted project folders — never elsewhere on the laptop.
2. Code, credentials, API keys, and dependencies **never leave the laptop**; the phone receives only agent output and results.
3. The keep-awake sleep inhibitor is active **only** during agent runs and **always** restores normal system settings when idle or on exit.
4. The mobile app handles "laptop offline / unreachable" gracefully with a retry state — never a blank or broken screen.

---

## 5. The test for every future decision

> **"Does this help the user assign work to an agent on their laptop from their phone?"**

If yes, it may belong in the MVP. If no, it belongs in the Future Roadmap. Default to the smaller thing.

*End of specification.*
