# AnGUI

Native desktop client for `angband.live`, rebuilt from scratch in Rust
(egui/eframe with alacritty terminal emulation).

## Status

- Current build: `v0.2.0` native prototype (local only).
- The repository is local-only by design: not pushing to the GitHub remote
  until a release is ready for public testing.
- This README is a live window into how development is going; the feature
  list below will be trimmed down for release.

## Features

### Implemented

- Native desktop client: egui/eframe UI, alacritty terminal emulation, direct
  websocket connection to `angband.live`.
- Login and saved sessions: on-disk cookie store, password in the OS keyring,
  "Use saved session" reconnect.
- Live games list: hero Play/Change controls and a table of live games
  (player, game, version, cLvl, race/class, location, idle).
- Playing your own game: terminal rendering, full keyboard/function-key/arrow
  forwarding, mouse clicks via the terminal protocol, Ctrl+C/X/V forwarded to
  the game, clipboard paste to the game.
- Spectating: per-player buffers, spectate overlay, Stop Watching / Ctrl+X,
  Escape opens the games sidebar.
- Chat: history (capped), filter, Users tab, multi-line input, char limit,
  click-to-@tag from the user list.
- `@tag` tab completion.
- URL linking in chat (clicking opens the link in a browser tab).
- Reliable chat/game focus switching; game-first keyboard handling (no
  accidental Ctrl+R refresh).
- Collapsible sidebar with drawers (chat, sessions, network, alerts,
  settings), edge toggle strip, and overlay / reserve-always /
  reserve-when-open space modes.
- Window modes: windowed / maximized / fullscreen, persisted across runs.
- First-run setup wizard: window mode, sidebar behavior, zoom preview.
- Favorites: add, rename, remove; persisted.
- Ignore user: confirmation modal, filtered from chat.
- Network status drawer: websocket state, session presence, last
  connect/message, manual reconnect.
- Error handling: error drawer, toasts, fatal-error modal, panic logging,
  launch/close sequences.
- UI and text zoom (Ctrl+= / Ctrl+-), persisted separately.
- Localization (Fluent, `en-AU`) and live-tunable UI/theme specs (JSON5) with
  live reload via `--live-ui`.
- Startup build-number badge (top-left, 10 seconds).

### Partial

- Chat input memory: sent-message history is persisted and recallable; an
  unsent draft survives drawer close in-session but not an app restart
  (possible later add, not a blocker).
- Files visibility: the server `fileupdate` snapshot is received and shown as
  a debug line in Settings; no interactive Files tab yet - a server-side crash
  risk historically blocked this; re-test planned.

### Planned

- Files tab with collapsible game/version groups, all collapsed by default;
  maybe a feature to auto-show any new files added in that session without a
  need to expand all files just for those.
- Numlock warning or auto-correction.
- Configurable mention/spectator alerts; replace or mute the `@tag` bell.
- Pre-rendered TTS voice themes: TTS audio files generated on a local system
  and shipped as a selectable voice-theme option.
- Boss key: hide to tray; relaunch restores the running instance
- an "allow multiple instances" toggle (default off).
- Cross-session chat draft persistence.

## Direction

- Keep the client lean and purpose-built for fast live play; the game-first
  feel is the primary design constraint.
- Build around usability that matters during live play rather than generic
  browser-shell features.

## Quick start

- `cargo run` - normal launch
- `cargo run -- --live-ui` - live-reload UI specs and strings while editing
- Smoke runs: `ANGUI_CONFIG_DIR=<repo>/.smoke-profile cargo run`

-----

# Old AnGUI Readme:

AnGUI is being rebuilt from scratch.

## Proposed Features

- Semi/true fullscreen with no browser or window bars.
- Ability to collapse sidebar and chat while playing.
- URL linking.
- Reliable swapping of chat/game focus with `Tab` or another suitable key.
- Tab completion for username `@tags`.
- Free up nearly all keyboard shortcuts for the game (no more accidental `Ctrl+R` refreshes!).
- Chat input memory, so if something screws up, you don't lose what you typed and tried to submit.
- Collapsible game/version sections in the Files tab.
- Numlock warning or auto-switch behavior.
- Clean disconnect option and handling for spectated games.
- A basic network status tab.
- Replace or mute the `@tag` bell, plus alert when someone starts spectating.

## Legacy Build

The existing `v0.1a` binaries remain available through the GitHub release:

- <https://github.com/Gliktch/angui/releases/tag/v0.1a>

