// SPDX-License-Identifier: GPL-2.0-or-later
/** One 32-byte request out, one 32-byte reply back. Platform code implements this. */
export interface HidTransport {
  send(report: Uint8Array): Promise<Uint8Array>
  close(): Promise<void>
}

export const MSG_LEN = 32
