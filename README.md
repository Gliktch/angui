# AnGUI

AnGUI is a focused Electron shell around [angband.live](https://angband.live), optimised for low-latency play and a distraction-free presentation. It embeds the latest Chromium engine distributed with Electron and adds quality-of-life controls such as window mode toggles, chat/sidebar collapsing, and encrypted credential storage via the system keyring.

## Features

- Chromium-based rendering (`electron@31`) for smooth dungeon updates.
- Frameless primary window with quick switching between windowed, borderless, and fullscreen modes.
- Settings overlay (Ctrl+Shift+A) to manage layout, credentials, and future preferences without exposing browser chrome.
- Optional collapsing of chat and sidebar panes via DOM injection.
- Secure storage for angband.live login using the desktop keyring (`keytar`) with preferences saved in the app data directory.
- External links open in the system default browser; no telemetry or background update checks.
- Prepared for future enhancements such as draggable layout panes and a visual macro/keymap editor.

## Project Structure

```
src/
  main/             # Electron main-process source (window + IPC orchestration)
  preload/          # Isolated bridges for the renderer shell + angband webview
  renderer/         # Settings overlay UI and webview container
  types/            # Shared ambient type declarations
assets/             # Packaging assets (icons etc. to be supplied)
```

Compiled assets are emitted to `dist/` by the TypeScript build.

## Getting Started

1. **Install prerequisites**
   - Node.js 20+
   - npm (bundled with Node)
   - Linux Mint 22.1 (or Ubuntu 24.04-based distro) for packaging tests

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Run in development**
   ```bash
   npm run dev
   ```
   The command keeps TypeScript compiling in watch mode and launches Electron once the main bundle is ready.

4. **Build for production**
   ```bash
   npm run build
   ```

5. **Create standalone packages**
   ```bash
   npm run package:all
   ```
   This emits portable bundles (AppImage, Windows portable EXE, macOS ZIP) under `release/`.

### Keyboard Behaviour

- All keypresses flow directly to the game except a small blocked list (`F5`, `F12`, etc.).
- Press `Ctrl+Shift+A` to toggle the settings overlay. This shortcut never reaches the game.
- Press `Ctrl+Shift+Enter` to toggle the chat sidebar and swap focus between chat and the game.
- Press `Ctrl+R` at any time to refocus the game terminal, even if chat has focus.
- Roll the mouse wheel while holding `Ctrl+Shift` to resize text in the focused panel.

### Credentials

- Usernames are stored alongside preferences in a JSON file within the app data directory.
- Passwords are written to the system keyring via `keytar`. On Linux this typically uses `libsecret`; ensure a compatible keyring is available (e.g., GNOME Keyring, KWallet).

### Layout Injection

The preload script attempts to collapse chat and sidebar panes by probing common selectors. As the angband.live DOM evolves you may need to tweak selectors in `src/preload/gamePreload.ts` to maintain parity.

## Future Enhancements

- Draggable panel rearrangement with per-panel font scaling.
- Visual macro/keymap editor with colour-coded keyboard mapping.
- Local chat history caching and specialised viewers for character dumps/macro files.
- Update service integration once a distribution channel is defined.

## Licensing

MIT licence by default; adjust as needed.

