# vial-web

A browser-based configurator for keyboards running [Vial](https://get.vial.today) firmware,
designed for people who have never edited a keymap before.

It is a port of [vial-gui](https://github.com/vial-kb/vial-gui).

## Status

Phase 1 (remap keys) is done and tested on a real keyboard. Phase 2 (everyday extras) is
merged and tested against the demo keyboard; see [docs/PHASE-2.md](docs/PHASE-2.md). The
full plan and the list of open issues are in [docs/ROADMAP.md](docs/ROADMAP.md).

- Connect a Vial keyboard over WebHID (Chrome or Edge), and reopen it with one click later.
- Change any key or knob from a searchable picker, on any layer. Undo and redo.
- Layout options such as split backspace.
- Save and restore `.vil` backups that also work in vial-gui.
- Unlock the keyboard when a change needs it (the bootloader key).
- Light and dark mode, following the system.
- Try everything without hardware using the demo keyboard.

- Build combined keys in plain words: shortcuts (Ctrl + C), tap for one key and hold for a
  modifier, or tap for one key and hold for a layer.

- Lighting: backlight, RGB light strips and per-key VialRGB, with a live colour preview.

- Key tester: press each key and see which ones work. In the demo, your own keyboard drives it.

- Macros: type text and press keys, built from plain steps, saved to the keyboard and in backups.

- Advanced: combos (press keys together for another key), and QMK settings such as tap-hold
  timing, key swaps and Auto Shift, each explained in plain words. Both are saved in backups.

Not yet: tap dance, key overrides, alt repeat keys, firmware flashing, and the desktop app.

## Development

```sh
npm ci
npm run dev        # http://localhost:5173
npm test           # unit tests
npm run test:e2e   # browser tests
npm run preview:netlify  # built site with Netlify's headers, http://localhost:4173
```

On Linux, the browser needs the Vial udev rules to open the keyboard:
https://get.vial.today/manual/linux-udev.html
