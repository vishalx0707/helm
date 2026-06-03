# HELM Mobile — Black & White Prototype (Spec)

> Date: 2026-06-03 · Status: approved for build · Deliverable: self-contained HTML/CSS prototype.
> Supersedes the aurora-gradient direction in `design.md` for this monochrome redesign. Source sketches:
> the user's Stitch project "HELM Remote Control" (`docs/design-research/stitch/*.png`), redesigned with
> original craft — Stitch used only as a rough sketch, not as the generator.

## Goal
A premium, **dark-first monochrome** (pure black & white) mobile UI for HELM, shown as a phone-framed
HTML prototype. Visual only — no backend/auth. Covers the user's flow: **Welcome/Login → Scan device →
Dashboard** (Projects · Agents · Settings · Account/Logout).

## Scope decisions (locked with user)
- Platform: mobile **design**, delivered as one self-contained `helm-mobile-prototype/index.html`.
- Aesthetic: **pure black & white**, dark canvas. White is the only "accent."
- Auth: **visual screens only** (Apple/Google/email buttons are non-functional).
- Intro + Login are **one merged screen** (brand moment = login screen).
- HELM is **not** a terminal product: the Stitch "Control your terminal with AI" copy and "Terminal"
  tab are dropped; copy uses agent/laptop language; "Pair with your Mac" → device-agnostic "laptop."

## Design tokens (monochrome)
```
--bg #0A0A0B · --surface #131316 · --surface-2 #1B1B1F
--hairline rgba(255,255,255,.08) · --hairline-2 rgba(255,255,255,.14)
--ink-hi #FAFAFA · --ink-mid #A1A1A6 · --ink-lo #6B6B70 · --on-fill #0A0A0B
--fill #FFFFFF (primary action / selected) · --focus rgba(255,255,255,.5)
radius: 12 inputs/buttons · 18 cards · 28 sheets · full pills/dots
```
- Type: **Geist** (UI/headings) + **Geist Mono** (paths, pairing codes, agent versions) — machine bits
  only. No Inter/Roboto/system fonts.
- Status shown in **grayscale**, not color: connected = solid white breathing dot, idle = mid dot,
  error = hollow ring dot.
- Depth = hairline borders + soft black shadow + 1px top specular highlight on raised surfaces. No
  colored glow.
- Motion (CSS): 150ms fades; `cubic-bezier(.22,1,.36,1)` transforms; press scale .97; staggered card
  entrance on load; breathing connection dot; animated white scan brackets.

## Screens
1. **Welcome / Login** — HELM mark (`>_` mono glyph in rounded square), wordmark, tagline "Direct the AI
   agents on your laptop — from anywhere." · Continue with Apple (white) / Google (outline) · "or" ·
   Continue with email · ToS/Privacy footer.
2. **Scan device** — "Pair with your laptop." · camera viewport with animated white corner brackets +
   scan line · "or" · 6-digit mono code input · white **Pair** button · lock + "No code or credentials
   ever leave your laptop · TLS encrypted."
3. **Dashboard** — top bar: HELM mark + breathing **● Connected** dot + avatar. Tab content:
   - **Projects** (home): project cards (mono path, title, "active 5m ago", chevron) + "+ Authorize
     directory" ghost row.
   - **Agents**: selectable agent rows (Claude Code / Codex CLI / Antigravity CLI; one "Not installed").
   - **Settings**: appearance, notifications, paired-laptop manage/unpair.
   - **Account**: avatar, name/email, plan, **Log out** (outlined).
   - Bottom tab bar: Projects · Agents · Settings · Account.
4. **Task → Console → Result** — header breadcrumb "TermWork / Claude Code" + status badge (Ready dot →
   Running spinner-ring → ✓ Done). Three modes in one frame: **Input** (task box + Run agent),
   **Running** (task summary chip + mono console that streams lines with a top shimmer + Cancel task),
   **Result** (✓ completion banner + stat cards with count-up numbers: lines / files / elapsed + Start
   new task). All status shown in grayscale (no green console).
5. **Offline / Laptop unreachable** — the never-blank recovery state. Soft reconnect glass bar at top
   ("Reconnecting…" + spinner ring + sweep), and the hard state: a still hollow "dead orb" (no
   heartbeat) with a no-signal glyph, "Laptop unreachable", body copy, **Try again** (shows ring while
   retrying), "Pairing details" link.

## Deliverable
`helm-mobile-prototype/index.html` — one file, fonts via Google Fonts CDN, all screens as 390×844 phone
frames in a dark gallery; the Dashboard frame is interactive (tab switching). Opens in any browser.

## Acceptance
- Strictly monochrome (no hue anywhere); Geist + Geist Mono only; mono used only on machine artifacts.
- All three screens present; dashboard tabs switch; scan brackets + connection dot animate.
- Reads high-end and intentional, not generic-AI; touch targets ≥ 44px; copy is agent/laptop, never
  terminal.
