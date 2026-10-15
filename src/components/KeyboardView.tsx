// SPDX-License-Identifier: GPL-2.0-or-later
import type React from 'react'
import type { KeycodeCatalog, KeycodeGroup } from '@/core/keycodes/catalog'
import { placeKeys, type LayoutEncoder, type LayoutKey } from '@/core/layout'
import type { Selection } from '@/store'

const U = 56 // pixels per key unit
const GAP = 3 // gap between neighbouring caps
const PAD = 18 // case border around the keys

interface Props {
  keys: LayoutKey[]
  encoders?: LayoutEncoder[]
  /** Keycodes for the shown layer: keycodes[row][col]. */
  keycodes: number[][]
  /** Encoder keycodes for the shown layer: encoderCodes[index] = [left, right]. */
  encoderCodes?: [number, number][]
  layoutChoices?: number[]
  catalog: KeycodeCatalog
  selected?: Selection | null
  /** Keys drawn in the accent colour, such as the keys to hold for unlocking. */
  highlighted?: { row: number; col: number }[]
  /** Keys drawn green, such as keys that passed the key test. */
  passed?: { row: number; col: number }[]
  /** Leave out to draw a decorative, non-interactive keyboard. */
  onSelect?(selection: Selection): void
  /** Size classes for the drawing; it keeps its shape and centres inside them. */
  className?: string
  /** Light around the case, like underglow: a CSS colour, or "rainbow". */
  glow?: string
}

const TONES = {
  cap: { top: 'fill-cap', skirt: 'fill-cap-skirt', text: 'fill-legend' },
  mod: { top: 'fill-mod', skirt: 'fill-mod-skirt', text: 'fill-white' },
  pick: { top: 'fill-pick', skirt: 'fill-pick-skirt', text: 'fill-white' },
  ok: { top: 'fill-ok', skirt: 'fill-ok-skirt', text: 'fill-legend' },
}

/** Keys that type characters get light caps; everything else gets darker caps, like a real board. */
const TYPING_GROUPS = new Set<KeycodeGroup | undefined>(['basic', 'shifted', 'numpad', 'iso', 'special'])
const DARK_BASIC_KEYS = new Set([0x28, 0x29, 0x2a, 0x2b, 0x39, 0x65, 0xe0, 0xe1, 0xe2, 0xe3, 0xe4, 0xe5, 0xe6, 0xe7])

const TURNS = [
  { name: 'Turn left', arrow: '↺' },
  { name: 'Turn right', arrow: '↻' },
]

/** Draws the keyboard as keycaps on a case. Keys are buttons, so it works with Tab and Enter too. */
export function KeyboardView({
  keys,
  encoders = [],
  keycodes,
  encoderCodes = [],
  layoutChoices = [],
  catalog,
  selected,
  highlighted = [],
  passed = [],
  onSelect,
  className = 'w-full max-w-5xl',
  glow,
}: Props) {
  const placed = placeKeys<LayoutKey | LayoutEncoder>([...keys, ...encoders], layoutChoices)
  const width = Math.max(...placed.map((k) => k.x + k.w)) * U + PAD * 2
  const height = Math.max(...placed.map((k) => k.y + k.h)) * U + PAD * 2

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={`${className} overflow-visible transition-[filter] duration-300`}
      style={{ filter: glowFilter(glow) }}
      role={onSelect ? 'group' : 'img'}
      aria-label="Keyboard layout"
    >
      <rect width={width} height={height} rx={16} className="fill-case" />
      {placed.map((item) => {
        const isKey = 'row' in item
        const selection: Selection = isKey
          ? { kind: 'key', row: item.row, col: item.col }
          : { kind: 'encoder', index: item.index, direction: item.direction }
        const code = isKey ? (keycodes[item.row]?.[item.col] ?? 0) : (encoderCodes[item.index]?.[item.direction] ?? 0)
        const { name, legend, group } = catalog.describe(code)
        const isSelected =
          sameSelection(selected, selection) || (isKey && highlighted.some((h) => h.row === item.row && h.col === item.col))
        const isTyping = TYPING_GROUPS.has(group) && !DARK_BASIC_KEYS.has(code)
        const hasPassed = isKey && passed.some((p) => p.row === item.row && p.col === item.col)
        const tone = TONES[isSelected ? 'pick' : hasPassed ? 'ok' : isTyping ? 'cap' : 'mod']
        const turn = isKey ? null : TURNS[item.direction]
        const label = turn ? `Knob ${turn.name.toLowerCase()}: ${name}` : `Key ${name}`

        const x = PAD + item.x * U + GAP / 2
        const y = PAD + item.y * U + GAP / 2
        const w = item.w * U - GAP
        const h = item.h * U - GAP
        const { angle, x: rx, y: ry } = item.rotation
        const { lines, fontSize } = legendLines(legend, w)
        const lineHeight = fontSize + 2
        const radius = Math.min(w, h) / 2

        return (
          <g
            key={isKey ? `k${item.row},${item.col},${item.x},${item.y}` : `e${item.index},${item.direction}`}
            transform={angle ? `rotate(${angle} ${PAD + rx * U} ${PAD + ry * U})` : undefined}
            {...(onSelect && {
              role: 'button',
              tabIndex: 0,
              'aria-pressed': isSelected,
              'aria-label': label,
              className:
                'cursor-pointer outline-none [&:focus-visible>:nth-child(2)]:stroke-pick [&:focus-visible>:nth-child(2)]:stroke-[3]',
              onClick: () => onSelect(selection),
              onKeyDown: (e: React.KeyboardEvent) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onSelect(selection)
                }
              },
            })}
          >
            <title>{turn ? `${turn.name}: ${name}` : name}</title>
            {turn ? (
              <>
                <circle cx={x + w / 2} cy={y + h / 2} r={radius} className={`${tone.skirt} transition-colors`} />
                <circle cx={x + w / 2} cy={y + h / 2 - 1.5} r={radius - 5} className={`${tone.top} transition-colors`} />
                <text
                  x={x + w / 2}
                  y={y + h / 2 - 3}
                  textAnchor="middle"
                  className={`pointer-events-none select-none font-sans text-[15px] font-bold ${tone.text}`}
                >
                  {turn.arrow}
                  <tspan x={x + w / 2} dy={13} className="text-[10px] font-semibold">
                    {fitText(legend.join(' '), w - 12, 6.5)}
                  </tspan>
                </text>
              </>
            ) : (
              <>
                <rect x={x} y={y} width={w} height={h} rx={7} className={`${tone.skirt} transition-colors`} />
                <rect
                  x={x + 5}
                  y={y + 3}
                  width={w - 10}
                  height={h - 11}
                  rx={5}
                  className={`${tone.top} transition-[fill,transform] duration-150 ${isSelected ? '-translate-y-0.5' : ''}`}
                />
                <text
                  x={x + 11}
                  y={y + 8 + fontSize}
                  style={{ fontSize }}
                  className={`pointer-events-none select-none font-sans font-semibold ${tone.text}`}
                >
                  {lines.map((line, i) => (
                    <tspan key={i} x={x + 11} dy={i === 0 ? 0 : lineHeight}>
                      {line}
                    </tspan>
                  ))}
                </text>
              </>
            )}
          </g>
        )
      })}
    </svg>
  )
}

function sameSelection(a: Selection | null | undefined, b: Selection): boolean {
  if (!a || a.kind !== b.kind) return false
  return a.kind === 'key' && b.kind === 'key'
    ? a.row === b.row && a.col === b.col
    : a.kind === 'encoder' && b.kind === 'encoder' && a.index === b.index && a.direction === b.direction
}

/** Average glyph width as a share of the font size, for the legend font. */
const CHAR_WIDTH = 0.58
const MAX_FONT = 13
const MIN_FONT = 8

/**
 * Fits legend lines to the cap: a long single legend splits at its first space
 * ("Right Shift"), then the font shrinks until the longest line fits. Only text
 * that still doesn't fit at the smallest size is shortened.
 */
function legendLines(legend: string[], width: number): { lines: string[]; fontSize: number } {
  const room = width - 16
  let lines = legend.slice(0, 3)
  if (lines.length === 1 && lines[0].length * CHAR_WIDTH * MAX_FONT > room && lines[0].includes(' ')) {
    const space = lines[0].indexOf(' ')
    lines = [lines[0].slice(0, space), lines[0].slice(space + 1)]
  }
  const longest = Math.max(1, ...lines.map((l) => l.length))
  const cap = lines.length > 2 ? 10 : MAX_FONT
  const fontSize = Math.max(MIN_FONT, Math.min(cap, room / (longest * CHAR_WIDTH)))
  return { lines: lines.map((l) => fitText(l, room, fontSize * CHAR_WIDTH)), fontSize }
}

function fitText(text: string, width: number, charWidth = 7.5): string {
  const max = Math.max(1, Math.floor(width / charWidth))
  return text.length > max ? `${text.slice(0, max - 1)}…` : text
}

const SHADOW = 'drop-shadow(0 16px 24px rgb(29 39 49 / 0.28))'
const RAINBOW_GLOW = [
  'drop-shadow(-14px -6px 16px hsl(0 90% 60% / 0.7))',
  'drop-shadow(14px -6px 16px hsl(120 90% 50% / 0.7))',
  'drop-shadow(0 12px 16px hsl(230 90% 60% / 0.7))',
].join(' ')

function glowFilter(glow: string | undefined): string {
  if (!glow) return SHADOW
  if (glow === 'rainbow') return RAINBOW_GLOW
  return `drop-shadow(0 0 18px ${glow}) drop-shadow(0 10px 20px ${glow})`
}

