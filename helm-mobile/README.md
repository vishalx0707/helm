# HELM Mobile

The phone-side control surface for HELM — pair with your laptop, pick a project
and agent, send a task, and watch the agent's output stream back. The phone holds
**no code and no secrets**: the laptop (HELM Desktop) does all the work. This app
only carries the pairing token (in the secure keystore) and the streamed output.

> Flow: **Project → Agent → Task → Progress → Result**

## Stack
- Expo / React Native (SDK 53)
- `@react-navigation/native-stack` for the screen flow
- `expo-camera` for QR pairing, `expo-secure-store` for the pairing token
- `@expo/vector-icons` (Feather / AntDesign) for the line-icon set
- Plain JS, dark monochrome design (matches `../helm-mobile-prototype/index.html`)

## Run
```powershell
cd helm-mobile
pnpm install            # or: npx expo install   (to reconcile native versions)
npx expo start          # then scan with Expo Go, or press a / i for emulators
```

The relay and laptop must be running for a live flow:
```powershell
# terminal 1 — the dumb relay
cd ../helm-relay && npm start
# terminal 2 — the laptop host (shows the pairing QR)
cd ../helm-desktop && pnpm start
```

## Pairing
HELM Desktop shows a QR encoding `{ v, relay, token }`. The **Scan device** screen
reads it, stores it, and connects through the relay. On the same LAN without a
tunnel, use **Enter code manually** to type the relay URL (e.g. `ws://192.168.x.x:8787`)
and the token shown in the desktop window.

> On a real phone, `ws://localhost` won't reach the laptop — run a tunnel
> (cloudflared/ngrok) in front of the relay and set the desktop's `publicRelayUrl`
> so the QR carries a `wss://…` URL the phone can reach.

## Wire protocol
Mirrors `helm-relay/protocol.js` exactly (`src/protocol.js`). The phone is the
CLIENT: `client_hello` → `peer_online` → `list` → `catalog` → `submit_task` →
`task_started` → `output…` → `task_complete` / `task_error`.

## Screens
1. **Login** — brand + auth buttons (auth is roadmap; buttons advance to pairing).
2. **Scan device** — camera QR scanner + manual relay/token entry.
3. **Dashboard** — Projects · Agents · Settings · Account tabs, with a live
   connection pill and a soft reconnect bar when the laptop drops.
4. **Task** — input → streaming console → result (lines / exit / elapsed).
5. **Offline** — the hard "Laptop unreachable" recovery state with Try again.

## Notes
- **Fonts:** the design calls for Geist / Geist Mono. To stay runnable with zero
  download risk, `src/theme.js` falls back to system + platform monospace faces.
  Drop Geist `.ttf` files into `assets/` and load them with `expo-font` to match
  the prototype exactly.
- **Icons/splash:** `app.json` uses Expo defaults; add `assets/icon.png` and a
  splash image before building a standalone app.
- **Cancel** is a local reset — the MVP protocol has no remote `cancel_task`
  (see `helm-relay/protocol.js`); the laptop run finishes on its own. Remote
  cancel is roadmap.
