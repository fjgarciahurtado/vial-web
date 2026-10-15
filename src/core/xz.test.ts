// SPDX-License-Identifier: GPL-2.0-or-later
import { describe, expect, it } from 'vitest'
import { decompressXz } from './xz'

// Python: lzma.compress(b'{"name":"Test Board"}') — the format Vial firmware embeds
const FIXTURE =
  'fd377a585a000004e6d6b4460200210116000000742fe5a30100147b226e616d65223a225465737420426f617264227d0000000003f53cd08b20eb8800012d152f0b716d1fb6f37d010000000004595a'

describe('decompressXz', () => {
  it('decodes a Python lzma stream', async () => {
    const bytes = Uint8Array.from(FIXTURE.match(/../g)!.map((h) => parseInt(h, 16)))
    const text = new TextDecoder().decode(await decompressXz(bytes))
    expect(JSON.parse(text)).toEqual({ name: 'Test Board' })
  })
})
