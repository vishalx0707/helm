# antigravity.md — Design Law for the HELM site

This file is **binding instructions** for any agent (Antigravity, or anyone) touching
the HELM landing site in `helm-landing/`. It exists for one reason:

> **Keep the site distinctive and disciplined. Kill the slop.**

If a change violates a rule here, it is wrong — revert it. These rules **override** your
defaults and your taste. When the rules and the user conflict, **the user wins**; when the
user is silent, **these rules are the user.**

---

## 0. The one test for every change

Before you write a line, answer: **"Does this make the page clearer, faster, or more
distinctive?"** If it only makes it *bigger, busier, or more generic* — don't.

Three failure modes, ranked by how much they hurt:

1. **Broken** — content invisible, layout collapsed, console errors.
2. **Slop** — generic, template-looking, "an AI made this."
3. **Bloat** — more sections/words/effects that say nothing new.

Fix in that order. Never trade down.

---

## 1. The aesthetic (non-negotiable)

HELM is **dark, pure monochrome.** Black canvas, white as the *only* accent. No color.
The restraint **is** the brand — a terminal for your laptop, not a SaaS dashboard.

- **Canvas:** near-black. **Accent:** pure white, used sparingly (one primary button,
  the logo mark, the live dot). White is a spotlight — if everything is white, nothing is.
- **Type:** `Instrument Serif` for display/headlines (the characterful voice),
  `Inter` for body, **monospace** for labels, code, status, and numbers. That serif is
  what stops this from looking like every other dev-tool page — protect it.
- **Texture, not color:** depth comes from hairline borders, layered near-blacks,
  soft shadows, and one faint radial glow. Never from hue.
- **Live = breathing dot.** Connected/running is a white pulsing dot. Offline is a hollow
  ring. That's the only "status color" language. No red/green/yellow.

### Tokens — use these, invent nothing
Defined in `helm-landing/styles.css :root`. **Use the variable, never a raw hex.**

```
--bg #08090b   --surface #101217   --surface2 #181a20   --surface3 #20232a
--text #f0f0f0 --text2 #a0a0a6     --text3 #62636b       --text4 #35353a
--border rgba(255,255,255,.07)   --border2 rgba(255,255,255,.12)   --divider rgba(255,255,255,.1)
--white #fff   --black #07080a
--ease cubic-bezier(.16,1,.3,1)   --ease2 cubic-bezier(.33,1,.68,1)
```

If you need a value that isn't here, you're probably doing something the design doesn't want.
Add a token deliberately — don't sprinkle one-off hexes.

---

## 2. Hard rules (MUST / NEVER)

**MUST**
- **Content is visible without JS.** Reveal animations are gated behind `html.js` and have
  a failsafe. A JS failure must never blank the page. Respect `prefers-reduced-motion`.
- **Use design tokens** for every color, border, and easing.
- **Sections must read as distinct** — visible `--divider` edges and/or `--surface` bands.
  If you can't tell where one section ends, it's broken.
- **Vary the rhythm.** Section padding and layout must differ section-to-section.
- **Every interactive element has a hover + focus state.** Keyboard-navigable.
- **Verify in a browser before claiming done.** Screenshot it. No "should work."

**NEVER**
- **No color.** No purple/blue gradients, no colored accents, no gradient-on-white — ever.
  (This is the #1 AI-slop tell. It is banned outright.)
- **No generic display type.** Inter/Roboto/Arial/system-ui as a *headline* font is forbidden.
  Headlines are `Instrument Serif`.
- **No text-clip gradient that fades headings into mud.** If you clip a gradient onto text,
  the floor stays light (`>= #bdbdc4`) and there's a solid-color fallback. No washed-out,
  disabled-looking headings.
- **No identical, repeated centered stacks.** Don't ship five sections that are all
  eyebrow → centered serif title → centered paragraph. Break at least one with asymmetry,
  overlap, a sticky column, or full-bleed.
- **No uniform section padding** copy-pasted across the page.
- **No emoji, no stock icons-as-decoration, no "✨/🚀" energy.** Monospace marks and
  hairline SVG only.
- **No new dependency, framework, or build step.** This is hand-written HTML/CSS/JS. Keep it.

---

## 3. Anti-slop checklist (the lessons that earned these rules)

These are the exact mistakes that made the site look bad. Don't reintroduce them.

- [ ] **Nothing relies on JS to be seen.** Load with JS off — is the page complete? It must be.
- [ ] **Section bands are perceptible** — not three near-identical blacks.
- [ ] **Headlines are crisp**, not faded grey. Gradient floor is light.
- [ ] **Vertical space is tight and varied**, not the same 160px drone everywhere.
- [ ] **At least one section breaks the centered-stack pattern.**
- [ ] **One primary white button per view.** Secondary actions are ghost/outline.
- [ ] **Copy is for a first-time visitor.** No internal jargon in the UI
      (e.g. never surface "Connected to localhost" to a stranger).
- [ ] **Every word earns its place.** Cut a sentence before adding one.
- [ ] **Motion is one orchestrated load + subtle scroll reveals.** Not scattered twitch.
- [ ] **It looks intentional, not generated.** If it could be any startup's page, redo it.

---

## 4. Copy & voice

- Plain, confident, a little defiant. Short lines. "Your machine. Not theirs."
- State the product's actual claim; don't pad with marketing air.
- Headlines can be a question or a flat assertion — never a buzzword stack.
- Lowercase monospace for eyebrows/labels; the serif carries the emotion.

---

## 5. Scope discipline

The landing page sells one idea: **direct an AI coding agent on your laptop, from your phone.**
Every section serves `Project → Agent → Task → Progress → Result`. If a section, animation,
or feature doesn't serve that, it doesn't belong on the page. New ideas go in a backlog note,
not into the hero.

---

## 6. Before you say "done"

1. Open it in a browser at desktop **and** mobile width.
2. Screenshot each section. Look at it. Is anything invisible, misaligned, or generic?
3. Load once with JS disabled — page still complete?
4. Check the console — **zero errors.**
5. Re-read this file. Did you break a NEVER? If yes, revert.

Evidence before assertions. If you didn't see it render, it isn't done.
