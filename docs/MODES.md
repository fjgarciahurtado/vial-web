# Phase 3.6: Modes

People use vial-web for different things. Someone remapping a few keys doesn't need
tap dance or combos, and someone setting up a MIDI pad doesn't need letters or
shortcuts. Modes show each of them only what they need.

## What users see

A **Mode** switch sits in the header, beside the app's name. It is remembered for each
keyboard, in the browser.

- **Easy**: the Keys, Lighting, Macros and Key tester sections. The key picker offers everyday
  keys (letters and numbers, modifiers, symbols, navigation, numpad, media and mouse,
  international), the builder for shortcuts and hold keys, layers, lighting keys and
  macros. Search finds only those keys.
- **Advanced**: everything, as before modes existed: the key tester, the Advanced
  section (tap dance, combos, key overrides, alt repeat keys, typing settings) and
  every kind of key.
- **Musician**: only on keyboards that play MIDI. The Keys, Lighting and Macros
  sections, with Keys and Macros made for music (below).

Keyboards that play MIDI start in Musician; others start in Easy. The demo keyboard
starts in Advanced, so it shows everything the app can do. Switching to a mode
without the current section goes back to Keys.

### Musician: Keys

The keyboard's keys are called **pads** and numbered in reading order (rows from the
top, each row from the left); the number shows in the corner of each pad.

Under the pads, the key picker shows the piano across the whole width. Each piano key
carries the numbers of the pads that play it, so the whole instrument can be read at a
glance. Pointing at a piano key lights the pads that play it. Clicking one puts that
note on the chosen pad.

The tabs above the piano: **Notes**, **Chords** (the keyboard's chord keys, with their
notes lit on the piano), **Octave, pedals and more** (the other MIDI keys), **Layers**,
**Macros**, **Lighting** and **Blank** (Nothing, and Same as layer below). Choosing a
pad opens the tab that holds what it does now.

### Musician: Macros

Each macro is a **phrase**: a list of steps, each a note, a chord or a rest, with a
length.

- **Tempo**, in beats a minute. Changing it changes every step, keeping its note
  length. The keyboard only stores times, so the tempo is remembered in the browser,
  for each macro.
- **New notes last**: the length of the steps the piano adds.
- **Record**, on by default: each piano key clicked adds a step with that note.
- Choosing a step turns recording off. The piano then adds notes to that step or takes
  them out, to build a chord. Each step has its length (whole to sixteenth, with the
  dotted ones), and can be moved or removed. **Add a rest** adds a silent step.
- **Play** previews the phrase through the computer's speakers with a simple synth.
  The real sound comes from the music app the keyboard plays.

Macros that do more than play notes (typing text, for example) are left as they are,
with a button to clear them and write a phrase instead. Phrases are saved like any
other macro, with the same memory meter and the same unlock step.

## How it works

- `src/core/profiles.ts` lists each mode's sections and picker tabs, and which modes
  suit a keyboard (`profilesFor`, `defaultProfile`, `usableProfile`). The store keeps
  the mode in `profile` and saves it under `vial-web:mode:<keyboard id>`.
- `numberKeys()` in `src/core/layout.ts` numbers the pads.
- `src/core/phrases.ts` turns a phrase into a macro and back. A step with notes is
  `down` (its notes), `delay` (its time), `up` (the same notes); a rest is a `delay`.
  Any other macro reads back as null, so it is never changed by accident.
- A macro can press MIDI keys because Vial runs every 16-bit key in a macro through
  QMK's normal key handling (`vial_keycode_down()` in vial-qmk `quantum/vial.c`), as a
  pad does. A macro plays to the end on its own, so its notes last as long as the
  phrase says, not as long as the pad is held; the chord keys built into the firmware
  are the way to hold a chord for as long as the pad is down.
- Phrases need delays, which arrived in Vial protocol 2. Older firmware gets a message
  instead of the editor.
- `src/components/MusicianPicker.tsx` and `MusicianMacros.tsx` are the Musician views;
  they reuse the piano and chord pieces of `MidiPicker.tsx`. `src/lib/preview-sound.ts`
  plays the preview with the Web Audio API.

## Testing

- Unit tests: `profiles.test.ts`, `phrases.test.ts` (including a round trip through
  the keyboard's byte format) and `numberKeys` in `layout.test.ts`.
- Browser tests on the demo keyboard: `e2e/modes.spec.ts` and `e2e/phrases.spec.ts`.
- Tested on real hardware: a phrase saved to kb8knob/midi and played from a pad.
