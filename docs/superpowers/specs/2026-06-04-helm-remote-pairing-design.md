# HELM Remote Pairing — Design Spec

**Date:** 2026-06-04
**Status:** Approved design → ready for implementation plan
**Scope:** Make HELM reachable from anywhere (cellular, other networks) and replace the
relay-URL + long-token pairing with a clean **6-digit code + QR**.

---

## 1. Goal

Today the phone can only reach the laptop when both are on the same network, because the
relay lives at `ws://localhost:8787` and the QR makes the user deal with a raw relay URL +
long token. We want:

> The user opens HELM Desktop, sees a **6-digit code** (and a QR of that same code). On the
> phone they tap **Connect a device**, scan the QR or type the 6 digits, and they're paired —
> from anywhere in the world. After that the existing flow already works: projects appear →
> pick a project → pick an agent → type/talk → the laptop runs the agent and streams back.

**The laptop is the cloud; the phone is the operator.** The hosted relay is only the meeting
point so the two can find each other across NAT. Nothing about agent execution, directory
isolation, or laptop-only secrets changes.

### Explicitly out of scope (separate, later specs)
- Voice control of the agent.
- Real Google/email account auth (the laptop pairing remains the trust step).
- Token rotation/expiry policy beyond what's described here, multi-device management UI.
- End-to-end payload encryption (TLS from the host already protects the wire).

---

## 2. Architecture

Three unchanged roles — HOST (laptop), CLIENT (phone), RELAY (dumb router). Two things move:

1. **The relay goes to the cloud** at one permanent `wss://` address. Both apps treat that
   address as a **built-in constant**, so the user never sees or types a relay URL again.
   (Still overridable via settings for local dev.)
2. **Pairing becomes a short-lived 6-digit code** that the relay swaps for the laptop's
   durable key. The QR is just the scannable form of the same code.

```
        ┌─────────── wss://helm-relay.<host>  (built-in constant) ───────────┐
        │                                                                     │
   HOST (laptop) ──host_hello{durableToken}──►  RELAY  ◄──client_hello{durableToken}── CLIENT (phone)
        │                                       (pairs the two by token,                │
        │                                        forwards everything else)              │
        └── pair_new ──► RELAY mints 6-digit code ──► phone redeems code ──► gets token ─┘
```

### Why a "free" host is enough
The desktop holds a persistent socket with a 25s keep-alive ping, so while the laptop app is
running the relay is kept warm — which is exactly when you'd want to reach it. When the laptop
app is closed there's nothing to operate anyway. So a free tier that sleeps on idle
(Render/Railway) is fine in practice; an always-on tier (Fly.io / ~$4 VPS) only removes a
one-time cold-start lag.

**Chosen host:** Render (dashboard deploy, free, no card). Fly.io is the documented alternative.

---

## 3. The durable key vs. the 6-digit code

Two secrets, two jobs — this is the heart of the design.

| | **Durable key** | **6-digit code** |
|---|---|---|
| What | The existing strong `sessionToken` (UUID) | A short, human-friendly pairing handle |
| Lifetime | Permanent (per laptop) | ~10 min, **one-time use** |
| Lives where | Laptop settings; phone secure-store after pairing | Only in relay memory, ephemeral |
| Job | Identifies the laptop's "room" on the relay (`host_hello`/`client_hello`) — **pair once, works forever** | Lets the phone *fetch* the durable key without typing it |

A 6-digit code can't *carry* a 128-bit key, so the relay resolves the code → key. That is the
one small piece of intelligence we add to the otherwise-dumb relay. Because the code is
short-lived, one-time, and rate-limited, it can't be brute-forced as a standing secret; because
the durable key is what the phone ends up storing, pairing is still "once and forever."

**Reconciliation with the existing "Generate new code" button:** it currently rotates the
durable token (killing already-paired phones). Under this design it instead requests a **new
6-digit code** and leaves the durable key untouched — so generating a code to add a new phone
never knocks your existing phone offline. (A separate "reset key / unpair all" is roadmap.)

---

## 4. Protocol additions

New relay-understood control messages (added to `T` and `RELAY_CONTROL` in all three copies of
the protocol — `helm-relay/protocol.js`, `helm-mobile/src/protocol.js`, desktop inline):

| Direction | Message | Payload | Meaning |
|---|---|---|---|
| host → relay | `pair_new` | `{}` | Mint a fresh pairing code for this host's token. |
| relay → host | `pair_code` | `{ code, ttl }` | The 6-digit code + seconds-to-live. |
| client → relay | `pair_redeem` | `{ code }` | Redeem a code for the laptop's durable token. |
| relay → client | `pair_ok` | `{ token }` | The durable token; phone stores it and pairs. |
| relay → client | `pair_error` | `{ message }` | Invalid / expired / throttled. |

The existing `host_hello` / `client_hello` (durable-token pairing) are **unchanged** — the new
messages sit on top. Forwarding rules unchanged: only the host/client durable token pairs a
session; the relay never inspects task payloads.

### Relay state & safety
- `pairCodes: Map<code, { token, expiresAt }>` in memory only.
- Code = 6 random digits; on collision, regenerate.
- **One-time:** delete the entry the moment it's redeemed.
- **TTL:** ~10 min; lazily expire on lookup + a periodic sweep.
- **Rate-limit redeem:** throttle `pair_redeem` (e.g. global + per-socket attempt cap) so the
  1,000,000-code space can't be walked. Wrong/expired code → `pair_error`, no information leak.
- Still **zero** persistence of code/credentials/task content — codes vanish on restart.

---

## 5. Component changes

### 5.1 Relay (`helm-relay/`)
- Add the `pair_new` / `pair_redeem` handling + the `pairCodes` map, TTL sweep, and redeem
  rate-limit.
- Add deploy glue: a `Dockerfile` (or `render.yaml`/`Procfile`) and a short deploy README.
  Code already honors `$PORT` and serves `/health`; no other server changes.

### 5.2 Desktop (`helm-desktop/src/main/`)
- **`settings.js`:** default `relayUrl` becomes the cloud `wss://…` constant (still editable).
  `publicRelayUrl` already falls back to it, so the QR auto-carries the right relay — but the
  QR no longer needs the URL at all (see below).
- **`relay-client.js`:** after registering as host, send `pair_new`; expose the returned
  `{ code, ttl }` to the renderer. Re-request on the "Generate new code" action.
- **`pairing.js`:** `qrDataUrl()` now encodes the **6-digit code** (payload `{ v: 2, code }`),
  not the `/sim?token=` URL. `payload()` / `info()` return the code + ttl instead of the raw
  token. `regenerate()` is repurposed to "request a new code" (does **not** rotate the durable
  key).
- **Renderer pairing panel:** show the big 6-digit code + the QR + a countdown/"Generate new
  code" button. Drop the raw relay-URL / token display from the primary view.

### 5.3 Mobile (`helm-mobile/`) — requires an APK rebuild
- Add a **built-in relay URL constant** (e.g. in `theme`/a new `config.js`).
- **`protocol.js`:** mirror the new message types; `parsePairingPayload` accepts the new
  `{ v: 2, code }` (and a bare 6-digit string from manual entry).
- **`ScanScreen.js`:** scan → extract the code; manual path becomes a single **6-digit field**
  instead of relay-URL + token.
- **`connection.js`:** new redeem step — connect to the built-in relay, send `pair_redeem`,
  await `pair_ok{token}`, `savePairing({ relay: BUILTIN, token })`, then proceed with the
  normal `client_hello` flow. `pair_error` → show the designed retry message (never blank).

> **Phasing note:** the *currently installed* APK predates the redeem flow, so the 6-digit
> code needs the rebuilt APK. To get remote working the same day without waiting on a rebuild,
> Phase 1 (host the relay + point the desktop at it) already lets the **existing** APK pair
> remotely via its current QR path — the 6-digit UX then lands with the Phase-2 rebuild.

---

## 6. Data flow (pairing, end to end)

1. Laptop app starts → dials the built-in cloud relay → `host_hello{durableToken}`.
2. Pairing panel opens → desktop sends `pair_new` → relay returns `pair_code{code, ttl}` →
   desktop shows the 6 digits + QR.
3. Phone: **Connect a device** → scan QR (or type 6 digits) → `pair_redeem{code}` to the
   built-in relay.
4. Relay validates (exists, not expired, within rate limit) → `pair_ok{token}`, deletes the
   code.
5. Phone stores `{ relay: BUILTIN, token }` in secure-store → `client_hello{token}` →
   relay pairs it with the laptop's room → `peer_online` both ways.
6. Phone auto-sends `list` → laptop replies `catalog` → **projects + agents appear.** From
   here the existing submit/stream flow is untouched.

---

## 7. Testing

- **Relay:** a small script (or extend `/sim`) to assert: code mints, redeems once, second
  redeem fails, expired code fails, throttle kicks in after N bad attempts. Manual `/health`
  + two-sim pairing.
- **Desktop:** `node --check` on changed files; manually verify the panel shows a code + QR,
  countdown works, "Generate new code" issues a new one without dropping a paired phone.
- **Mobile:** `npx expo export` (clean bundle = the build check); manual pair via QR and via
  typed 6-digit code, over **cellular** (phone off the laptop's Wi-Fi) to prove "brutally
  remote."

---

## 8. Non-negotiables preserved

- **Directory isolation, laptop-only secrets, keep-awake invariant, mobile-never-blanks** —
  all unchanged; this spec only touches discovery/pairing, not execution.
- Relay stays dumb about task content; it now knows one extra thing (a transient code→token
  map) and nothing else.
- The wire protocol stays duplicated-but-identical across all three parts; every new message
  type is added in all three.
