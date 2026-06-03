# HELM Mobile — Design System & Agent Design Prompts

> **Audience: AI coding/design agents (Claude Code, Codex, Antigravity, v0, Figma Make).**
> This is the single source of truth for how the **HELM Mobile** app (React Native / Expo) should look, move, and feel.
> Read it top-to-bottom once, then use the **per-screen prompt blocks** in §9 as copy-paste briefs.
>
> **Companion docs:** `product.md` (what to build), `helm_design_brief.md` (UX spec), `CLAUDE.md` (rules).
> **Scope of this doc:** Mobile app only. Desktop/Electron and landing pages are out of scope here.

---

## 0. How agents should use this document

1. **Always prepend §10 (the Design System Preamble)** to any screen-generation prompt. It carries the tokens and rules.
2. **Then paste the matching §9 screen block.** Each screen block is self-contained: layout, states, motion, and acceptance criteria.
3. **Obey the Do/Don't list (§8).** It exists specifically to kill the "generic AI app" look.
4. **When unsure about a pattern, pull a real reference** from the library in §2 instead of inventing one.
5. **Motion is not optional decoration here — it is the product's primary signal of trust** (see §5). A screen without the specified motion is incomplete.

**The feeling we are chasing, in one line:**
> *A premium, modern-startup control room for AI agents — calm dark canvas, vivid aurora-gradient energy, glass surfaces that float over content, and physics-based motion so smooth it feels native and alive.*

---

## 1. Design North Star

HELM is a **remote control for powerful machines you can't see**. The user is at a café trusting their laptop to run real code. The design's job is to make that trust *feel* earned at every frame: connection is alive, the agent is working, the result is real.

We deliberately chose a **modern-startup / Framer-grade aesthetic** (bold gradients, expressive motion, spring physics, glass) layered over a **dark, developer-credible base**. This is the lineage of Linear, Cash App, Family, Arc, and Cal AI — apps that feel *expensive* because every interaction has weight, feedback, and restraint.

### The three emotional beats of the core flow
| Flow step | Emotion to engineer | Primary design tool |
|---|---|---|
| **Pair** | "This was effortless and secure." | A tactile QR scanner with a live, breathing bounding box; gradient reassurance copy. |
| **Project → Agent → Task** | "I'm in command of something powerful." | Shared-element transitions, large confident touch targets, gradient agent cards. |
| **Progress → Result** | "It's really working — and it finished." | A living console (typed, gradient-edged), a pulsing status orb, a satisfying completion burst. |

### Non-negotiables this design must honor (from `CLAUDE.md`)
- **The offline state is never blank.** A "Reconnecting…" glass bar or full "Laptop Unreachable" recovery state with a retry trigger is a *designed, beautiful* screen — not an error dump.
- **The phone is a control surface, not a terminal.** Never style anything to invite raw command typing or file editing. The console is *read*, the task box is *intent*.

---

## 2. Reference Library — what to pull from where

Agents: when a pattern is unclear, **go look at a real example first**. Each source below is tagged with *what it is best for* and *what to steal*.

### Live pattern & flow libraries (real shipping apps)
| Source | URL | Best for | Steal this |
|---|---|---|---|
| **Mobbin** | mobbin.com | Broadest real iOS/Android/web screen + **flow** library | Onboarding, pairing, settings, subscription, empty-state flows. Search "onboarding", "scanner", "connection". |
| **Page Flows** (was Screenlane) | pageflows.com | **Video** recordings of real user journeys | Motion *in context* — how transitions/timing actually feel, not just static frames. |
| **Refero** | refero.design | Web-first, strong AI visual search, SaaS/landing | Status pills, dashboards, data-state patterns, marketing-grade polish. |
| **screensdesign.com** | screensdesign.com | Deep UI breakdowns of top iOS apps (incl. Cal AI) | *Why* premium apps feel premium — annotated teardowns. |
| **60fps.design** | 60fps.design | Curated mobile/web **motion** inspiration | Micro-interaction timing, spring feel, transition ideas. |
| **animatereactnative.com** | animatereactnative.com | Production **React Native** animation recipes | Concrete builds: QR scanner bounding box, Moti passcode, animated onboarding flatlist, shared-element transitions, animated countdown, gradient conversation. *This is our implementation library.* |

### Visual taste / mood (composition, color, type)
| Source | URL | Best for |
|---|---|---|
| **Savee** | savee.com *(login)* | Moodboarding — color, gradient, type, motion taste. Search e.g. `dark mobile app ui gradient`. |
| **Cosmos** | cosmos.so *(login)* | AI-curated visual discovery — browse the **Interfaces** and **Motion** clusters specifically. |
| **Dribbble** | dribbble.com | Concept shots — *direction only, never copy*. Search `ai agent app dark mobile` for our exact lane. |
| **21st.dev** | 21st.dev | Modern React component patterns (Heroes, CTAs, animated numbers, gradient backgrounds, docks) — adapt to RN. See §2.5 for component names. |

### Platform & system truth
| Source | URL | Best for |
|---|---|---|
| **Apple Human Interface Guidelines** | developer.apple.com/design/human-interface-guidelines | Touch targets, gestures, safe areas, accessibility, **Liquid Glass** material principles |
| **GitHub mobile app** | (App Store) | Reference for a *credible developer tool* on phone — restraint, density done right |
| **Moti docs / Reanimated docs** | moti.fyi · docs.swmansion.com/react-native-reanimated | The animation API we actually write against |

### What the best references teach us (apply these lessons)
- **Cal AI** → *Investment through onboarding.* Quiz-style, instant-feedback steps build commitment before payoff. A **ring/progress chart** as a hero metric reads as premium. Use this: HELM's pairing + first-run should feel guided and rewarding, and "agent running" deserves a hero progress visual, not a spinner.
- **Apple Liquid Glass** → *Controls float above content on translucent, light-bending glass; glass signals depth and feedback, never decoration.* Use glass for the connection bar, bottom action bar, and bottom sheets — with real blur + a thin specular top edge. Never glass-on-glass into mud.
- **Linear / Cash App** → *Snappy transitions + instant feedback build trust.* Every tap responds in <100 ms with motion or haptics.

### Access notes (verified this session)
- **Mobbin** — individual **flow pages render publicly without login** (e.g. a full 34-screen onboarding flow). Search/boards need an account. Agents: open a specific flow URL and study it frame-by-frame.
- **21st.dev / animatereactnative.com / screensdesign.com / Refero (taxonomy)** — fully public.
- **Refero** ships a **Refero MCP for AI agents** — agents can query its library directly instead of scraping.
- **Savee / Cosmos / Page Flows** — require login. Savee & Cosmos are *taste/mood* sources (color, gradient, motion vibe); Page Flows is *video* journeys. Ask the user to sign in if deeper mood research is needed.

---

## 2.5 Field Research — concrete findings from real screens (this session)

These are observations pulled from **actual live screens**, not theory. Screenshots saved in `docs/design-research/`. Apply them directly.

### Cal AI — real onboarding screens (via Mobbin) → `docs/design-research/mobbin-calai.jpeg`
- **Pattern stack:** centered minimal splash → camera-scan screen with **corner-bracket viewfinder** + dark pill "Get Started" → a long **quiz onboarding** (28–34 steps) with a **thin progress bar pinned at top**, **large list-select rows** (selected = filled solid), and a **persistent bottom primary CTA that stays disabled/grey until a choice is made, then fills**.
- **Why it feels premium:** lots of whitespace, one accent color, big touch targets, a *single* clear action per screen, and momentum from the progress bar.
- **Steal for HELM:** the **top-progress-bar + activating-bottom-CTA** rhythm for pairing/first-run; the **corner-bracket viewfinder** for the QR scanner; gamified "milestone" moments (a first-successful-task celebration).

### Savee — dark gradient UI taste → `docs/design-research/savee-search.jpeg`
- Recurring premium signals on a "dark mobile app gradient" search: **gradient ring / donut progress charts (blue→purple)**, **thin animated wireframe-line graphics** on near-black, **glass blurred floating cards**, restrained **neon-on-dark** accents (emerald/cobalt/violet), and soft grain/blur gradient fields. Most top results were **motion** (VIDEO) — confirming motion is the differentiator.
- **Steal for HELM:** use a **gradient progress ring** as the hero "agent running" visual (not a spinner); keep accents few and luminous on the graphite canvas.

### Dribbble — "AI agent app, dark mobile" → `docs/design-research/dribbble-aiagent.jpeg`
- The dominant, current visual language for AI-agent apps is **exactly our direction**: dark canvas with a **violet/purple ambient gradient glow behind the device**, **agent cards** with status, **"Agent Details"** screens, **recent-activity feeds**, **quick-action grids**, and **stat cards with mini bar charts**.
- **Steal for HELM:** agent selector cards and the task/result screens should use that **ambient glow + agent-card + activity-feed** grammar. The console-completion summary can borrow the **stat-card** treatment (changed lines, duration).

### 21st.dev — real, installable background components → `docs/design-research/21st-backgrounds.jpeg`
- Named components agents can pull and adapt to RN: **Aurora Background** (Aceternity), **Beams Background**, **Glow**, **Background Circles** (≈ HELM status orb), **Gradients X Animations** (≈ our aurora), **Background Gradient Animation**, **Sparkles**, **Background Paths**, **Hero Highlight**, **Grid Pattern** (Magic UI), **Animated Gradient with SVG**, **Pixel Trail**, **Etheral Shadow**, **FlickeringGrid**.
- **Steal for HELM:** "Aurora Background" / "Gradients X Animations" for the ambient page glow; "Background Circles" / "Glow" for the breathing status orb.

### animatereactnative.com — the exact pairing recipe (verified)
- The **QR scanner bounding box** recipe uses `expo-camera` (`CameraView`, `useCameraPermissions`) + `react-native-reanimated` v4 with **shared values** `x, y, boxWidth, boxHeight, opacity`, animated via `withSpring` / `withTiming` / `withDelay`, appearing/hiding with `FadeInDown` / `FadeOutDown`, and `runOnJS` to bridge detection state. Smooth, minimal flicker.
- Install: `npx @animatereactnative/cli@latest add qrcode-scanner-bounding-box` · deps `expo-camera@~17 react-native-reanimated@~4.1`.

### Refero — how agents should query it
- Use its filter taxonomy as a search vocabulary. For HELM map to: **Sites = Development Tools / AI Tool**, **Flows = Onboarding + Chatting & Messaging** (the console-stream analogue) **+ Connecting & Linking**, **UX Patterns = Dark Mode + Skeleton + Activity & Notification Feed + Stats + Trial/Freemium**, **UI Elements = Cards & Tiles + Tabbar + Drawer + Skeleton**.

---

## 3. Design Tokens — Color

HELM runs **dark-first**. The base is a near-black graphite canvas; energy comes from **aurora gradients** and **semantic state colors** mapped to the connection/agent lifecycle.

### Canvas & surfaces (dark)
```
--bg-base        #07080B   /* app canvas — near-black, slight blue */
--bg-raised      #0E1016   /* cards, sheets */
--bg-overlay     #14161F   /* popovers, inputs */
--surface-glass  rgba(20,22,31,0.55)  /* + blur(24px), 1px top highlight rgba(255,255,255,0.08) */
--hairline       rgba(255,255,255,0.07) /* borders/dividers */
--hairline-strong rgba(255,255,255,0.12)
```

### Text
```
--text-hi    #F4F6FB   /* primary */
--text-mid   #A7AEBF   /* secondary */
--text-lo    #6B7080   /* tertiary / disabled */
--text-mono  #C8D0E0   /* monospace paths & console */
```

### Semantic state colors (the connection lifecycle — keep these meanings exact)
```
--connected   #22E0A1   /* emerald  — paired / active / success */
--agent       #4F7BFF   /* cobalt   — agent action / running / primary */
--reconnect   #FFB020   /* amber    — reconnecting / warning */
--error       #FF4D62   /* crimson  — error / offline / cancel */
--idle        #8A90A2   /* slate    — neutral / not detected */
```

### Aurora gradients (the brand energy — use intentionally, never everywhere)
```
--grad-helm     linear 135deg  #4F7BFF → #22E0A1            /* primary brand: agent→success */
--grad-running  linear 120deg  #4F7BFF → #8A5CFF → #22E0A1  /* active task shimmer */
--grad-warn     linear 135deg  #FFB020 → #FF7A45
--grad-error    linear 135deg  #FF4D62 → #B026FF
--grad-aurora   radial, multi-stop #4F7BFF/#22E0A1/#8A5CFF at low opacity over --bg-base (ambient page glow)
```

**Gradient usage rules**
- One *hero* gradient per screen, maximum. Everything else is solid or hairline.
- Gradients live on: the primary CTA, the active status orb/ring, the brand mark, the running-console edge glow, and the ambient page background (very low opacity).
- Never put body text on a gradient. Never gradient-fill a whole card's background at full opacity.

### Light mode
Ship dark-first. If light mode is requested, invert canvas (`#F7F8FB` base, `#FFFFFF` raised), keep the *same* semantic + gradient hues but drop their opacity ~15% and increase contrast on hairlines. Do not redesign — re-tone.

---

## 4. Design Tokens — Type, Space, Shape, Elevation

### Typography
Two families, strict separation of duty:
- **Display / UI:** `Outfit` (headers, hero) + `Inter` (body, labels). Outfit for personality, Inter for legibility.
- **Mono:** `JetBrains Mono` (or `Geist Mono`) — **only** for file paths, directory names, commands, tokens, and console output. Monospace = "this is a real machine thing."

```
display-xl  34/40  Outfit  SemiBold  -0.02em   /* screen heroes */
display-l   28/34  Outfit  SemiBold  -0.02em
title       20/26  Outfit  Medium    -0.01em   /* card titles, headers */
body        16/24  Inter   Regular              /* default */
label       14/20  Inter   Medium               /* buttons, pills */
caption     12/16  Inter   Regular   +0.01em    /* meta, timestamps */
mono-path   14/20  JetBrains Mono Regular        /* ~/Projects/TermWork */
mono-console 13/20 JetBrains Mono Regular        /* streamed output */
```
Tabular numbers on for any counters, timers, line counts.

### Spacing — 4pt base scale
`4 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 56 · 72`
Screen gutter: **20**. Card padding: **16–20**. Section gap: **24–32**. Thumb-zone bottom inset: respect safe area + 16.

### Radius
```
--r-sm  10   /* pills, chips, inputs */
--r-md  16   /* buttons, list rows */
--r-lg  24   /* cards, sheets */
--r-xl  32   /* hero containers, bottom sheet top */
--r-full 999 /* status pills, FAB, orb */
```
Consistent, generous rounding = modern/friendly. Never mix sharp and round in one component.

### Elevation (dark = glow + lift, not heavy drop shadow)
```
--e1  shadow y2 blur8  rgba(0,0,0,0.4)                         /* resting card */
--e2  shadow y8 blur24 rgba(0,0,0,0.5)                         /* sheet / FAB */
--glow-agent  shadow 0 blur24 rgba(79,123,255,0.35)           /* active primary */
--glow-ok     shadow 0 blur24 rgba(34,224,161,0.30)           /* success/connected */
```
A focused/active element gets a colored **glow**, not a darker shadow. This is the "alive" feeling.

### Glass surface recipe (Liquid-Glass inspired)
```
background: --surface-glass
backdrop-filter: blur(24px) saturate(1.2)
border-top: 1px rgba(255,255,255,0.10)   /* specular highlight edge */
border: 1px --hairline
```
Use glass for: connection bar, bottom action bar, bottom sheets, the running-task header. **Max one glass layer deep.** Glass must always sit *over* content scrolling beneath it — that's the point.

---

## 5. Motion & Scroll System — the heart of "smoothness"

> This is the section that makes HELM feel premium. Treat every spring config below as a **token**. Do not hand-roll arbitrary durations.

### Implementation stack (use exactly these)
| Need | Library | Notes |
|---|---|---|
| Core animations (UI-thread, 60–120fps) | **react-native-reanimated** (v4) | Worklets run off the JS thread. All shared values + springs here. |
| Declarative transitions (Framer-Motion-style) | **Moti** | `from` / `animate` / `exit`, `<AnimatePresence>`, `useAnimationState`, `<Skeleton>`. Use for 90% of mounts/toggles/loaders. |
| Gestures (swipe, drag, pull) | **react-native-gesture-handler** | Pair with Reanimated for drag-to-dismiss sheets, swipe rows. |
| Haptics | **expo-haptics** | Fire on every meaningful state change (see map below). |
| Custom graphics (optional) | **react-native-skia** | Only for the orb shader / aurora glow / progress ring if CSS-style can't do it. |

### Spring presets (named motion tokens)
```
spring.snappy   { damping: 18, stiffness: 220, mass: 0.9 }  // taps, toggles, pills — fast, minimal overshoot
spring.smooth   { damping: 20, stiffness: 140, mass: 1   }  // cards, sheets, screen content — calm, confident
spring.bouncy   { damping: 12, stiffness: 180, mass: 1   }  // celebratory moments (success burst) — playful overshoot
spring.gentle   { damping: 26, stiffness: 90,  mass: 1   }  // ambient/idle loops (orb breathing) — slow, soft
timing.micro    180ms  ease: [0.22, 1, 0.36, 1]            // opacity/color fades
timing.page     360ms  ease: [0.22, 1, 0.36, 1]            // full-screen transitions
```
**Rule:** position/scale/layout → **spring**. opacity/color → **timing**. Never animate layout with linear easing.

### Haptic map (expo-haptics)
| Event | Haptic |
|---|---|
| Button / card tap | `selection` (light) |
| Successful pair / task complete | `notificationAsync(Success)` |
| Error / offline / cancel | `notificationAsync(Error)` |
| Agent selected / Run pressed | `impactAsync(Medium)` |
| Pull-to-refresh threshold | `impactAsync(Light)` |

### Scroll & list behavior (the "smooth scrolling" the brief demands)
- **Momentum & overscroll:** native iOS bounce on; on Android use a custom subtle over-scroll glow in `--agent` at the edge. Never a hard stop.
- **Sticky glass headers:** screen title shrinks/condenses into the glass top bar as you scroll (interpolate font size + opacity on scroll offset via Reanimated `useAnimatedScrollHandler`).
- **Staggered list entrance:** project/agent cards enter with `spring.smooth`, each delayed `index * 45ms`, translateY 16→0 + opacity 0→1 (Moti `from`/`animate` or Reanimated `Layout`/`FadeInDown`).
- **Snap where it helps:** agent selector and any horizontal carousel use `snapToInterval` / pagingEnabled with `decelerationRate="fast"`.
- **Console auto-scroll:** pin to bottom while streaming; if the user scrolls up, *unpin* and show a floating "↓ Jump to latest" pill (gradient, glass) that re-pins on tap.
- **Pull-to-refresh** on dashboard: custom indicator (aurora ring filling), not the default spinner.
- **Keep it on the UI thread.** Anything that animates during scroll/gesture must be a Reanimated worklet — never `setState` in a scroll handler.

### Page transition system
- **Project → Agent → Task** is a **forward drill-down**: new screen slides in from right with `spring.smooth`, outgoing screen parallax-shifts left 20% + dims to 0.6.
- **Shared element:** the selected project's name/icon and the selected agent's chip animate (shared transition) into the next screen's header. Use Reanimated shared element / `react-navigation` shared transitions.
- **Modal/sheet:** bottom sheets rise with `spring.smooth`, dim the canvas behind to 40%, and are drag-to-dismiss with a rubber-band resistance worklet.

### Signature "living" motions (build these — they define the brand)
1. **Status orb** — a small circle that *breathes* (scale 1↔1.08, `spring.gentle`, infinite) when connected; pulses faster + brighter on `--agent` while a task runs; goes still + `--error` when offline. Optional Skia shader for inner aurora swirl.
2. **Running shimmer** — the console's top edge and the running pill carry a slow animated `--grad-running` sweep (translateX loop) so "working" is felt, not read.
3. **Completion burst** — on task success: a one-shot `spring.bouncy` scale-in of the ✓, a brief emerald glow bloom, success haptic, and the status orb settles back to breathing.
4. **Number roll** — line counts / changed-files / timers roll digit-by-digit (à la 21st.dev animated-blur-number), never hard-cut.

---

## 6. Component Patterns

Build these as a small reusable kit. Each must ship with its motion + states.

- **Button (primary):** filled `--grad-helm`, `--r-md`, label 14 Medium, `--glow-agent` when enabled. Press: scale 0.96 `spring.snappy` + selection haptic. Disabled: `--idle` solid, no glow.
- **Button (secondary/ghost):** transparent, `--hairline-strong` border, `--text-hi` label. Same press motion.
- **FAB / Run button:** `--r-full`, gradient, floats in bottom thumb zone over glass bar; pulses gently when it's the primary next action.
- **Status pill:** `--r-full`, glass bg, leading status orb (breathing), `label` text. Color = current lifecycle state. This is the persistent connection indicator — present on every connected screen.
- **Project card (list row):** `--bg-raised`, `--r-lg`, mono path (`~/Projects/TermWork`), title in Outfit, `caption` last-active timestamp, trailing chevron. Press: scale 0.98 + `--e2` lift. Staggered entrance.
- **Agent card (selectable, large target):** `--r-lg`, agent name + one-line description, leading glyph. Selected = gradient hairline border + `--glow-agent` + scale 1.02. **Not-detected** = `--idle` text, dimmed 0.5, "Not installed" tag, non-interactive.
- **Task input:** multi-line, `--bg-overlay`, `--r-lg`, placeholder *"What should the agent do in this repository?"*, grows with content, mono not required (this is intent/prose). Focus: `--agent` hairline + soft glow.
- **Console viewport:** `--bg-base` inset card, `mono-console` text, lines fade+rise in as they stream (`FadeInDown`, 120ms), `--grad-running` top edge while active. Auto-scroll + jump pill (§5).
- **Completion banner:** full-width glass card. Success = emerald, ✓, "Task Completed", changed-line count (number-roll). Error = crimson, ⚠, short error summary. Bouncy entrance + haptic.
- **Connection bar (glass):** thin top/bottom glass bar showing live state; on disconnect it expands into the amber "Reconnecting…" bar with an animated indeterminate aurora sweep.
- **Bottom sheet:** `--r-xl` top, glass, drag handle, `spring.smooth` rise, backdrop dim + drag-to-dismiss.
- **Skeleton loaders:** Moti `<Skeleton>` with `--bg-raised`→`--bg-overlay` shimmer (`spring` translateX) for project list & agent list while fetching. Never a bare spinner on content areas.

---

## 7. Screen Inventory (mobile)

| ID | Screen | Core job |
|---|---|---|
| **S0** | Splash / Connecting | Brand moment + auto-reconnect to laptop |
| **S1** | Pairing (QR + manual token) | Scan QR / enter token to pair |
| **S2** | Dashboard / Project list | Pick an allowlisted project |
| **S3** | Agent selector | Pick a detected agent |
| **S4** | Task + Console + Result | Write task → watch stream → see result |
| **SX** | Offline / Laptop Unreachable | The never-blank recovery state |

---

## 8. Do / Don't — kill the generic-AI look

**DO**
- Commit to the dark aurora aesthetic with confidence; use *one* hero gradient per screen.
- Give every tap instant feedback: motion + haptic in <100 ms.
- Use monospace *only* for machine artifacts (paths, commands, console). It's a signal, not a font choice.
- Make loading states beautiful (skeletons, breathing orb, aurora ring) — never a centered grey spinner.
- Float controls on glass over scrolling content (Liquid-Glass principle).
- Use real spring physics from §5 tokens for all position/scale changes.
- Respect safe areas and 44×44pt minimum touch targets.

**DON'T**
- ❌ Generic SaaS look: pure-white cards on grey, flat default-blue buttons, Material defaults untouched.
- ❌ Rainbow overload: more than one gradient surface per screen, or gradient body text.
- ❌ Decorative motion that delays the user, or animations on the JS thread that jank during scroll.
- ❌ Terminal cosplay: green-on-black "hacker" themes, blinking cursors inviting command input, file-tree UIs. HELM is *control*, not a shell.
- ❌ Blank/error-dump states. Every empty, loading, and offline state is a designed screen.
- ❌ Tiny tap targets, text on busy gradients, or low-contrast `--text-lo` for anything important.
- ❌ Mixing sharp and rounded corners, or inconsistent spacing off the 4pt scale.

---

## 9. Per-Screen Prompt Blocks

> Usage: **paste §10 preamble first, then one block below.** Each block is written as a direct brief to a design/coding agent.

### S0 — Splash / Connecting
```
Build the HELM Mobile splash + auto-connect screen (Expo / React Native).

Layout: full --bg-base canvas with a very-low-opacity --grad-aurora radial glow drifting
slowly behind. Centered: the HELM compass/wheel brandmark filled with --grad-helm, and a
breathing status orb beneath it. Under that, a single line of status text that transitions:
"Connecting to your laptop…" → "Paired" → (or) "Laptop offline".

Motion: brandmark scales in with spring.smooth on mount; the aurora glow drifts on an infinite
spring.gentle loop; status orb breathes (scale 1↔1.08, spring.gentle). On successful connect,
emerald glow bloom + Success haptic, then auto-route to S2. On failure, route to SX.

States: connecting (agent/cobalt orb pulsing) · connected (emerald, brief) · failed (crimson, → SX).
No buttons unless it lands in failed state, where a single "Retry" ghost button appears.
Accept: feels alive within 200ms; never a static logo on black.
```

### S1 — Pairing (QR scan + manual token)
```
Build the HELM Mobile pairing screen. Goal: scan the QR shown on HELM Desktop, or enter a token.

Layout (top→bottom):
- Glass top bar with back chevron + title "Pair your phone".
- Hero copy (display-l, Outfit): "Point your camera at the code on your laptop."
- Live camera viewport in a --r-xl rounded container. Overlay an animated SCANNER BOUNDING BOX:
  four corner brackets in --connected (corner-bracket viewfinder, same family as Cal AI's scan
  screen) that gently breathe/scan. When a code is detected, the brackets snap inward + lock to
  emerald with a Success haptic.
  IMPLEMENTATION (verified recipe): build on expo-camera (CameraView, useCameraPermissions) +
  react-native-reanimated v4. Drive the box with shared values x/y/boxWidth/boxHeight/opacity via
  withSpring/withTiming/withDelay; appear+hide with FadeInDown/FadeOutDown; use runOnJS to commit
  the detected payload. Starter: `npx @animatereactnative/cli@latest add qrcode-scanner-bounding-box`.
- Divider "or".
- Manual entry: a segmented/Moti passcode-style token input (reference: animatereactnative.com
  "PassCode - Moti"), --bg-overlay, --r-md, mono, with a gradient "Pair" button below.
- Bottom glass reassurance card: "No code or credentials ever leave your laptop. The connection
  is encrypted via TLS." with a small lock glyph.

Motion: hero + viewport enter staggered (spring.smooth). Bounding box: infinite gentle scan loop;
lock animation on detect (spring.snappy). Token digits pop in with spring.snappy on type +
selection haptic. On success: emerald bloom across the viewport, Success haptic, shared-element
transition into S2 (the brandmark/orb carries over).

States: scanning · detecting (brackets pulsing faster) · paired (emerald lock) · error
(crimson shake on the token field, Error haptic).
Accept: scanner feels tactile and trustworthy; manual path is equally polished, not an afterthought.
```

### S2 — Dashboard / Project list
```
Build the HELM Mobile dashboard listing allowlisted project folders.

Layout:
- Sticky GLASS top bar: left = "Projects" title (condenses on scroll); right = persistent
  status pill ("● Connected" with breathing emerald orb).
- Scrollable list of Project cards (--bg-raised, --r-lg): each shows the mono directory path
  (e.g. ~/Projects/TermWork) as the prominent line, an Outfit title, a caption last-active
  timestamp, and a trailing chevron. Optional leading folder glyph tinted --agent.
- Pull-to-refresh with a custom aurora-ring indicator (not default spinner).
- Empty state (no projects allowlisted): friendly illustration + "No projects shared yet. Add a
  folder in HELM Desktop on your laptop." — a designed state, never blank.
- A small "Paired laptop · manage" link in a footer (revoke pairing entry point).

Motion: cards enter staggered (translateY 16→0 + opacity, spring.smooth, index*45ms). Title
condenses into the glass bar on scroll (interpolate size/opacity via useAnimatedScrollHandler).
Tap a card: scale 0.98 + --e2 lift + selection haptic, then forward drill-down to S3 with the
project name shared-element-transitioning into S3's header. While loading: Moti Skeleton rows.

States: loading (skeletons) · loaded · empty · offline (connection bar turns amber "Reconnecting…").
Accept: scrolling is buttery; the sticky glass header reads as premium; never a grey spinner.
```

### S3 — Agent selector
```
Build the HELM Mobile agent selector for the chosen project.

Layout:
- Ambient: a very-low-opacity violet/cobalt aurora glow behind the cards (the current AI-agent-app
  visual language — see docs/design-research/dribbble-aiagent.jpeg). One glow, low opacity.
- Glass top bar: back chevron + breadcrumb "TermWork" (arrived via shared element from S2).
- Hero line: "Choose an agent."
- Large, generous Agent cards (--r-lg, big touch targets), one per detected agent:
    • Claude Code — "Highly conversational, file-editing agent."
    • Codex CLI — "Direct code-completion agent."
    • Antigravity CLI — "Local tool assistant."
  Each card: leading agent glyph, name (title), one-line description (body, --text-mid).
- NOT-DETECTED agents render dimmed (0.5), --idle text, a "Not installed" chip, non-interactive.

Motion: cards enter staggered (spring.smooth). On select: card scales to 1.02, gains a
--grad-helm hairline border + --glow-agent, Medium impact haptic; other cards dim to 0.6. A
gradient "Continue" / Run-context button confirms and drills into S4 (selected agent chip
shared-element-transitions into S4 header).

States: list · one selected · some disabled (not installed).
Accept: selecting feels weighty and decisive; disabled agents are clearly unavailable, not broken.
```

### S4 — Task + Console + Result (three modes in one screen)
```
Build the HELM Mobile task screen with three modes: INPUT → STREAMING → COMPLETION.

Shared header (glass): "TermWork / Claude Code" + a status badge with a breathing/pulsing orb
("● Ready" idle → "● Running" agent/cobalt → "✓ Done" emerald / "⚠ Error" crimson).

INPUT mode:
- Multi-line task input (--bg-overlay, --r-lg), placeholder "What should the agent do in this
  repository?", grows with content, --agent focus glow.
- Prominent floating gradient "Run Agent" FAB in the thumb zone on a glass bar; pulses gently as
  the primary next action. Press: scale 0.96 + Medium haptic, then transition to STREAMING.

STREAMING mode:
- Optional hero: a gradient progress RING (blue→violet→emerald, à la Savee/Cal-AI metric rings)
  in the header showing elapsed/indeterminate activity — premium alternative to a spinner.
- The input collapses to a compact read-only summary chip at top (spring.smooth layout animation).
- A large Console viewport (~70% height): --bg-base inset, mono-console text, each streamed line
  fades+rises in (FadeInDown 120ms). A slow --grad-running shimmer sweeps the console's top edge so
  "working" is felt. Auto-scroll pinned to bottom; if user scrolls up, show a floating glass
  "↓ Jump to latest" gradient pill that re-pins on tap.
- A floating crimson glass "Cancel Task" button (force-kill); confirm with Error-tinted haptic.

COMPLETION mode:
- A completion banner rises with spring.bouncy: success = emerald ✓ "Task Completed Successfully"
  with a number-roll of changed-line count; error = crimson ⚠ "Agent Stopped with Error" + a short
  summary. Success fires a one-shot emerald glow bloom + Success haptic; the status orb settles
  back to gentle breathing.
- Present the result as STAT CARDS (borrowed from AI-agent dashboards on Dribbble): changed-line
  count, duration, files touched — each a small --bg-raised tile with a digit-roll number.
- A "Start New Task" gradient button returns to INPUT (input expands back via layout spring).

Motion tokens: see §5 — running shimmer, completion burst, number roll, line-stream entrances.
States: input · preparing · streaming · completed-success · completed-error · cancelled · offline.
Accept: the live console feels alive (not a log dump); completion is genuinely satisfying; cancel is
always reachable; if connection drops mid-run, the offline bar appears and the stream pauses
gracefully (never blanks).
```

### SX — Offline / Laptop Unreachable (the invariant)
```
Build the HELM Mobile offline recovery state. This must be a BEAUTIFUL, designed screen — never a
blank or an error dump (hard requirement from the spec).

Two levels:
1) Soft (transient): a glass connection bar slides down from the top, amber, "Reconnecting…", with
   an indeterminate aurora sweep animation. The underlying screen stays visible and usable where
   possible. Auto-retries with backoff.
2) Hard (sustained): full-screen recovery. Centered: a still status orb in --error (breathing
   stopped — visually signals "no heartbeat"), display-l "Laptop unreachable", body copy
   "We can't reach your laptop right now. It may be asleep or offline." A gradient "Try again"
   button (shows a spinner-ring while retrying) and a ghost "Pairing details" link.

Motion: bar slides in with spring.smooth + amber sweep loop. On reconnect: bar collapses, orb
resumes breathing in emerald, Success haptic, return to prior screen. Retry button: press scale +
aurora ring while attempting.
States: reconnecting (soft) · unreachable (hard) · recovering · restored.
Accept: never blank; the difference between "trying" and "failed" is unmistakable; recovery feels
like relief.
```

---

## 10. Design System Preamble (prepend to EVERY screen prompt)

```
You are designing a screen for HELM Mobile — a premium React Native / Expo app that is a remote
control for AI coding agents running on the user's laptop. The phone is a control surface, NOT a
terminal, code editor, or remote desktop. Match this design system exactly.

AESTHETIC: modern-startup / Framer-grade, dark-first. Calm near-black graphite canvas, vivid
aurora-gradient energy used sparingly, glass surfaces that float over scrolling content
(Liquid-Glass style), physics-based motion. Reference taste: Linear, Cash App, Family, Arc, Cal AI.

COLOR (dark): bg --bg-base #07080B, raised #0E1016, overlay #14161F, glass rgba(20,22,31,.55)+blur24.
Text hi #F4F6FB / mid #A7AEBF / lo #6B7080 / mono #C8D0E0.
Semantic state (keep meanings): connected emerald #22E0A1 · agent/primary cobalt #4F7BFF ·
reconnecting amber #FFB020 · error crimson #FF4D62 · idle slate #8A90A2.
Brand gradient --grad-helm = 135deg #4F7BFF→#22E0A1. ONE hero gradient per screen, max. No gradient
body text. No full-opacity gradient card fills.

TYPE: Outfit (display/headers) + Inter (body/labels). JetBrains Mono ONLY for paths, commands,
tokens, console output. Tabular numbers for counters.

SPACE/SHAPE: 4pt scale (4·8·12·16·20·24·32·40·56·72), gutter 20. Radius sm10/md16/lg24/xl32/full.
Dark elevation = colored GLOW on active elements, not heavy drop shadows.

MOTION (mandatory, use these tokens — react-native-reanimated v4 + Moti + gesture-handler +
expo-haptics): position/scale → spring; opacity/color → timing.
spring.snappy{d18,s220,m.9} taps/toggles · spring.smooth{d20,s140,m1} cards/sheets/screens ·
spring.bouncy{d12,s180,m1} celebrations · spring.gentle{d26,s90,m1} ambient loops.
timing.micro 180ms · timing.page 360ms · ease [0.22,1,0.36,1].
Every tap: feedback <100ms (motion + haptic). Animate on the UI thread (Reanimated worklets) —
never setState in scroll/gesture handlers. Staggered list entrances (index*45ms). Sticky glass
headers that condense on scroll. Loading = Moti Skeleton or aurora ring, NEVER a grey spinner.
Signature motions: breathing status orb, gradient progress RING for active/long work (never a
plain spinner), running-console gradient shimmer, completion burst, digit-roll numbers.
Onboarding/pairing rhythm (from real top apps): thin top progress bar + large select rows +
persistent bottom CTA that activates only after a choice.

HAPTICS (expo-haptics): tap=selection · success/pair/complete=Success · error/offline/cancel=Error ·
agent-select/Run=Medium impact.

HARD RULES: never a blank/error-dump state (offline = designed recovery screen with retry); never
terminal/hacker styling; 44pt min touch targets; respect safe areas; obey the Do/Don't list.
Output production-quality RN code with the components themed to these tokens.
```

---

## 11. Acceptance checklist (run before calling any screen "done")

- [ ] Uses the token values from §3–§5 verbatim (no arbitrary colors, radii, or durations).
- [ ] Exactly one hero gradient; no gradient body text; no full-fill gradient cards.
- [ ] Every interactive element responds <100 ms with motion **and** a haptic.
- [ ] All position/scale motion uses a named spring; all fades use `timing.micro`.
- [ ] Animations run on the UI thread; scrolling stays smooth under streaming/gesture load.
- [ ] Loading = skeleton/aurora ring; offline = designed recovery; empty = designed state. No blanks, no grey spinners.
- [ ] Monospace appears **only** on paths/commands/console; nowhere else.
- [ ] Connection status pill (breathing orb) is present and correctly colored for the lifecycle.
- [ ] Touch targets ≥ 44pt; safe areas respected; `--text-lo` never used for important content.
- [ ] The screen makes the user *feel* the right emotional beat (trust / command / aliveness).

---

*Sources informing this guide: Mobbin, Page Flows, Refero, screensdesign.com, 60fps.design,
animatereactnative.com, Moti & Reanimated docs, 21st.dev, Apple HIG (Liquid Glass), Savee, Cosmos,
Dribbble — plus 2026 mobile UI trend research (bold gradients, glassmorphism, spring-physics
micro-interactions). Reconciled with HELM's `product.md`, `helm_design_brief.md`, and `CLAUDE.md`.*
