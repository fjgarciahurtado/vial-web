# Phase 2: everyday extras

Phase 2 adds the features people tend to want once they can remap keys: keys
that do two things, lighting, a key tester and macros. Like Phase 1, each one is
ported from vial-gui and written for people who have never configured a
keyboard before.

The app now has a section switcher at the top: **Keys**, **Lighting**,
**Macros** and **Key tester**. Lighting and Macros only appear on keyboards that
have them.

## Shortcuts and tap-or-hold keys

**What users see.** A new **Shortcuts & holds** tab in the key picker builds
keys that combine two things, in three kinds:

| Kind | Example | QMK keycode |
|---|---|---|
| Shortcut | Ctrl + C | `LCTL(KC_C)`, `C_S(kc)`, `HYPR(kc)`… |
| Tap or hold: modifier | Tap for Esc, hold for Ctrl | `LCTL_T(KC_ESCAPE)`… |
| Tap or hold: layer | Tap for Space, hold for layer 1 | `LT1(KC_SPACE)`… |

People choose modifiers with checkboxes (Ctrl, Shift, Alt, Win/Cmd, and
"right-hand keys") and the key with a plain-word search. Mixes QMK has no
keycode for, such as Ctrl + Shift + Win, are explained rather than offered.
Selecting a key that already is one of these opens the builder with its
settings filled in.

Keycaps now say what these keys do, for example `Esc / hold Ctrl`,
`Shift + / A` and `L1 / hold`. Legends shrink to fit the cap instead of being
cut off.

**How it works.** `src/core/keycodes/builders.ts` reads modifier bits 8–12 of
the outer keycode (Ctrl 1, Shift 2, Alt 4, Win 8, right side 16), which are the
same in Vial protocols 5 and 6, and looks the combination up in the keycode
catalogue. The inner key must be a basic keycode below `0xFF`, the same rule as
vial-gui's `set_key_matrix` in `editor/keymap_editor.py`.

## Lighting

**What users see.** A **Lighting** section with one group per lighting system
the keyboard has:

| `vial.json` `"lighting"` | Group | Controls |
|---|---|---|
| `qmk_backlight` | Backlight | Brightness, "slowly fade in and out" |
| `qmk_rgblight` | RGB light strip | Effect, brightness, speed, colour |
| `qmk_backlight_rgblight` | Both of the above | |
| `vialrgb` | Key lights | Effect (only those the firmware has), brightness, speed, colour |

Changes show on the keyboard immediately. **Save lighting** stores them so they
survive unplugging. Speed and colour controls only appear for effects that use
them. The keyboard drawing glows in the chosen colour, or in a rainbow for
rainbow effects.

**How it works.** `src/core/lighting.ts` ports `reload_persistent_rgb`,
`reload_rgb` and the `set_*` methods of `protocol/keyboard_comm.py`, and the
effect lists of `editor/rgb_configurator.py`. VialRGB's supported effects are
read 15 at a time until the firmware answers `0xFFFF`. Slider moves are queued
in the store so that only the newest value is sent while a write is in flight.

The section appears only when the keyboard's `vial.json` declares lighting, as in
vial-gui. A keyboard can build RGB into its firmware (`RGBLIGHT_ENABLE = yes`)
and still say `"lighting": "none"`, in which case neither app shows the
controls.

## Key tester

**What users see.** A **Key tester** section. After unlocking, keys turn blue
while held and green once they have worked, with a running count such as
"23 of 61 keys work". **Start again** clears the results. While the tester is
open, key presses don't scroll the page or press buttons. In demo mode the
computer's own keyboard presses the demo board's keys.

**How it works.** `src/core/matrix.ts` ports `editor/matrix_test.py`: it reads
`VIA_SWITCH_MATRIX_STATE` (`0x02 0x03`), whose reply holds `ceil(cols / 8)`
big-endian bytes per row. The tester needs Vial protocol 3 or newer and a matrix
that fits one report; the firmware only reports switches while unlocked, so the
tester rechecks the lock about once a second and asks to unlock again if it
locked itself.

## Macros

**What users see.** A **Macros** section listing each macro with a one-line
summary ("Types “Best regards,”, presses Enter, types “Alex”"). A macro is
edited as a list of steps:

- Type text
- Press a key
- Hold a key down / Let go of a key (for shortcuts inside a macro)
- Wait (Vial protocol 2 and newer)

Steps can be reordered and removed. A bar shows how much of the keyboard's
macro memory is used. Text that keyboards can't type (anything outside US
ASCII, such as "é") is pointed out before saving. **Save macros** unlocks the
keyboard first, as vial-gui does; **Discard changes** goes back to what is on
the keyboard. Edits survive switching sections.

Macro keys are named "Macro 1", "Macro 2"… (vial-gui shows `M0`, `M1`…), and
can be put on keys from the **Macros** tab of the key picker.

**How it works.** `src/core/macros.ts` ports the `SEND_STRING` byte format from
`macro/macro_action.py` and `protocol/macro.py`, for Vial protocol 1 and for 2+
(prefixed escapes, delays, two-byte keycodes with QMK's zero-byte workaround).
The tests reuse the byte fixtures from vial-gui's `test/test_macro.py`. Macro
memory is read in 28-byte chunks and reading stops once every macro has ended.

## Backups

`.vil` backups now include macros in vial-gui's format (`["text", "hi"]`,
`["tap", "KC_ENTER"]`, `["delay", 100]`…). Restoring a backup writes its macros
when they differ from the keyboard's, unlocking first. Macro changes are not
part of Undo, matching vial-gui. Before writing, restored macros get the same
checks as the editor: text a keyboard can't type (including control characters
that would end a macro early) or a pause outside 0–65024 ms leaves the keyboard's
macros untouched and tells the user why. Unknown key names are counted in the
restore message. Tap dance, combos, key overrides and QMK
settings in a backup are still left untouched and reported to the user.

## Testing

- 128 unit tests (Vitest), including vial-gui's own macro fixtures and
  byte-level checks of every new protocol command against the firmware
  simulator in `src/core/fake-keyboard.ts`.
- 27 browser tests (Playwright) on the demo keyboard, covering each feature
  above.
- Tested on real hardware: lighting, the key tester and saving macros.
