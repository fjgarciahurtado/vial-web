# Phase 3: advanced features

Phase 3 adds the features most people never need, in a separate **Advanced**
section so they don't crowd the everyday ones. Each feature ships in its own pull
request and is described here as it lands.

The **Advanced** section appears in the section switcher only on keyboards that
have at least one of these features. Inside it, tabs switch between the features
the keyboard has: **Tap dance**, **Combos** and **Typing settings**.

## QMK settings

**What users see.** Advanced shows the keyboard's QMK settings in groups, each
with one sentence saying what the group is for:

| Group | Examples |
|---|---|
| Tap and hold keys | Hold time (Tapping Term), Permissive Hold, Retro Tapping |
| Key swaps | Swap Caps Lock and Left Control, N-key rollover |
| Escape and ` key | When the Grave Escape key types Escape anyway |
| Auto Shift | Turn it on, hold time, which keys it applies to |
| Combos | Time to press combo keys together |
| One-shot keys | Taps to lock, wait before cancelling |
| Mouse keys | Pointer and scroll speeds |

Settings have plain names, and those with a QMK name people may look up keep it
in brackets, for example "Hold time … (Tapping Term)". Only the settings the
firmware reports are shown, and empty groups are left out, as in vial-gui.

Changes are a draft until **Save settings**, like macros. Groups with unsaved
changes say "Not saved", and **Discard changes** goes back to what the keyboard
has. **Reset to defaults** asks first, then puts every setting back to the
firmware's defaults. Numbers stay within each setting's limits.

Settings are saved in `.vil` backups under `settings`, keyed by setting id, as
vial-gui does, and restored from them. Settings the keyboard doesn't have are left
out, and the restore message says how many. Values outside a setting's limits are
brought within them, so a hand-edited backup can't write nonsense.

**How it works.** `src/core/qmk-settings.ts` ports `reload_settings()`,
`qmk_settings_set()` and `qmk_settings_reset()` from
`protocol/keyboard_comm.py`, and `qsid_serialize()` / `qsid_deserialize()` from
`editor/qmk_settings.py`:

- `CMD_VIAL_QMK_SETTINGS_QUERY` (0x09) lists setting ids above a given one, 16 per
  reply, padded with 0xFFFF. The app asks again until a reply has padding.
- `CMD_VIAL_QMK_SETTINGS_GET` (0x0A) returns a status byte and the value.
- `CMD_VIAL_QMK_SETTINGS_SET` (0x0B) sends the id and the value; only changed
  settings are written.
- `CMD_VIAL_QMK_SETTINGS_RESET` (0x0C) restores the defaults, then the app reads
  every setting again.

Ids and values are little-endian. Each setting's id, bit, byte width and limits
come from vial-gui's `qmk_settings.json`; several on/off settings share one id
and each owns one bit of its value. If the keyboard refuses a setting while
saving, the app reads all settings back so the screen matches the keyboard.

No unlock is needed, as in vial-gui.

## Combos

**What users see.** The **Combos** tab explains combos in one sentence: press
several keys at the same time to get something else, for example A and S
together for Escape, while each key still works alone.

A list shows every combo slot the firmware has, with what each one does in plain
words ("J + K → Escape", or "Not set up"). **New combo** jumps to the first empty
slot. The selected combo is drawn as four key slots, a plus between each, an
arrow, and the result. Clicking a slot and then a key in the usual key picker
fills it; after each key the selection moves on (key 1, key 2, then the result),
so a simple combo takes three clicks. **Clear** empties the selected slot and
**Delete combo** empties the whole combo.

Like keys, every change is written to the keyboard straight away, as in vial-gui.
A combo that can't work yet says why: it needs at least two keys, the same key
can't be in it twice, or it still needs a result. A combo whose result is the
bootloader key unlocks the keyboard first; the firmware ignores it otherwise.

Backups save every combo slot under `combo` as five key names, as vial-gui does,
and restore them into the slots the keyboard has. Slots the backup doesn't
mention keep what the keyboard has, and the restore message says how many saved
combos didn't fit.

**How it works.** `src/core/combos.ts` ports `reload_combo()`, `combo_set()`,
`save_combo()` and `restore_combo()` from `protocol/combo.py`. They use the
dynamic entry commands, which `vial-client.ts` now offers to every Phase 3
feature as `getDynamicEntry()` and `setDynamicEntry()`
(`_retrieve_dynamic_entries()` in `protocol/base_protocol.py`):

- `CMD_VIAL_DYNAMIC_ENTRY_OP` (0x0D) with `DYNAMIC_VIAL_COMBO_GET` (0x03) and the
  slot number returns a status byte, then four trigger keycodes and the result,
  each a little-endian 16-bit number.
- `DYNAMIC_VIAL_COMBO_SET` (0x04) sends the slot number and the same ten bytes.

The number of combo slots comes from `DYNAMIC_VIAL_GET_NUMBER_OF_ENTRIES`, which
the app already read for tap dance.

## Tap dance

**What users see.** The **Tap dance** tab explains that a tap dance key does
different things depending on how it is pressed, and that it goes on a key in
Keys, under Tap dance. Tap dance keys are now called "Tap dance 1", "Tap dance 2"
and so on everywhere, counted from 1 like macros, instead of `TD(0)`.

A list shows every tap dance slot in plain words ("Tap: Escape, hold: Left
Ctrl"), with **New tap dance**. The selected one has four slots: **Tap**,
**Hold**, **Tap twice** and **Tap, then hold**, filled with the usual key picker.
Under each empty slot the app says what the keyboard does instead, following
the firmware: an empty hold holds the tap key, an empty double tap types the tap
key twice, and an empty tap-then-hold taps then holds.

**Wait time** is the tap dance's own tapping term: how long the keyboard waits
for another tap, and how long a press must last to count as a hold. It is saved
when the person leaves the box or presses Enter, within vial-gui's limit of 0 to
10000 ms.

The panel also says whether the tap dance is on any key yet ("On 2 keys of your
keymap", or how to put it on one). Like keys and combos, each change is written
to the keyboard straight away. Any action set to the bootloader key unlocks the
keyboard first.

Backups save every slot under `tap_dance` as four key names and the wait time
as a number, as vial-gui does. Restoring works like combos: unreadable entries
keep the keyboard's own, and extra saved tap dances are reported.

**How it works.** `src/core/tap-dance.ts` ports `reload_tap_dance()`,
`tap_dance_set()`, `save_tap_dance()` and `restore_tap_dance()` from
`protocol/tap_dance.py`, with `DYNAMIC_VIAL_TAP_DANCE_GET` (0x01) and
`DYNAMIC_VIAL_TAP_DANCE_SET` (0x02). An entry is five little-endian 16-bit
numbers: tap, hold, double tap and tap-then-hold keycodes, then the wait time.
The fallbacks shown for empty actions come from `on_dance_finished()` in
vial-qmk `quantum/vial.c`. The store writes combos and tap dances through one
shared helper that handles unlocking and unplugging.
