# LEARNINGS — HELM

A running log of mistakes, root causes, fixes, and gotchas. **Read this before working on power/icon code. Append after every mistake so we never repeat it.**

> Scope note: HELM is a control interface for AI agents on the laptop — **not a terminal product**. Terminal/PTY/shell-detection learnings from the old direction have been removed. What remains backs the **keep-awake invariant** (power/lid code), the icon/tray pipeline, and the Electron build.

---

## L1 — Windows 11 hides the lid-close power setting
**Symptom:** `powercfg /query SCHEME_CURRENT SUB_BUTTONS LIDACTION` returned only the scheme header — no `Current AC/DC Power Setting Index` lines. Querying the whole `SUB_BUTTONS` subgroup showed only "Start menu power button" (`UIBUTTON_ACTION`), not lid action.
**Root cause:** Many Win11 OEM images set the `ATTRIB_HIDE` attribute on the lid-close setting, so it's invisible to `powercfg` query/set until unhidden. Our first `power.js` assumed it was always queryable and would have silently skipped the lid override (`readLidAction()` → null → "skipped").
**Fix:** The elevated enable batch now runs `powercfg /attributes SUB_BUTTONS LIDACTION -ATTRIB_HIDE` FIRST, then captures the original value to a temp file, then sets it to 0. After the batch, the app re-reads (now-unhidden) the value to confirm the override took.
**Gotcha for next time:** Do not assume a power setting is visible. Unhide before query/set. We currently leave it unhidden after restore (harmless — only makes "lid close action" appear in advanced power options). If exact restoration of the hidden state is ever required, track and re-apply `+ATTRIB_HIDE`.

## L2 — Can't read the original lid value without elevation (because it's hidden)
**Root cause:** Unhiding requires admin, and the value can't be read until unhidden. So we cannot save the "original" with a plain non-elevated query before overriding.
**Fix:** The elevated batch redirects `powercfg /query ... > "%TEMP%\termwork-lid-orig.txt"` BETWEEN the unhide and the set. The app then reads that temp file (same user's temp, accessible) and parses AC/DC to store in `settings.savedLidAction`. Order matters: unhide → query>file → set 0 → setactive.

## L3 — pnpm 10 blocks postinstall build scripts by default
**Symptom:** After `pnpm install`, `electron` had no binary and `sharp` wasn't built ("Ignored build scripts: electron, sharp").
**Fix:** Add to `package.json`: `"pnpm": { "onlyBuiltDependencies": ["electron", "sharp"] }`, then `pnpm rebuild electron sharp`. Verify with `node -e "console.log(require('electron'))"` → prints the electron.exe path.

## L4 — sharp/resvg ignores SVG `dominant-baseline`
**Symptom:** The TW text rendered in the upper half of the icon, not centered.
**Root cause:** sharp's SVG renderer (resvg) doesn't honor `dominant-baseline="central"`; the `y` is treated as the text baseline.
**Fix:** Drop `dominant-baseline`, set the baseline `y` explicitly. For a 512 canvas, font-size 232, `y=338` centers "TW" vertically.

## L5 — UAC prompts on every elevated powercfg call
**Status / known limitation (v1):** Each `Start-Process -Verb RunAs` is a separate elevation, so enabling prompts UAC once and disabling/quitting prompts again. There is no cross-process elevation caching without a persistent elevated helper.
**Future fix:** Spawn one long-lived elevated helper process that the app pipes commands to, so it's a single UAC for the whole session. Out of scope for v1; documented so we don't rediscover it.

## L7 — electron-builder fails extracting winCodeSign (symlink privilege)
**Symptom:** `pnpm dist` failed: `ERROR: Cannot create symbolic link : A required privilege is not held by the client` extracting `winCodeSign\<hash>\darwin\10.12\lib\libcrypto.dylib` / `libssl.dylib`.
**Root cause:** The `winCodeSign-2.6.0.7z` bundle (used only for code signing) contains macOS symlinks. Creating symlinks on Windows needs admin or Developer Mode, which this machine lacks. The Go downloader extracts to a random temp dir then renames to `winCodeSign-2.6.0` on success — the symlink error aborts before the rename, so it re-downloads forever.
**Fix (no admin needed):** Pre-extract the cached archive ourselves into the expected final folder, letting the 2 darwin symlinks fail (we don't need mac libs on Windows — only `windows-10/` + `rcedit-x64.exe`):
```powershell
$cache = "$env:LOCALAPPDATA\electron-builder\Cache\winCodeSign"
$z = "node_modules\.pnpm\7zip-bin@5.2.0\node_modules\7zip-bin\win\x64\7za.exe"
Get-ChildItem $cache -Directory | Remove-Item -Recurse -Force   # clear failed temp dirs
& $z x (Join-Path $cache '<any>.7z') "-o$cache\winCodeSign-2.6.0" -y   # exit 2 on the 2 dylibs is OK
```
Then `pnpm exec electron-builder --win portable` finds the populated `winCodeSign-2.6.0` and skips its own extraction. Build is unsigned (fine for local v1).
**Alternative:** enable Windows Developer Mode (grants symlink privilege) — then no workaround needed.

## L6 — Background GUI launch reports "exit 0" but app is still running
**Symptom:** Launching `electron .` via a backgrounded PowerShell `&` with redirection reported the task completed (exit 0), but `Get-Process electron` showed 5 live processes.
**Takeaway:** Don't trust the wrapper's exit signal for a detached GUI app. Verify with `Get-Process electron` and read the redirected log for actual errors. 5 processes (main + GPU + renderer + utility) is normal for Electron.
**Corollary (2026-06-02):** If a packaged build is ALREADY running, a freshly launched dev `electron .` exits **0 immediately** — `requestSingleInstanceLock()` returns false and we `app.quit()`. So "0 electron processes after launch + exit code 0" with an instance already in the tray is the single-instance path working, not a crash. To smoke-test new main-process code on Windows you must first quit the running instance (careful: if it has keep-awake ON it holds a lid override — quit it through the app so it restores).

## macOS port (v1.1)

## L9 — macOS lid-close = `pmset disablesleep`, not powercfg
**Context:** The macOS analog of the Windows LIDACTION=0 override is `sudo pmset -a disablesleep 1` — it disables system sleep entirely, including closing the lid (clamshell), on AC + battery. `caffeinate` / `powerSaveBlocker` do NOT stop lid-close sleep; only `disablesleep` does.
**How:** read original non-elevated via `pmset -g` (`SleepDisabled 0/1`), set via `osascript -e 'do shell script "/usr/bin/pmset -a disablesleep 1" with administrator privileges'` (one auth prompt = UAC analog), restore on OFF/quit. Idle/display sleep stays on the cross-platform `powerSaveBlocker('prevent-display-sleep')` layer.
**Gotcha:** user dismissing the auth dialog → AppleScript error **-128** ("User canceled") with nonzero exit → map to `denied` (display sleep is still blocked, lid isn't). Keep the integer 0/1 hard-coded — never interpolate input into the osascript string.

## L14 — "I can't see my changes" = running a packaged build, not source
**Symptom (v1.2):** After a full renderer redesign, the user reported the app looked unchanged.
**Root cause:** They were launching a packaged portable `.exe` — a frozen snapshot of
the old code. Editing files under `src/**` does **not** update an already-packaged `.exe`
(electron-builder bundles a copy of the source into the asar at build time).
**Fix / how to actually see source changes:**
- Run from source: `pnpm start` (or `pnpm dev` for devtools). Confirm it's the source build by
  process name — `electron` = source, the productName = packaged.
- To update the double-click workflow, rebuild: `pnpm dist` → the version-named portable `.exe`.
**Gotcha:** the portable exe is version-named, so an old build lingers next to a new one — make
sure the user opens the new file. Also clears up that the single-instance lock only matters when
an instance is *currently running*; here none was.

## L13 — The "ask for my machine password" step must NOT collect the password in-app
**Context (v1.2 redesign):** The user asked that turning on stay-awake "asks for my machine
password." The tempting-but-wrong reading is an in-app password field piped to `sudo`/RunAs —
that would violate the no-input-into-a-command invariant and is strictly *less* secure than
the OS dialog (we'd be handling the plaintext credential).
**Right design:** a styled in-app **confirmation modal** ("needs admin access… you'll
see your system password prompt next") with Continue/Cancel. Continue calls the existing
`setKeepAwake(true)` path, which triggers the **real OS elevation prompt** (Windows UAC /
macOS `osascript … with administrator privileges`). The password is only ever entered into the
OS dialog. Cancel reverts the toggle. Modal is skipped when already overridden (no second
elevation). Lives in `renderer.js` (`openConfirm`/`applyKeepAwake`).
**Gotcha:** keep the strict renderer CSP (`default-src 'none'; font-src 'self'`) — the
redesign uses **system font stacks only** (no Google Fonts/CDN), or the fonts
silently fail to load under CSP.

## L12 — macOS menubar needs a template image; window wants native traffic lights
**Tray:** the full-color 512 `icon.png` looks wrong in the menubar. Generate a small monochrome black-on-transparent `assets/trayTemplate.png` (+ `@2x`) and `img.setTemplateImage(true)` so it adapts to light/dark. (`make-icon.js` builds it from an inline black-glyph SVG.)
**Window:** instead of Windows' `frame:false` + custom min/close, use `titleBarStyle:'hiddenInset'` + `trafficLightPosition` so native traffic lights appear top-left; renderer hides the custom buttons and pads the titlebar left via a `platform-mac` body class.
**Icns on Windows:** `iconutil` is macOS-only; use the pure-JS `png2icons` (`createICNS`) so `assets/icon.icns` is generated on the Windows dev machine and committed ready for the Mac build.

## L19 — Lid "original" can be captured as our own 0 → restore leaves lid stuck on "do nothing"
**Symptom (found live, v1.4):** A running build had `savedLidAction: {ac:0, dc:0}` in settings while
the true original was Sleep. A graceful quit would "restore" the lid to 0 = *do nothing*, silently
defeating sleep (overheat risk) — the exact opposite of the always-restore invariant.
**Root cause:** `power.win.js override()` captures the lid value *at the moment keep-awake is enabled*
as the "original" to restore later. If a PRIOR session set the lid to 0 and was **force-killed without
restoring** (e.g. crash, Task Manager, or our own dev force-kill), the lid is already 0 when the next
enable runs — so it captures `{0,0}`. `power.js` guards against *overwriting* an existing saved value
but not against capturing a bad *initial* one.
**Fix:** in `override()`, sanitize the captured value — any rail read as `LID_DO_NOTHING` (0) falls back
to `1` (Sleep, the Windows default). We never persist our own override as the "original", so OFF/quit
can't leave the lid on "do nothing". Also fixed the affected machine's settings by hand ({1,1}).
**Gotcha:** force-killing the app (instead of graceful quit) skips `restoreForQuit()` and leaves the
lid overridden — that's what seeds this. When killing during dev, restore the lid manually
(`powercfg /setac|dcvalueindex SCHEME_CURRENT SUB_BUTTONS LIDACTION 1; powercfg /setactive SCHEME_CURRENT`).
The mac backend (`power.mac.js`, `{disableSleep}`) has the analogous latent risk — apply the same
"don't trust our own override as the original" guard if it ever surfaces.

## L20 — "Verified with Node ws clients" ≠ the browser sim actually works
**Symptom (found live):** The whole relay+desktop pipe passed every Node-WebSocket test (catalog,
task streaming, isolation), but opening `http://localhost:8787/sim?token=…` in a real browser showed a
blank "not found" page — "it's not working."
**Root cause:** TWO HTTP-routing bugs the Node clients never exercised (they speak ws, never fetch the
page): (1) `server.js` matched the **raw** `req.url` (`=== '/sim'`), so a `?token=…` query — the normal
QR auto-connect URL — fell through to 404; (2) `sim/index.html` referenced the script **relatively**
(`src="sim.js"`), which from `/sim` resolves to `/sim.js`, a path the server doesn't serve → 404, so the
page loaded but ran no JS.
**Fix:** route on the **pathname** (`req.url.split('?')[0]`) for `/`, `/health`, and `/sim*`; make the
script tag absolute (`src="/sim/sim.js"`). Re-tested in a real browser: auto-connect → "laptop online",
catalog renders, task streams `SIM_OK` → exit 0.
**Gotcha for next time:** a protocol-level (ws) test does not cover the static-serving / page-load path.
When a feature has a *page*, load it in an actual browser before calling it verified. Match routes on the
parsed pathname, never the raw URL with its query string.

## L21 — HELM Mobile reuses the proven sim.js client; verify RN code with a Metro export
**Context:** `helm-mobile/` (Expo SDK 53, plain JS) is the phone-side control surface. The connection
layer (`src/lib/connection.js`) is a direct port of the already-proven `helm-relay/sim/sim.js` flow
(`client_hello` → `peer_online` → `list` → `catalog` → `submit_task` → `task_started` → `output` →
`task_complete`/`task_error`), so the wire contract didn't need re-deriving — `src/protocol.js` mirrors
`helm-relay/protocol.js`. The QR encodes `{ v, relay, token }` (see `helm-desktop/src/main/pairing.js`);
the scanner parses that JSON, stores it in `expo-secure-store`, and points the live socket at it.
**Gotcha (avoided):** `react-native-gesture-handler` is **not** needed by `@react-navigation/native-stack`
(only the JS `stack`/`drawer` need it). Importing it without installing it would crash at boot — removed.
**Verification without a device:** there's no simulator here, so run a headless Metro bundle to catch
import/JSX/resolution errors: `npx expo export --platform ios --output-dir dist-check` (must be a subdir
of the project — absolute/`/tmp` paths are rejected). A clean "Bundled … (N modules)" means every import
resolves and the tree compiles. Delete `dist-check` after — it's a build artifact.
**Fonts:** the design wants Geist/Geist Mono; `src/theme.js` falls back to system + platform monospace so
the app runs with zero font-download risk. Drop Geist `.ttf` into `assets/` + `expo-font` to match exactly.
