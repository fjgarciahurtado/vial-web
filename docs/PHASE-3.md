# Phase 3: advanced features

Phase 3 adds the features most people never need, in a separate **Advanced**
section so they don't crowd the everyday ones. Each feature ships in its own pull
request and is described here as it lands.

The **Advanced** section appears in the section switcher only on keyboards that
have at least one of these features.

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
