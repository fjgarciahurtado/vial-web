# SPDX-License-Identifier: GPL-2.0-or-later
"""
Exports vial-gui's keycode tables to JSON so vial-web uses exactly the same
names, labels and numeric values.

Usage:
    python -I scripts/extract_keycodes.py ../vial-gui src/core/keycodes/data

Re-run after updating vial-gui. The output is committed; the app never runs this.
"""
import json
import random
import re
import sys
import types
from pathlib import Path


INDEXED = re.compile(r"^(?:M|USER|LT)(\d+)(?:\(kc\))?$|^(?:MO|DF|PDF|TG|TT|OSL|TO|TD)\((\d+)\)$")


def main(vial_gui: Path, out_dir: Path) -> None:
    sys.path.insert(0, str(vial_gui / "src" / "main" / "python"))
    # any_keycode.py imports simpleeval for free-form expressions. Every keycode
    # here resolves through the kc tables instead, so a stub avoids the dependency.
    sys.modules.setdefault("simpleeval", types.ModuleType("simpleeval"))
    from keycodes import keycodes as kcmod
    from keycodes.keycodes_v5 import keycodes_v5
    from keycodes.keycodes_v6 import keycodes_v6

    class EveryFeatureKeyboard:
        """Generates the largest keycode set; vial-web filters it per keyboard."""
        layers = 32
        macro_count = 256
        tap_dance_count = 256
        custom_keycodes = None
        midi = "advanced"
        supported_features = {"caps_word", "layer_lock", "persistent_default_layer", "repeat_key"}

    groups = [
        ("special", "KEYCODES_SPECIAL"),
        ("basic", "KEYCODES_BASIC"),
        ("shifted", "KEYCODES_SHIFTED"),
        ("iso", "KEYCODES_ISO"),
        ("layers", "KEYCODES_LAYERS"),
        ("boot", "KEYCODES_BOOT"),
        ("modifiers", "KEYCODES_MODIFIERS"),
        ("quantum", "KEYCODES_QUANTUM"),
        ("backlight", "KEYCODES_BACKLIGHT"),
        ("media", "KEYCODES_MEDIA"),
        ("tap_dance", "KEYCODES_TAP_DANCE"),
        ("macro", "KEYCODES_MACRO"),
        ("user", "KEYCODES_USER"),
        ("midi", "KEYCODES_MIDI"),
    ]

    out_dir.mkdir(parents=True, exist_ok=True)
    fixture_dir = out_dir.parent / "__fixtures__"
    fixture_dir.mkdir(parents=True, exist_ok=True)
    for protocol, table in ((5, keycodes_v5), (6, keycodes_v6)):
        keyboard = EveryFeatureKeyboard()
        keyboard.vial_protocol = protocol
        kcmod.recreate_keyboard_keycodes(keyboard)

        # KEYCODES_BASIC is extended with numpad and navigation keys; split them back out.
        subgroup = {}
        for attr, name in (("KEYCODES_BASIC_NUMPAD", "numpad"), ("KEYCODES_BASIC_NAV", "navigation"),
                           ("KEYCODES_MIDI_BASIC", "midi"), ("KEYCODES_MIDI_ADVANCED", "midi_advanced")):
            for kc in getattr(kcmod, attr):
                subgroup[kc.qmk_id] = name

        entries = []
        for group, attr in groups:
            for kc in getattr(kcmod, attr):
                if kc.qmk_id not in table.kc:
                    continue  # keycode exists only in the other protocol version
                entry = {
                    "id": kc.qmk_id,
                    "code": table.kc[kc.qmk_id],
                    "label": kc.label,
                    "group": subgroup.get(kc.qmk_id, group),
                }
                if kc.tooltip:
                    entry["tooltip"] = kc.tooltip
                if kc.masked:
                    entry["masked"] = True
                if len(kc.alias) > 1:
                    entry["alias"] = kc.alias[1:]
                if kc.requires_feature:
                    entry["feature"] = kc.requires_feature
                if kc.printable:
                    entry["printable"] = kc.printable
                # Layer number, macro number, etc. vial-web shows only those the keyboard has.
                index = INDEXED.match(kc.qmk_id)
                if index:
                    entry["index"] = int(index.group(1) or index.group(2))
                entries.append(entry)

        data = {
            "protocol": protocol,
            "masked": sorted(table.masked),
            "keycodes": entries,
        }
        path = out_dir / f"keycodes-v{protocol}.json"
        path.write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
        print(f"{path}: {len(entries)} keycodes")

        # Reference answers from vial-gui's own serializer, for the parity test.
        rng = random.Random(protocol)
        codes = {e["code"] for e in entries}
        codes |= {m | inner for m in table.masked for inner in (0x00, 0x04, 0x1E, 0x2C, 0xE1, 0xFF)}
        codes |= {rng.randrange(0x10000) for _ in range(2000)}
        kcmod.Keycode.protocol = protocol
        samples = {str(c): kcmod.Keycode.serialize(c) for c in sorted(codes)}
        fixture = fixture_dir / f"serialize-v{protocol}.json"
        fixture.write_text(json.dumps(samples, indent=0) + "\n", encoding="utf-8")
        print(f"{fixture}: {len(samples)} samples")


if __name__ == "__main__":
    main(Path(sys.argv[1]), Path(sys.argv[2]))
