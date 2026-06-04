# HELM Remote Pairing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make HELM reachable from anywhere by hosting the relay in the cloud, and replace the relay-URL + long-token pairing with a short-lived 6-digit code (+ QR) that the relay swaps for the laptop's durable key.

**Architecture:** The relay moves to a permanent public `wss://` address that both apps treat as a built-in constant (user never sees a URL). The relay keeps its existing dumb host/client token pairing and gains one small in-memory layer: `pair_new` mints a 6-digit code mapped to the host's durable token; `pair_redeem` swaps a valid code for that token (one-time, TTL-bounded, rate-limited). The phone redeems the code, stores the durable token, and pairs normally — so pairing is short to do but permanent once done.

**Tech Stack:** Node + `ws` (relay), Electron (desktop), Expo / React Native (mobile). Relay logic tested with the built-in `node:test` runner; desktop verified with `node --check`; mobile verified with `npx expo export`.

**Reference spec:** `docs/superpowers/specs/2026-06-04-helm-remote-pairing-design.md`

---

## File Structure

**Relay (`helm-relay/`)**
- Create `pairing.js` — pure in-memory 6-digit code store (mint / redeem / TTL / throttle). No `ws` dependency, so it's unit-testable in isolation.
- Create `test/pairing.test.js` — `node:test` coverage for the code store.
- Modify `protocol.js` — add the five `pair_*` message types to `T` and `RELAY_CONTROL`.
- Modify `server.js` — wire `pairing.js` into the message handler.
- Create `render.yaml` + `Dockerfile` + `DEPLOY.md` — deploy glue.

**Desktop (`helm-desktop/src/main/`)**
- Modify `settings.js` — default `relayUrl` becomes the cloud constant.
- Modify `relay-client.js` — request a pairing code (`pair_new`), expose the result.
- Modify `pairing.js` — QR encodes `{ v: 2, code }`; `info()` returns the code + ttl; `regenerate()` becomes "request a new code" (does NOT rotate the durable key).
- Modify `main.js` — `pairing:regenerate` now asks the relay client for a fresh code instead of minting a token.
- Modify `src/renderer/renderer.js` + `src/renderer/index.html` — show the 6-digit code + QR + countdown.

**Mobile (`helm-mobile/src/`)**
- Create `config.js` — the built-in relay URL constant.
- Modify `protocol.js` — mirror the new message types; accept `{ v: 2, code }` + bare 6-digit strings in `parsePairingPayload`.
- Create `lib/pairing.js` — `redeemCode(relay, code)` → opens a throwaway socket, redeems, resolves `{ relay, token }`.
- Modify `screens/ScanScreen.js` — scan/enter a 6-digit code, redeem it, then pair.

---

## PHASE 1 — Relay: the 6-digit code layer

### Task 1: Pairing code store (pure module + tests)

**Files:**
- Create: `helm-relay/pairing.js`
- Test: `helm-relay/test/pairing.test.js`

- [ ] **Step 1: Write the failing test**

Create `helm-relay/test/pairing.test.js`:

```js
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const { createPairingCodes } = require('../pairing');

test('mint returns a 6-digit string code and a ttl in seconds', () => {
  const codes = createPairingCodes({ ttlMs: 600000 });
  const { code, ttl } = codes.mint('tok-123');
  assert.match(code, /^\d{6}$/);
  assert.strictEqual(ttl, 600);
});

test('redeem returns the token for a valid code', () => {
  const codes = createPairingCodes();
  const { code } = codes.mint('tok-abc');
  assert.deepStrictEqual(codes.redeem(code), { token: 'tok-abc' });
});

test('a code is one-time: second redeem fails', () => {
  const codes = createPairingCodes();
  const { code } = codes.mint('tok-abc');
  codes.redeem(code);
  assert.ok(codes.redeem(code).error);
});

test('an expired code fails', () => {
  let t = 1000;
  const codes = createPairingCodes({ now: () => t, ttlMs: 5000 });
  const { code } = codes.mint('tok-abc');
  t = 1000 + 5001; // jump past TTL
  assert.ok(codes.redeem(code).error);
});

test('redeem is throttled after too many attempts', () => {
  const codes = createPairingCodes({ maxAttempts: 3 });
  assert.ok(codes.redeem('000000').error); // 1 (miss)
  assert.ok(codes.redeem('000000').error); // 2
  assert.ok(codes.redeem('000000').error); // 3
  const r = codes.redeem('000000');         // 4 -> throttled
  assert.match(r.error, /too many/i);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd helm-relay; node --test test/pairing.test.js`
Expected: FAIL — `Cannot find module '../pairing'`.

- [ ] **Step 3: Write the implementation**

Create `helm-relay/pairing.js`:

```js
'use strict';

/**
 * Pairing codes — the one small piece of state the otherwise-dumb relay keeps.
 *
 * A 6-digit code can't carry a 128-bit key, so the relay resolves a short-lived,
 * one-time code to the laptop's durable session token. Codes live only in memory:
 * nothing is persisted, and they vanish on restart. Short TTL + one-time use +
 * a redeem rate-limit make the 1,000,000-code space infeasible to walk.
 */

const TTL_MS = 10 * 60 * 1000;        // a code is valid for 10 minutes
const MAX_ATTEMPTS = 50;              // redeem attempts allowed per window
const ATTEMPT_WINDOW_MS = 60 * 1000;  // sliding window for the attempt cap

function createPairingCodes({
  now = Date.now,
  ttlMs = TTL_MS,
  maxAttempts = MAX_ATTEMPTS,
  attemptWindowMs = ATTEMPT_WINDOW_MS,
} = {}) {
  const codes = new Map(); // code -> { token, expiresAt }
  let attempts = [];       // recent redeem timestamps (for throttling)

  function sweep(t) {
    for (const [code, rec] of codes) if (rec.expiresAt <= t) codes.delete(code);
  }

  function gen6() {
    return String(Math.floor(Math.random() * 1000000)).padStart(6, '0');
  }

  function mint(token) {
    const t = now();
    sweep(t);
    let code = gen6();
    while (codes.has(code)) code = gen6();
    codes.set(code, { token, expiresAt: t + ttlMs });
    return { code, ttl: Math.round(ttlMs / 1000) };
  }

  function throttled(t) {
    attempts = attempts.filter((ts) => t - ts < attemptWindowMs);
    if (attempts.length >= maxAttempts) return true;
    attempts.push(t);
    return false;
  }

  function redeem(code) {
    const t = now();
    if (throttled(t)) return { error: 'too many attempts, try again shortly' };
    sweep(t);
    const rec = codes.get(code);
    if (!rec) return { error: 'invalid or expired code' };
    codes.delete(code); // one-time use
    return { token: rec.token };
  }

  return { mint, redeem, size: () => codes.size };
}

module.exports = { createPairingCodes, TTL_MS };
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd helm-relay; node --test test/pairing.test.js`
Expected: PASS — 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add helm-relay/pairing.js helm-relay/test/pairing.test.js
git commit -m "feat(relay): add in-memory 6-digit pairing code store"
```

---

### Task 2: Add the pair_* message types to the protocol

**Files:**
- Modify: `helm-relay/protocol.js`

- [ ] **Step 1: Add the message types**

In `helm-relay/protocol.js`, inside the `T` object, after the `PONG: 'pong',` line and before the `// --- forwarded payload` comment, add:

```js
  // --- pairing handshake (relay-understood) ---
  PAIR_NEW:     'pair_new',     // host   -> relay  {}          mint a code
  PAIR_CODE:    'pair_code',    // relay  -> host   { code, ttl }
  PAIR_REDEEM:  'pair_redeem',  // client -> relay  { code }     redeem a code
  PAIR_OK:      'pair_ok',      // relay  -> client { token }
  PAIR_ERROR:   'pair_error',   // relay  -> client { message }
```

- [ ] **Step 2: Add them to RELAY_CONTROL**

In the same file, change the `RELAY_CONTROL` set to include the new types so they're never forwarded to a peer:

```js
const RELAY_CONTROL = new Set([
  T.HOST_HELLO, T.CLIENT_HELLO, T.PING, T.PONG,
  T.PEER_ONLINE, T.PEER_OFFLINE, T.RELAY_ERROR,
  T.PAIR_NEW, T.PAIR_CODE, T.PAIR_REDEEM, T.PAIR_OK, T.PAIR_ERROR
]);
```

- [ ] **Step 3: Verify syntax**

Run: `cd helm-relay; node -e "require('./protocol'); console.log('ok')"`
Expected: prints `ok`.

- [ ] **Step 4: Commit**

```bash
git add helm-relay/protocol.js
git commit -m "feat(relay): add pair_* message types to protocol"
```

---

### Task 3: Wire pairing into the relay server

**Files:**
- Modify: `helm-relay/server.js`

- [ ] **Step 1: Require the pairing store**

In `helm-relay/server.js`, after the line `const { RELAY_PORT, T, RELAY_CONTROL } = require('./protocol');` add:

```js
const { createPairingCodes } = require('./pairing');
```

- [ ] **Step 2: Create the store instance**

After the `const sessions = new Map();` line (and its comment), add:

```js
// Short-lived 6-digit pairing codes -> durable host token (in memory only).
const pairCodes = createPairingCodes();
```

- [ ] **Step 3: Handle pair_new and pair_redeem**

In the `ws.on('message', …)` handler, immediately AFTER the registration `if` block (the one handling `HOST_HELLO`/`CLIENT_HELLO`, which ends with `return;`) and BEFORE the `if (msg.type === T.PING)` line, insert:

```js
    // --- pairing handshake ---
    // A registered HOST asks for a fresh code to display.
    if (msg.type === T.PAIR_NEW) {
      if (ws.role !== 'host' || !ws.token) {
        send(ws, T.RELAY_ERROR, { message: 'pair_new requires a registered host' });
        return;
      }
      const { code, ttl } = pairCodes.mint(ws.token);
      send(ws, T.PAIR_CODE, { code, ttl });
      return;
    }
    // A not-yet-paired CLIENT redeems a code for the host's durable token.
    if (msg.type === T.PAIR_REDEEM) {
      const code = typeof msg.code === 'string' ? msg.code.trim() : '';
      const r = pairCodes.redeem(code);
      if (r.error) send(ws, T.PAIR_ERROR, { message: r.error });
      else send(ws, T.PAIR_OK, { token: r.token });
      return;
    }
```

- [ ] **Step 4: Verify syntax**

Run: `cd helm-relay; node -e "require('./server')" ` then press Ctrl+C after it prints the listening lines.
Expected: prints `[helm-relay] listening on …` with no syntax error.

- [ ] **Step 5: Manual smoke test of the handshake**

Start the relay: `cd helm-relay; npm start` (leave running in one terminal).
In a second terminal run this one-off client that registers a host, mints a code, then redeems it as a client:

```bash
node -e "const WS=require('helm-relay/node_modules/ws');const a=new WS('ws://localhost:8787');a.on('open',()=>a.send(JSON.stringify({type:'host_hello',token:'durable-xyz'})));a.on('message',m=>{const o=JSON.parse(m);if(o.type==='peer_offline')a.send(JSON.stringify({type:'pair_new'}));if(o.type==='pair_code'){console.log('CODE',o.code);const b=new WS('ws://localhost:8787');b.on('open',()=>b.send(JSON.stringify({type:'pair_redeem',code:o.code})));b.on('message',mm=>{console.log('REDEEM->',mm.toString());process.exit(0);});}});"
```

Expected: prints `CODE ######` then `REDEEM-> {"type":"pair_ok","token":"durable-xyz"}`. Stop the relay with Ctrl+C afterwards.

- [ ] **Step 6: Commit**

```bash
git add helm-relay/server.js
git commit -m "feat(relay): mint and redeem 6-digit pairing codes"
```

---

### Task 4: Deploy glue for the hosted relay

**Files:**
- Create: `helm-relay/render.yaml`
- Create: `helm-relay/Dockerfile`
- Create: `helm-relay/DEPLOY.md`

- [ ] **Step 1: Add render.yaml**

Create `helm-relay/render.yaml`:

```yaml
# One-click-ish deploy of the dumb relay to Render (free web service).
# Render injects $PORT; server.js already honors it and serves /health.
services:
  - type: web
    name: helm-relay
    runtime: node
    rootDir: helm-relay
    plan: free
    buildCommand: npm install
    startCommand: npm start
    healthCheckPath: /health
```

- [ ] **Step 2: Add a Dockerfile (for Fly.io / any container host)**

Create `helm-relay/Dockerfile`:

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY . .
EXPOSE 8787
CMD ["npm", "start"]
```

- [ ] **Step 3: Add DEPLOY.md**

Create `helm-relay/DEPLOY.md`:

```markdown
# Deploying the HELM relay

The relay is stateless and dumb — host it once and both the laptop and phone dial
out to it. It stores no code, secrets, or task content; pairing codes live only in
memory and vanish on restart.

## Render (recommended, free)
1. Push this repo to GitHub.
2. Render → New → Blueprint → point at the repo. It reads `helm-relay/render.yaml`.
3. Deploy. You get a URL like `https://helm-relay-xxxx.onrender.com`.
4. The relay's public WebSocket address is the same host with `wss://`:
   `wss://helm-relay-xxxx.onrender.com`. Use that everywhere a relay URL is needed.
5. Health check: open `https://helm-relay-xxxx.onrender.com/health` → `{"ok":true,...}`.

Note: the free tier sleeps when idle, but the desktop's 25s keep-alive ping keeps it
warm whenever the laptop app is running — which is the only time you can operate it.

## Fly.io (always-on alternative)
`cd helm-relay; fly launch --dockerfile Dockerfile` then `fly deploy`. Use the
resulting `wss://<app>.fly.dev` address.

## After deploying
Set the `wss://…` address as the built-in relay URL in BOTH apps:
- Desktop: `helm-desktop/src/main/settings.js` → `relayUrl` default.
- Mobile:  `helm-mobile/src/config.js` → `RELAY_URL`.
```

- [ ] **Step 4: Commit**

```bash
git add helm-relay/render.yaml helm-relay/Dockerfile helm-relay/DEPLOY.md
git commit -m "chore(relay): add Render/Fly deploy glue + deploy guide"
```

- [ ] **Step 5: Deploy (manual, one-time)**

Follow `helm-relay/DEPLOY.md` to deploy and obtain the `wss://…` URL. Record it — it's used as `RELAY_URL` in Tasks 5 and 9. Verify `/health` returns `{"ok":true}` before continuing.

---

## PHASE 2 — Desktop: show the 6-digit code + QR

### Task 5: Point the desktop at the cloud relay

**Files:**
- Modify: `helm-desktop/src/main/settings.js`

- [ ] **Step 1: Set the default relay URL to the deployed relay**

In `helm-desktop/src/main/settings.js`, in the `DEFAULTS` object, change the `relayUrl` default from `'ws://localhost:8787'` to the deployed address from Task 4 (example shown — substitute your real host):

```js
  relayUrl: 'wss://helm-relay-xxxx.onrender.com',
```

Leave `publicRelayUrl: null` (it falls back to `relayUrl`). Existing installs that already saved a `relayUrl` keep theirs; they can change it in Settings.

- [ ] **Step 2: Verify syntax**

Run: `cd helm-desktop; node --check src/main/settings.js`
Expected: no output (success).

- [ ] **Step 3: Commit**

```bash
git add helm-desktop/src/main/settings.js
git commit -m "feat(desktop): default to the hosted cloud relay"
```

---

### Task 6: Desktop relay client requests a pairing code

**Files:**
- Modify: `helm-desktop/src/main/relay-client.js`

- [ ] **Step 1: Track the latest code and add a requester**

In `helm-desktop/src/main/relay-client.js`, after the `let taskCb = null;` line, add:

```js
let pairCb = null;          // notified when a fresh pair_code arrives
let lastPairCode = null;    // { code, ttl } most recently minted
```

- [ ] **Step 2: Add the pair_code handler**

In the `handle(m)` switch, add a case (e.g. after the `case 'peer_offline':` block):

```js
    case 'pair_code':
      lastPairCode = { code: m.code, ttl: m.ttl };
      if (pairCb) try { pairCb(lastPairCode); } catch {}
      break;
```

- [ ] **Step 3: Add public functions to request a code and subscribe**

Before `module.exports`, add:

```js
function onPairCode(cb) { pairCb = cb; }

/** Ask the relay to mint a fresh 6-digit code for this host. */
function requestPairCode() {
  send('pair_new');
}

function getLastPairCode() { return lastPairCode; }
```

- [ ] **Step 4: Auto-request a code once paired-capable**

In the `ws.on('open', …)` handler, after `send('host_hello', { token: pairing.token() });`, add:

```js
    // Ask for a pairing code so the panel always has a fresh one to show.
    send('pair_new');
```

- [ ] **Step 5: Export the new functions**

Change the `module.exports` line to:

```js
module.exports = { start, stop, restart, getStatus, onStatus, onTask, onPairCode, requestPairCode, getLastPairCode };
```

- [ ] **Step 6: Verify syntax**

Run: `cd helm-desktop; node --check src/main/relay-client.js`
Expected: no output (success).

- [ ] **Step 7: Commit**

```bash
git add helm-desktop/src/main/relay-client.js
git commit -m "feat(desktop): request and track 6-digit pairing codes from relay"
```

---

### Task 7: QR + pairing info carry the code, not the token

**Files:**
- Modify: `helm-desktop/src/main/pairing.js`
- Modify: `helm-desktop/src/main/main.js`

- [ ] **Step 1: Make the QR encode the code and info() return it**

In `helm-desktop/src/main/pairing.js`, replace the `qrDataUrl`, `info`, `regenerate`, and `payload` functions so the QR/payload carry a 6-digit code supplied by the relay client. Replace the existing `regenerate`, `payload`, `qrDataUrl`, and `info` functions with:

```js
/**
 * Request a fresh 6-digit pairing code from the relay (via the relay client) and
 * leave the durable key untouched, so generating a code to add a new phone never
 * knocks an already-paired phone offline.
 */
function regenerate() {
  // relay-client owns the socket; main.js calls relayClient.requestPairCode().
  // This stays here only for API symmetry — callers should prefer the relay client.
  return null;
}

/** What the QR encodes: just the short code (the relay URL is built into the app). */
function payload(code) {
  return { v: 2, code: code || '' };
}

async function qrDataUrl(code) {
  const data = JSON.stringify(payload(code));
  return QRCode.toDataURL(data, { margin: 1, width: 240 });
}

/** Everything the pairing panel needs to render, given the latest minted code. */
async function info(code, ttl) {
  return {
    code: code || null,
    ttl: ttl || null,
    relayUrl: relayUrl(),
    publicRelayUrl: publicRelayUrl(),
    qr: code ? await qrDataUrl(code) : null
  };
}
```

- [ ] **Step 2: Update the exports**

Change the `module.exports` line in `helm-desktop/src/main/pairing.js` to:

```js
module.exports = { token, regenerate, relayUrl, publicRelayUrl, payload, qrDataUrl, info };
```

(`token` stays exported — it's still the durable key sent in `host_hello`.)

- [ ] **Step 3: Update main.js IPC to feed the code through**

In `helm-desktop/src/main/main.js`, replace the two pairing IPC handlers (`pairing:get` and `pairing:regenerate`) with:

```js
ipcMain.handle('pairing:get', async () => {
  const c = relayClient.getLastPairCode();
  return pairing.info(c && c.code, c && c.ttl);
});
ipcMain.handle('pairing:regenerate', async () => {
  // Ask the relay for a brand-new code; the durable key is unchanged so any
  // already-paired phone stays connected. The pair_code push updates the panel.
  try { relayClient.requestPairCode(); } catch (e) { console.error(e); }
  // Give the relay a moment to round-trip, then return whatever code we have.
  await new Promise((r) => setTimeout(r, 400));
  const c = relayClient.getLastPairCode();
  return pairing.info(c && c.code, c && c.ttl);
});
```

- [ ] **Step 4: Push fresh codes to the renderer**

In `helm-desktop/src/main/main.js`, inside the `app.whenReady().then(async () => { … })` block, right after the line `relayClient.onTask((ev) => { … });`, add:

```js
    // Push freshly-minted pairing codes to the Pairing panel.
    relayClient.onPairCode((p) => { if (win && !win.isDestroyed()) win.webContents.send('pairing:code', p); });
```

- [ ] **Step 5: Verify syntax**

Run: `cd helm-desktop; node --check src/main/pairing.js; node --check src/main/main.js`
Expected: no output (success) for both.

- [ ] **Step 6: Commit**

```bash
git add helm-desktop/src/main/pairing.js helm-desktop/src/main/main.js
git commit -m "feat(desktop): QR + pairing info carry the 6-digit code"
```

---

### Task 8: Renderer shows the 6-digit code + QR

**Files:**
- Modify: `helm-desktop/src/preload/preload.js`
- Modify: `helm-desktop/src/renderer/index.html`
- Modify: `helm-desktop/src/renderer/renderer.js`

- [ ] **Step 1: Expose the code-push subscription in preload**

In `helm-desktop/src/preload/preload.js`, after the `regeneratePairing:` line, add:

```js
  onPairingCode: (cb) => {
    const handler = (_e, p) => cb(p);
    ipcRenderer.on('pairing:code', handler);
    return () => ipcRenderer.removeListener('pairing:code', handler);
  },
```

- [ ] **Step 2: Add a code display element to the pairing panel**

In `helm-desktop/src/renderer/index.html`, locate the `.qr-cap` block (it contains `id="pair-token"` and the `id="btn-refresh-qr"` button). Directly above the `id="btn-refresh-qr"` button, add a large code line:

```html
        <div class="pair-code" id="pair-code">——————</div>
```

Keep the existing `id="qr-img"` element. The button label below stays for refreshing.

- [ ] **Step 3: Render the code on load and on push**

In `helm-desktop/src/renderer/renderer.js`, find `loadPairing()` (it calls `tw.getPairing()` and sets `qr-img` / `pair-token`). Replace its body that assigns those fields so it renders the new `code` shape. Specifically, after the existing `const pp = await tw.getPairing();` line, set:

```js
    if (pp.qr) el('qr-img').src = pp.qr;
    el('pair-code').textContent = pp.code || '——————';
```

(If the old `loadPairing` references `pp.token` / `pair-token` / `pair-relay` / `kv-relay` / `kv-session`, leave those lines only if those elements still exist; otherwise remove the lines that set now-deleted elements. The code line is the primary display.)

- [ ] **Step 4: Subscribe to pushed codes**

In `helm-desktop/src/renderer/renderer.js`, near where other `tw.on…` subscriptions are set up (e.g. after `tw.onRelay(...)`), add:

```js
  tw.onPairingCode((p) => {
    if (!p) return;
    el('pair-code').textContent = p.code || '——————';
    // Re-fetch the QR for the new code.
    tw.getPairing().then((pp) => { if (pp.qr) el('qr-img').src = pp.qr; });
  });
```

- [ ] **Step 5: Update the refresh button handler**

In `helm-desktop/src/renderer/renderer.js`, find the existing `el('btn-refresh-qr').addEventListener('click', …)` handler. Inside it, where it currently sets `el('pair-token')` / `el('kv-session')`, replace those with:

```js
      el('pair-code').textContent = pp.code || '——————';
```

(Keep the rest of the handler — disabling the button, the `tw.regeneratePairing()` call, restoring the label.)

- [ ] **Step 6: Add minimal styling for the code**

In `helm-desktop/src/renderer/styles.css`, add:

```css
.pair-code {
  font-family: var(--mono, monospace);
  font-size: 30px;
  letter-spacing: 8px;
  text-align: center;
  color: var(--fill, #fff);
  margin: 10px 0 6px;
}
```

- [ ] **Step 7: Verify and manually check**

Run: `cd helm-desktop; node --check src/preload/preload.js; node --check src/renderer/renderer.js`
Expected: no output (success).
Then with the deployed relay reachable: `pnpm start`, open the Pairing panel, confirm a 6-digit code + QR appear and "Generate new code" swaps in a different code.

- [ ] **Step 8: Commit**

```bash
git add helm-desktop/src/preload/preload.js helm-desktop/src/renderer/index.html helm-desktop/src/renderer/renderer.js helm-desktop/src/renderer/styles.css
git commit -m "feat(desktop): pairing panel shows 6-digit code + QR"
```

---

## PHASE 3 — Mobile: redeem the code (requires APK rebuild)

### Task 9: Built-in relay URL constant

**Files:**
- Create: `helm-mobile/src/config.js`

- [ ] **Step 1: Create the config**

Create `helm-mobile/src/config.js` (substitute the real deployed host from Task 4):

```js
/**
 * Built-in relay address. The relay lives at one fixed public URL, so the phone
 * never has to be told where it is — the user only hands over a 6-digit code.
 * Override is intentionally not exposed in the UI; change it here for a new host.
 */
export const RELAY_URL = 'wss://helm-relay-xxxx.onrender.com';
```

- [ ] **Step 2: Commit**

```bash
git add helm-mobile/src/config.js
git commit -m "feat(mobile): add built-in relay URL constant"
```

---

### Task 10: Mirror the new protocol + accept codes

**Files:**
- Modify: `helm-mobile/src/protocol.js`

- [ ] **Step 1: Add the pair_* types**

In `helm-mobile/src/protocol.js`, inside the `T` object after `PONG: 'pong',`, add:

```js
  PAIR_NEW: 'pair_new',
  PAIR_CODE: 'pair_code',
  PAIR_REDEEM: 'pair_redeem',
  PAIR_OK: 'pair_ok',
  PAIR_ERROR: 'pair_error',
```

- [ ] **Step 2: Accept a 6-digit code in parsePairingPayload**

In `helm-mobile/src/protocol.js`, replace the `parsePairingPayload` function with one that accepts the new `{ v: 2, code }` QR, a bare 6-digit string (manual entry), and still tolerates the legacy `{ relay, token }` form:

```js
export function parsePairingPayload(raw) {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();

  // Manual entry or a QR that is just the digits.
  if (/^\d{6}$/.test(trimmed)) return { code: trimmed };

  let obj;
  try {
    obj = JSON.parse(trimmed);
  } catch {
    return null;
  }
  // New form: { v: 2, code }
  if (obj && typeof obj.code === 'string' && /^\d{6}$/.test(obj.code)) {
    return { code: obj.code };
  }
  // Legacy form: { relay, token } — kept so older QRs still pair directly.
  if (obj && typeof obj.relay === 'string' && obj.relay && typeof obj.token === 'string' && obj.token) {
    return { relay: obj.relay, token: obj.token };
  }
  return null;
}
```

- [ ] **Step 3: Verify the bundle still builds**

Run: `cd helm-mobile; npx expo export`
Expected: a clean export with no bundling errors (this is the project's build check).

- [ ] **Step 4: Commit**

```bash
git add helm-mobile/src/protocol.js
git commit -m "feat(mobile): mirror pair_* types; accept 6-digit codes"
```

---

### Task 11: Redeem a code into a durable pairing

**Files:**
- Create: `helm-mobile/src/lib/pairing.js`

- [ ] **Step 1: Implement redeemCode**

Create `helm-mobile/src/lib/pairing.js`:

```js
import { T } from '../protocol';

/**
 * Redeem a 6-digit pairing code for the laptop's durable token. Opens a
 * throwaway socket to the built-in relay, sends pair_redeem, and resolves with
 * the pairing to persist. The long-lived RelayConnection then takes over.
 *
 * @param {string} relay  built-in relay wss:// URL
 * @param {string} code   6-digit code
 * @returns {Promise<{relay:string, token:string}>}
 */
export function redeemCode(relay, code) {
  return new Promise((resolve, reject) => {
    let settled = false;
    let ws;
    const done = (fn, arg) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { ws && ws.close(); } catch {}
      fn(arg);
    };
    const timer = setTimeout(
      () => done(reject, new Error('The relay did not respond. Check your connection and try again.')),
      12000
    );

    try {
      ws = new WebSocket(relay);
    } catch {
      done(reject, new Error("Couldn't reach the relay."));
      return;
    }

    ws.onopen = () => {
      try { ws.send(JSON.stringify({ type: T.PAIR_REDEEM, code })); } catch {
        done(reject, new Error("Couldn't send the code."));
      }
    };
    ws.onmessage = (ev) => {
      let msg;
      try { msg = JSON.parse(ev.data); } catch { return; }
      if (msg.type === T.PAIR_OK && typeof msg.token === 'string') {
        done(resolve, { relay, token: msg.token });
      } else if (msg.type === T.PAIR_ERROR) {
        done(reject, new Error(msg.message || 'That code didn’t work.'));
      }
    };
    ws.onerror = () => done(reject, new Error("Couldn't reach the relay."));
    ws.onclose = () => done(reject, new Error('The connection closed before pairing finished.'));
  });
}
```

- [ ] **Step 2: Verify the bundle builds**

Run: `cd helm-mobile; npx expo export`
Expected: clean export, no errors.

- [ ] **Step 3: Commit**

```bash
git add helm-mobile/src/lib/pairing.js
git commit -m "feat(mobile): redeem a 6-digit code into a durable pairing"
```

---

### Task 12: ScanScreen pairs with a code

**Files:**
- Modify: `helm-mobile/src/screens/ScanScreen.js`

- [ ] **Step 1: Import the relay URL and redeemer**

In `helm-mobile/src/screens/ScanScreen.js`, add to the imports:

```js
import { RELAY_URL } from '../config';
import { redeemCode } from '../lib/pairing';
```

- [ ] **Step 2: Rework `pair` to handle both code and legacy direct pairing**

Replace the existing `pair` function with one that, given a parsed payload, redeems a code (or uses a legacy `{relay,token}` directly):

```js
  const pair = async (parsed) => {
    if (handledRef.current) return;
    handledRef.current = true;
    try {
      let pairing;
      if (parsed.code) {
        pairing = await redeemCode(RELAY_URL, parsed.code); // -> { relay, token }
      } else {
        pairing = { relay: parsed.relay, token: parsed.token }; // legacy QR
      }
      await savePairing(pairing);
      conn.reconfigure(pairing);
      navigation.reset({ index: 0, routes: [{ name: 'Dashboard' }] });
    } catch (e) {
      handledRef.current = false; // allow another attempt
      setError(e.message || "That code didn't work.");
    }
  };
```

- [ ] **Step 3: Update the manual path to take a 6-digit code**

Replace the `onManualPair` function with one that validates a 6-digit code instead of a relay URL + token:

```js
  const onManualPair = () => {
    const c = token.trim();
    if (!/^\d{6}$/.test(c)) {
      setError('Enter the 6-digit code shown on your laptop.');
      return;
    }
    pair({ code: c });
  };
```

- [ ] **Step 4: Simplify the manual input to a single code field**

In the `manual` JSX block, replace the two inputs (RELAY URL + PAIRING TOKEN) with a single code field:

```jsx
          {manual && (
            <View style={styles.manualBox}>
              <Text style={styles.fieldLabel}>6-DIGIT CODE</Text>
              <TextInput
                value={token}
                onChangeText={(v) => {
                  setToken(v.replace(/\D/g, '').slice(0, 6));
                  setError('');
                }}
                placeholder="123456"
                placeholderTextColor={colors.inkLo}
                keyboardType="number-pad"
                maxLength={6}
                style={styles.input}
              />
            </View>
          )}
```

The unused `relay`/`setRelay` state can be removed; leaving it is harmless but prefer removing the `const [relay, setRelay] = useState('');` line and its references.

- [ ] **Step 5: Verify the bundle builds**

Run: `cd helm-mobile; npx expo export`
Expected: clean export, no errors.

- [ ] **Step 6: Manual end-to-end test over cellular**

With the relay deployed and the desktop showing a code: turn the phone's Wi-Fi OFF (use cellular), open the app → Connect a device → scan the QR (and separately, test typing the 6 digits). Expected: pairs, lands on Dashboard, projects + agents appear, a submitted task streams output back.

- [ ] **Step 7: Commit**

```bash
git add helm-mobile/src/screens/ScanScreen.js
git commit -m "feat(mobile): pair with a 6-digit code (scan or type)"
```

---

## Self-Review Notes (coverage against the spec)

- §2 hosted relay + built-in URL → Tasks 4, 5, 9.
- §3 durable key vs. short code; "generate new code" no longer rotates the key → Tasks 1, 6, 7 (Step 3).
- §4 protocol additions (all three copies) → Tasks 2 (relay), 10 (mobile), 6/7 (desktop inline strings).
- §4 relay safety (one-time, TTL, rate-limit, no persistence) → Task 1.
- §5.1 relay logic + deploy glue → Tasks 3, 4.
- §5.2 desktop changes → Tasks 5–8.
- §5.3 mobile changes + APK rebuild note → Tasks 9–12.
- §6 pairing data flow → exercised by Task 3 Step 5 (relay) and Task 12 Step 6 (full).
- §7 testing (node:test / node --check / expo export) → present in each task.
- §8 non-negotiables untouched → no task modifies runner/power/projects execution paths.
```
