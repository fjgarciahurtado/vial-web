// SPDX-License-Identifier: GPL-2.0-or-later
import type { VialClient } from './vial-client'

interface UnlockOptions {
  /** Called once with the keys the person must hold down. */
  onStart(keys: { row: number; col: number }[]): void
  /** 0 to 1. Drops back when the keys are released, as the firmware restarts its count. */
  onProgress(fraction: number): void
  intervalMs?: number
}

/**
 * Unlocks the keyboard so it accepts risky changes such as the bootloader key.
 * Ported from Unlocker in vial-gui unlocker.py. The firmware decides when it is
 * unlocked; there is no cancel, so the only way out is finishing or unplugging.
 */
export async function unlockKeyboard(client: VialClient, options: UnlockOptions): Promise<void> {
  const { onStart, onProgress, intervalMs = 200 } = options
  const status = await client.getUnlockStatus()
  if (status.unlocked) return

  onStart(status.keys)
  if (!status.inProgress) await client.unlockStart()

  let most = 1
  for (;;) {
    const { unlocked, remaining } = await client.unlockPoll()
    most = Math.max(most, remaining)
    onProgress(unlocked ? 1 : (most - remaining) / most)
    if (unlocked) return
    await new Promise((resolve) => setTimeout(resolve, intervalMs))
  }
}
