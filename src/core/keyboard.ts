// SPDX-License-Identifier: GPL-2.0-or-later
import { loadKeycodeCatalog, type CustomKeycode, type KeyboardCapabilities, type KeycodeCatalog } from './keycodes/catalog'
import type { EncoderKeymap } from './keymap-editor'
import { deserializeMacros, type Macro } from './macros'
import { lightingKind, readLighting, type LightingKind, type LightingState } from './lighting'
import {
  parseLayout,
  parseLayoutLabels,
  unpackLayoutChoices,
  type LayoutEncoder,
  type LayoutKey,
  type LayoutOption,
} from './layout'
import type { HidTransport } from './transport'
import { VialClient, type Decompress, type Keymap } from './vial-client'

/** Protocol versions vial-gui supports (protocol/keyboard_comm.py). */
const SUPPORTED_VIA_PROTOCOL = [9]
const SUPPORTED_VIAL_PROTOCOL = [0, 1, 2, 3, 4, 5, 6]

/** From protocol/constants.py. */
const VIAL_PROTOCOL_DYNAMIC = 4
const VIAL_PROTOCOL_KEY_OVERRIDE = 5

export interface VialDefinition {
  name?: string
  matrix: { rows: number; cols: number }
  layouts: { keymap: unknown[]; labels?: unknown[] }
  customKeycodes?: CustomKeycode[]
  vial?: { midi?: string }
  lighting?: string
}

export interface LoadedKeyboard {
  name: string
  /** Random id the firmware was built with; .vil backups use it to spot other keyboards. */
  keyboardId: bigint
  viaProtocol: number
  vialProtocol: number
  rows: number
  cols: number
  layers: number
  keys: LayoutKey[]
  encoders: LayoutEncoder[]
  keymap: Keymap
  /** encoderKeymap[layer][index] = [counter-clockwise, clockwise] */
  encoderKeymap: EncoderKeymap
  layoutOptions: LayoutOption[]
  /** Chosen value for each layout option, in the same order. */
  layoutChoices: number[]
  capabilities: KeyboardCapabilities
  lightingKind: LightingKind
  lighting: LightingState
  /** Bytes of macro memory, shared by all macros. */
  macroMemory: number
  macros: Macro[]
  catalog: KeycodeCatalog
}

export class UnsupportedKeyboardError extends Error {}

/** Reads everything needed to show a keyboard's layout and current keymap. Mirrors Keyboard.reload() in vial-gui. */
export async function loadKeyboard(
  transport: HidTransport,
  fallbackName: string,
  options: { decompress?: Decompress } = {},
): Promise<LoadedKeyboard> {
  const client = new VialClient(transport, options.decompress)

  const viaProtocol = await client.getViaProtocol()
  const { vialProtocol, keyboardId } = await client.getKeyboardId()
  if (!SUPPORTED_VIA_PROTOCOL.includes(viaProtocol) || !SUPPORTED_VIAL_PROTOCOL.includes(vialProtocol)) {
    throw new UnsupportedKeyboardError(
      `This keyboard uses VIA protocol ${viaProtocol} and Vial protocol ${vialProtocol}, which this app doesn't support yet. Update the keyboard's firmware to a recent Vial release.`,
    )
  }

  const definition = (await client.getDefinition()) as VialDefinition
  const { rows, cols } = definition.matrix
  const { keys, encoders } = parseLayout(definition.layouts.keymap)
  const layers = await client.getLayerCount()
  const capabilities = await readCapabilities(client, vialProtocol, layers, definition)
  const catalog = await loadKeycodeCatalog(vialProtocol, capabilities)
  const macroMemory = capabilities.macroCount ? await client.getMacroBufferSize() : 0
  const macros = macroMemory
    ? deserializeMacros(await client.getMacroBuffer(macroMemory, capabilities.macroCount), capabilities.macroCount, vialProtocol)
    : Array.from({ length: capabilities.macroCount }, (): Macro => [])
  const kind = lightingKind(definition)
  const lighting = await readLighting(client, kind)
  const keymap = await client.getKeymap(layers, rows, cols)

  const encoderCount = encoders.length ? Math.max(...encoders.map((e) => e.index)) + 1 : 0
  const encoderKeymap: EncoderKeymap = []
  for (let layer = 0; layer < layers; layer++) {
    encoderKeymap.push([])
    for (let index = 0; index < encoderCount; index++) {
      encoderKeymap[layer].push(await client.getEncoder(layer, index))
    }
  }

  const layoutOptions = parseLayoutLabels(definition.layouts.labels)
  const layoutChoices = layoutOptions.length ? unpackLayoutChoices(layoutOptions, await client.getLayoutOptions()) : []

  return {
    name: definition.name ?? fallbackName,
    keyboardId,
    viaProtocol,
    vialProtocol,
    rows,
    cols,
    layers,
    keys,
    encoders,
    keymap,
    encoderKeymap,
    layoutOptions,
    layoutChoices,
    capabilities,
    lightingKind: kind,
    lighting,
    macroMemory,
    macros,
    catalog,
  }
}

/** Ported from reload_macros_early() and reload_dynamic() in vial-gui. */
async function readCapabilities(
  client: VialClient,
  vialProtocol: number,
  layers: number,
  definition: VialDefinition,
): Promise<KeyboardCapabilities> {
  const macroCount = await client.getMacroCount()
  const features = new Set<string>()
  let tapDanceCount = 0

  if (vialProtocol >= VIAL_PROTOCOL_DYNAMIC) {
    const counts = await client.getDynamicEntryCounts()
    tapDanceCount = counts.tapDance
    counts.features.forEach((f) => features.add(f))
    // Unconditionally enabled in the QMK builds that shipped this protocol version.
    if (vialProtocol >= VIAL_PROTOCOL_KEY_OVERRIDE) features.add('persistent_default_layer')
    if (counts.altRepeatKey) features.add('repeat_key')
  }

  return {
    layers,
    macroCount,
    tapDanceCount,
    features,
    midi: definition.vial?.midi ?? null,
    customKeycodes: definition.customKeycodes ?? null,
  }
}
