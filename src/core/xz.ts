// SPDX-License-Identifier: GPL-2.0-or-later
import { XzReadableStream } from 'xz-decompress'

/** Vial stores its definition as an xz stream (Python lzma default format). */
export async function decompressXz(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([bytes as BlobPart]).stream()
  const out = await new Response(new XzReadableStream(stream)).arrayBuffer()
  return new Uint8Array(out)
}
