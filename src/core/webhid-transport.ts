// SPDX-License-Identifier: GPL-2.0-or-later
import { MSG_LEN, type HidTransport } from './transport'

/** QMK raw HID interface, which VIA and Vial both use. */
export const RAW_HID_FILTER: HIDDeviceFilter = { usagePage: 0xff60, usage: 0x61 }

const TIMEOUT_MS = 500
const RETRIES = 20

export function isWebHidSupported(): boolean {
  return typeof navigator !== 'undefined' && 'hid' in navigator
}

/** Browser transport over WebHID. Requests run one at a time, like hidapi in vial-gui. */
export class WebHidTransport implements HidTransport {
  readonly device: HIDDevice
  private queue: Promise<unknown> = Promise.resolve()

  private constructor(device: HIDDevice) {
    this.device = device
  }

  /** Shows the browser's device picker. Returns null when the user cancels. */
  static async request(): Promise<WebHidTransport | null> {
    const [device] = await navigator.hid.requestDevice({ filters: [RAW_HID_FILTER] })
    return device ? WebHidTransport.open(device) : null
  }

  /** Opens a keyboard the browser already has permission for, without the picker. */
  static async open(device: HIDDevice): Promise<WebHidTransport> {
    if (!device.opened) await device.open()
    return new WebHidTransport(device)
  }

  /** Keyboards this site was allowed to use before, plugged in right now. */
  static async known(): Promise<HIDDevice[]> {
    const devices = await navigator.hid.getDevices()
    return devices.filter((d) =>
      d.collections.some((c) => c.usagePage === RAW_HID_FILTER.usagePage && c.usage === RAW_HID_FILTER.usage),
    )
  }

  /** Calls back once when this keyboard is unplugged. Returns a function that stops listening. */
  onUnplug(callback: () => void): () => void {
    const listener = (event: HIDConnectionEvent) => {
      if (event.device === this.device) callback()
    }
    navigator.hid.addEventListener('disconnect', listener)
    return () => navigator.hid.removeEventListener('disconnect', listener)
  }

  send(report: Uint8Array): Promise<Uint8Array> {
    const run = this.queue.then(() => this.sendWithRetries(report))
    this.queue = run.catch(() => undefined)
    return run
  }

  private async sendWithRetries(report: Uint8Array): Promise<Uint8Array> {
    for (let attempt = 0; attempt < RETRIES; attempt++) {
      if (!this.device.opened) throw new Error('The keyboard was unplugged.')
      const reply = await this.sendOnce(report)
      if (reply) return reply
    }
    throw new Error('The keyboard stopped responding.')
  }

  private sendOnce(report: Uint8Array): Promise<Uint8Array | null> {
    return new Promise((resolve) => {
      const timer = setTimeout(() => finish(null), TIMEOUT_MS)
      const onReport = (event: HIDInputReportEvent) => {
        finish(new Uint8Array(event.data.buffer, event.data.byteOffset, MSG_LEN).slice())
      }
      const finish = (value: Uint8Array | null) => {
        clearTimeout(timer)
        this.device.removeEventListener('inputreport', onReport)
        resolve(value)
      }
      this.device.addEventListener('inputreport', onReport)
      this.device.sendReport(0, report as Uint8Array<ArrayBuffer>).catch(() => finish(null))
    })
  }

  async close(): Promise<void> {
    if (this.device.opened) await this.device.close()
  }
}
