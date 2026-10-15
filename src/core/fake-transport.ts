// SPDX-License-Identifier: GPL-2.0-or-later
import type { HidTransport } from './transport'

/** In-memory keyboard for tests: maps a request prefix to a canned 32-byte reply. */
export class FakeTransport implements HidTransport {
  readonly sent: Uint8Array[] = []
  private readonly handler: (req: Uint8Array) => number[]

  constructor(handler: (req: Uint8Array) => number[]) {
    this.handler = handler
  }

  async send(report: Uint8Array): Promise<Uint8Array> {
    this.sent.push(report)
    const reply = new Uint8Array(32)
    reply.set(this.handler(report).slice(0, 32))
    return reply
  }

  async close(): Promise<void> {}
}
