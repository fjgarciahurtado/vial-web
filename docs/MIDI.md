# Phase 3.5: MIDI piano

Keyboards built for music, such as the fjgh MIDI pads, put MIDI notes and chords on
their keys. vial-gui shows those as a grid of keycaps labelled `ᴹᴵᴰᴵ C₁`, which
says little to a musician. vial-web draws them as a piano.

## What users see

Choosing a key on the keyboard and opening the **MIDI** tab of the key picker
shows, from top to bottom:

- **What the key plays now**: "This key plays C4", or "This key plays the chord
  Am: A3, C4, E4".
- **Note names**: **C D E** or **Do Re Mi**. The choice is remembered in the
  browser.
- **Chords on this keyboard**, when the keyboard has chord keys. Each shows its
  name and notes. Pointing at a chord (or tabbing to it) lights its notes on the
  piano in green; clicking it puts the chord on the key.
- **The piano**: six octaves, C3 to B8, the notes the MIDI note keys play at the
  normal octave setting. It scrolls sideways and opens on the key's note (or
  middle C). The key's note is blue. C keys and lit keys show their names.
  Clicking a piano key puts that note on the key.
- **Octave, Transpose, Velocity, Channel, Pedals and effects**: the other MIDI keys,
  each group with one sentence saying what it does, and buttons with plain names
  ("Octave up", "Sustain pedal", "Channel 10").

Searching still finds MIDI keys as usual. Elsewhere in the app MIDI keys now have
plain names too: "MIDI C4", "MIDI Sustain pedal", and keycaps show `MIDI` over the
note, so the keyboard drawing matches the piano.

## How it works

`src/core/midi.ts`:

- **Notes.** QMK plays `12 × octave + offset + transpose` for a note key
  (`midi_compute_note()` in `quantum/process_keycode/process_midi.c`). The default
  octave is `MI_OCT_2`, which is octave 4, so `MI_C` is MIDI note 48 (C3) and the 72
  note keys run to B8. Note names use the common numbering where 60 is C4 (middle C).
- **Chords.** QMK has no chord keycodes. A keyboard adds them as custom keycodes in
  its firmware, and vial-web recognises them from the description in vial.json:
  a custom keycode is a chord when its `title` has a part in brackets, or is as a
  whole, made of nothing but two or more notes, such as
  `"Acorde Do Mayor (C4 - E4 - G4)"` or `"Sol3 Si3 Re4"`. Letter names are capitals
  (C, F#, Bb), so ordinary text like "Ctrl+F1 or F2" isn't taken for a chord; Do Re
  Mi names (Do, Fa#, Sol) may be in any case. Chord notes are absolute MIDI notes,
  as the firmware sends them. Notes outside the piano are named in a line above it.
- **Controls.** `MIDI_CONTROL_GROUPS` lists every non-note MIDI key with a plain
  name; a test checks none is missing.

`src/components/MidiPicker.tsx` draws it, and `KeyPicker` shows it in place of the
key grid for the MIDI tab. The demo keyboard has MIDI and four chord keys (C, Am, F,
G) to try it.

## For keyboard makers

To have chord keys show up as chords, write their notes in the custom keycode's
`title` in vial.json, for example:

```json
"customKeycodes": [
  { "name": "C_MAJ", "title": "C major (C4 - E4 - G4)", "shortName": "C" }
]
```

The firmware still has to play those notes when the key is pressed; the title only
tells vial-web which notes they are.
