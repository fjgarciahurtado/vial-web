# vial-web

A browser-based configurator for keyboards running [Vial](https://get.vial.today) firmware,
designed for people who have never edited a keymap before.

It is a port of [vial-gui](https://github.com/vial-kb/vial-gui).

## Status

Phase 1 (remap keys) is built; see [docs/ROADMAP.md](docs/ROADMAP.md). It has only been
tested against the built-in demo keyboard so far, not real hardware.

- Connect a Vial keyboard over WebHID (Chrome or Edge), and reopen it with one click later.
- Change any key or knob from a searchable picker, on any layer. Undo and redo.
- Layout options such as split backspace.
- Save and restore `.vil` backups that also work in vial-gui.
- Unlock the keyboard when a change needs it (the bootloader key).
- Light and dark mode, following the system.
- Try everything without hardware using the demo keyboard.

- Build combined keys in plain words: shortcuts (Ctrl + C), tap for one key and hold for a
  modifier, or tap for one key and hold for a layer.

Not yet: macros, lighting, key tester, tap dance, combos, firmware flashing, and the
desktop app.

## Development

```sh
npm ci
npm run dev        # http://localhost:5173
npm test           # unit tests
npm run test:e2e   # browser tests
```

On Linux, the browser needs the Vial udev rules to open the keyboard:
https://get.vial.today/manual/linux-udev.html
