// SPDX-License-Identifier: GPL-2.0-or-later
import { Button } from '@/components/ui/button'
import { RGBLIGHT_EFFECTS, VIALRGB_EFFECTS, type LightingState } from '@/core/lighting'
import { useApp } from '@/store'

/** VialRGB effects that ignore the chosen colour (they use rainbows or other fixed colours). */
const VIALRGB_RAINBOW = new Set([0, 1, 13, 14, 15, 16, 17, 18, 19, 20, 22, 23, 25, 27, 28, 29, 30, 43, 44])
/** Off and the still effects don't move, so speed does nothing. */
const VIALRGB_STILL = new Set([0, 1, 2, 3, 4, 5])

/** A CSS colour for a QMK hue/saturation pair (both 0-255), at full brightness. */
export function hsvColor(hue: number, sat: number, value = 255): string {
  const h = (hue / 255) * 360
  const s = sat / 255
  const v = value / 255
  // HSV to HSL, which CSS understands.
  const l = v * (1 - s / 2)
  const sl = l === 0 || l === 1 ? 0 : (v - l) / Math.min(l, 1 - l)
  return `hsl(${h.toFixed(0)} ${(sl * 100).toFixed(0)}% ${(l * 100).toFixed(0)}%)`
}

/** The colour the lighting shows, for the glow around the keyboard drawing. */
export function lightingGlow(lighting: LightingState): string | undefined {
  const v = lighting.vialrgb
  if (v && v.mode !== 0) return VIALRGB_RAINBOW.has(v.mode) ? 'rainbow' : hsvColor(v.hue, v.sat)
  const r = lighting.rgblight
  if (r && r.effect !== 0) return RGBLIGHT_EFFECTS[r.effect]?.color ? hsvColor(r.hue, r.sat) : 'rainbow'
  return undefined
}

/** Controls for every lighting system the keyboard has. Changes show on the keyboard right away. */
export function LightingPanel() {
  const { keyboard, setLighting, saveLighting } = useApp()
  if (!keyboard) return null
  const { backlight, rgblight, vialrgb } = keyboard.lighting

  return (
    <section aria-label="Lighting" className="flex w-full flex-col gap-4">
      {vialrgb && (
        <Group title="Key lights">
          <Field label="Effect">
            <select
              value={vialrgb.mode}
              onChange={(e) => setLighting({ vialrgb: { ...vialrgb, mode: Number(e.target.value) } })}
              className="h-10 w-full rounded-lg border border-line bg-field px-3 focus-visible:outline-2 focus-visible:outline-pick"
            >
              {vialrgb.effects.map((id) => (
                <option key={id} value={id}>
                  {VIALRGB_EFFECTS[id] ?? `Effect ${id}`}
                </option>
              ))}
            </select>
          </Field>
          <Slider
            label="Brightness"
            value={vialrgb.brightness}
            max={vialrgb.maxBrightness}
            onChange={(brightness) => setLighting({ vialrgb: { ...vialrgb, brightness } })}
          />
          {!VIALRGB_STILL.has(vialrgb.mode) && (
            <Slider label="Speed" value={vialrgb.speed} onChange={(speed) => setLighting({ vialrgb: { ...vialrgb, speed } })} />
          )}
          {vialrgb.mode !== 0 && !VIALRGB_RAINBOW.has(vialrgb.mode) && (
            <ColorFields hue={vialrgb.hue} sat={vialrgb.sat} onChange={(c) => setLighting({ vialrgb: { ...vialrgb, ...c } })} />
          )}
        </Group>
      )}

      {rgblight && (
        <Group title="RGB light strip">
          <Field label="Effect">
            <select
              value={rgblight.effect}
              onChange={(e) => setLighting({ rgblight: { ...rgblight, effect: Number(e.target.value) } })}
              className="h-10 w-full rounded-lg border border-line bg-field px-3 focus-visible:outline-2 focus-visible:outline-pick"
            >
              {RGBLIGHT_EFFECTS.map((effect, id) => (
                <option key={id} value={id}>
                  {effect.name}
                </option>
              ))}
            </select>
          </Field>
          <Slider
            label="Brightness"
            value={rgblight.brightness}
            onChange={(brightness) => setLighting({ rgblight: { ...rgblight, brightness } })}
          />
          {rgblight.effect > 1 && (
            <Slider label="Speed" value={rgblight.speed} max={3} onChange={(speed) => setLighting({ rgblight: { ...rgblight, speed } })} />
          )}
          {RGBLIGHT_EFFECTS[rgblight.effect]?.color && (
            <ColorFields hue={rgblight.hue} sat={rgblight.sat} onChange={(c) => setLighting({ rgblight: { ...rgblight, ...c } })} />
          )}
        </Group>
      )}

      {backlight && (
        <Group title="Backlight">
          <Slider
            label="Brightness"
            value={backlight.brightness}
            onChange={(brightness) => setLighting({ backlight: { ...backlight, brightness } })}
          />
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              className="size-5 accent-pick"
              checked={backlight.breathing}
              onChange={(e) => setLighting({ backlight: { ...backlight, breathing: e.target.checked } })}
            />
            Slowly fade in and out
          </label>
        </Group>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-ink-soft">Changes show on the keyboard right away. Save them to keep them after unplugging.</p>
        <Button className="bg-pick hover:bg-pick-skirt" onClick={saveLighting}>
          Save lighting
        </Button>
      </div>
    </section>
  )
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="grid gap-x-8 gap-y-4 rounded-2xl bg-panel p-4 sm:grid-cols-2 sm:p-5">
      <legend className="float-left mb-1 w-full text-lg font-bold sm:col-span-2">{title}</legend>
      {children}
    </fieldset>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="font-semibold">{label}</span>
      {children}
    </label>
  )
}

function Slider({
  label,
  value,
  max = 255,
  onChange,
  style,
}: {
  label: string
  value: number
  max?: number
  onChange(value: number): void
  style?: React.CSSProperties
}) {
  const percent = Math.round((value / max) * 100)
  return (
    <label className="flex flex-col gap-1.5">
      <span className="flex justify-between font-semibold">
        {label}
        <span className="font-normal text-ink-soft">{percent}%</span>
      </span>
      <input
        type="range"
        min={0}
        max={max}
        value={value}
        aria-label={label}
        aria-valuetext={`${percent}%`}
        onChange={(e) => onChange(Number(e.target.value))}
        style={style}
        className="h-2 w-full cursor-pointer appearance-none rounded-full bg-line accent-pick"
      />
    </label>
  )
}

const RAINBOW = `linear-gradient(to right, ${[0, 43, 85, 128, 170, 213, 255].map((h) => hsvColor(h, 255)).join(', ')})`

function ColorFields({ hue, sat, onChange }: { hue: number; sat: number; onChange(c: { hue: number; sat: number }): void }) {
  return (
    <>
      <div className="flex items-end gap-3">
        <span aria-hidden className="size-10 flex-none rounded-lg border border-line" style={{ background: hsvColor(hue, sat) }} />
        <div className="flex-1">
          <Slider label="Colour" value={hue} onChange={(h) => onChange({ hue: h, sat })} style={{ background: RAINBOW }} />
        </div>
      </div>
      <Slider
        label="Colour strength"
        value={sat}
        onChange={(s) => onChange({ hue, sat: s })}
        style={{ background: `linear-gradient(to right, ${hsvColor(hue, 0)}, ${hsvColor(hue, 255)})` }}
      />
    </>
  )
}
