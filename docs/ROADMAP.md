# vial-web roadmap

Each phase ends in something people can use, so work can stop after any phase
and still leave a useful product. Later phases depend on earlier ones only where
noted.

Reference code lives in `../vial-gui/src/main/python`. Paths below are relative
to that folder.

## Open issues

Things that are known and not done yet, across phases. Remove an item when it is
done, and add new ones as they come up.

- [ ] **Test Phase 2 on real hardware.** Lighting (survives a replug after "Save
  lighting"), the key tester, and saving macros were only tested against the demo
  keyboard before being merged. Ideally test lighting on more than one lighting type
  (backlight, RGB light strip, VialRGB).
- [ ] **Flash the kb8knob firmware with lighting turned on.** `kb8knob/midi`'s
  `vial.json` now declares `"lighting": "qmk_rgblight"`, and the firmware is built
  (`fjgh_kb8knob_midi_vial.uf2` in vial-qmk), but not yet flashed and tried.
- [ ] **Flash the kb16knob firmware with lighting turned on.** rev1, rev2 and rev3
  (including rev3's `vial_midi` keymap) now declare `"lighting": "qmk_rgblight"` in
  their `vial.json`, and the firmware is built (`fjgh_kb16knob_*.uf2` in vial-qmk). Flash
  them, then check the Lighting section appears.
- [ ] **Keyboard firmware isn't backed up.** `keyboards/fjgh` in vial-qmk is untracked,
  and the vial-qmk checkout points at the upstream repo. Consider a fork of
  vial-kb/vial-qmk (needs `git config --global --add safe.directory
  C:/Users/fjgar/vial-qmk` first).
- [ ] **Light strip effect numbers assume every effect is built in.** QMK numbers
  rgblight effects only among the ones the firmware enables, so on a keyboard that
  leaves some out, names after the gap are wrong (vial-gui has the same problem). The
  fjgh keyboards enable all of them, including Twinkle, so they are fine.
- [ ] **Redeploy to Netlify and check the live site.** The first deploy's security
  policy blocked WebAssembly, so keyboards couldn't be opened; fixed in PR #3 and
  confirmed with a real keyboard through `npm run preview:netlify`, which uses the same
  headers. Waiting for Netlify credits to redeploy. If the site was uploaded by hand,
  connect it to the repository instead (see [DEPLOY.md](DEPLOY.md)) so merges to `main`
  redeploy automatically and pull requests get preview sites.
- [ ] **Phase 3** (below): QMK settings done; tap dance, combos, key overrides and alt
  repeat key still to do.

## Phase 0: Foundation (done)

- Vite + React + TypeScript, Tailwind, shadcn/ui, Zustand.
- WebHID transport and the `HidTransport` interface.
- Read the VIA/Vial protocol versions, keyboard definition (xz + JSON), layer
  count and keymap.
- Draw the keyboard from its KLE layout and switch between layers.
- Demo keyboard, unit tests with `FakeTransport`, Playwright tests.

## Phase 1: Remap keys (first public release)

The one job most people have: "make this key do something else".

Status: done, tested on a real keyboard and merged to `main`. Deploying to Netlify is
left for the end (see Open issues).

Scope:

- **Full keycode catalogue.** Port `keycodes/keycodes.py`, `keycodes_v5.py` and
  `keycodes_v6.py`. The protocol version picks the table. Each keycode gets a
  plain-language name, a short legend for the keycap, a category and search
  words ("volume up", "copy").
- **Key picker.** Select a key, then choose from a searchable panel grouped by
  category (Letters, Numbers, Media, Navigation, Layers, ...). Drag and drop is
  optional.
- **Write keys to the keyboard.** `CMD_VIA_SET_KEYCODE` and the encoder
  equivalent (`protocol/keyboard_comm.py`). Changes apply immediately, as in
  vial-gui.
- **Undo and redo** for keymap changes.
- **Layout options**, such as split backspace or ISO enter
  (`editor/layout_editor.py`, `VIA_LAYOUT_OPTIONS`).
- **Rotary encoders**: show and remap them.
- **Backup and restore.** Save and load `.vil` files that stay compatible with
  vial-gui, so users can move between the two apps (`save_layout` /
  `restore_layout` in `protocol/keyboard_comm.py`).
- **Unlock when needed.** Assigning the bootloader key (QK_BOOT) requires the
  unlock flow (`unlocker.py`). Build it as a guided step that shows which keys
  to hold. Also finish an interrupted unlock when the keyboard connects.
- **Robust connection.** Handle unplugging, reconnecting, and keyboards that
  are already open in another tab.
- **Basics**: dark mode following the OS, responsive layout, keyboard
  navigation.
- **Hosting**: deploy to Netlify (the Netlify MCP server is configured).

Done when someone who has never used Vial can connect a keyboard, change a key,
see it work in a text editor, and restore a backup, without reading any docs.

## Phase 2: Everyday extras

Features that non-experts ask for after remapping.

Status: built, tested against the demo keyboard and merged to `main` (PR #1); what
changed is described in [PHASE-2.md](PHASE-2.md). Still to do: hardware testing (see
Open issues).

- **Layer keys made understandable.** Friendly builders for the layer and
  modifier keycodes (MO, TG, TO, LT, mod-tap) with one-sentence explanations,
  for example "Hold for Layer 1, tap for Space".
- **Lighting.** QMK backlight, RGB light and VialRGB: brightness, effect,
  speed and colour (`editor/rgb_configurator.py`). Show a live preview where
  possible.
- **Key tester.** Highlight keys as they are pressed
  (`editor/matrix_test.py`). Requires unlock. This also helps people check that
  a new keyboard works.
- **Macros.** Type text or record key sequences (`editor/macro_recorder.py`,
  `protocol/macro.py`). Saving macros requires unlock. Show the remaining
  macro memory.

Done when lighting, macros and the key tester work on at least two real
keyboards with different lighting systems.

## Phase 3: Advanced features

Hidden behind an "Advanced" section, each with a short explanation and example.

Status: in progress, one feature per pull request; what changed is described in
[PHASE-3.md](PHASE-3.md). Done: QMK settings.

- **Tap dance** (`editor/tap_dance.py`, `protocol/tap_dance.py`).
- **Combos** (`editor/combos.py`, `protocol/combo.py`).
- **Key overrides** (`editor/key_override.py`, `protocol/key_override.py`).
- **Alt repeat key** (`editor/alt_repeat_key.py`,
  `protocol/alt_repeat_key.py`).
- **QMK settings** (`editor/qmk_settings.py`, `../resources/base/qmk_settings.json`). Done.

These all use the dynamic entry commands (`CMD_VIAL_DYNAMIC_ENTRY_OP`), so they
share one protocol module. Each feature can ship on its own.

## Phase 4: Desktop app

For Firefox and Safari users (no WebHID) and for offline use.

- Tauri 2 shell around the same web app.
- Rust `hidapi` transport behind the existing `HidTransport` interface. No
  changes to `src/core/`.
- Signed installers for Windows, macOS and Linux, plus auto-update.
- Linux: install the udev rule or explain how.

Can start any time after Phase 1. It doesn't depend on Phases 2 or 3.

## Phase 5: Firmware updater

Highest risk: a mistake can leave a keyboard unusable until it is recovered by
hand.

- Vial bootloader (vibl) detection and flashing (`editor/firmware_flasher.py`,
  `VialBootloader` in `vial_device.py`).
- Reboot to bootloader, which requires unlock.
- Check that the firmware matches the keyboard before writing.
- Clear warnings, a confirmation step, and progress that people can't
  accidentally interrupt.
- Restore the user's keymap after flashing, using the Phase 1 backup.

Done only after testing on real hardware with each supported bootloader, and
recovery instructions are written for the failure cases.

## Optional work

Pick these up when there is demand:

- **VIA keyboards.** Support keyboards running VIA instead of Vial by
  downloading VIA definitions (the "VIA stack" in `util.py`).
- **Sideloading.** Load a keyboard definition JSON for development boards.
- **Translations.** vial-gui wraps its text in `tr()`, so the strings can be
  reused as a starting point.
- **Shareable layouts.** Share a keymap as a link or image.

## Cross-cutting rules

- Every protocol command is ported test-first against `FakeTransport`, with
  byte-level expectations taken from the Python code.
- Each phase adds Playwright tests that run against the demo keyboard, so CI
  never needs hardware.
- Before closing a phase, test it on at least one real keyboard.
- Licence: GPL-2.0-or-later, the same as vial-gui.
