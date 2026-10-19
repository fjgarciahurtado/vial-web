// SPDX-License-Identifier: GPL-2.0-or-later
/**
 * Plays a phrase through the computer's speakers with a simple synth, so it can be
 * heard before it is saved. This is only a preview: the keyboard sends MIDI to the
 * music app, which picks the real sound.
 */
import type { Phrase } from '@/core/phrases'

let audio: AudioContext | null = null

const frequency = (note: number) => 440 * 2 ** ((note - 69) / 12)

/** Starts playing. Returns a function that stops it; onEnd runs when it ends either way. */
export function playPhrase(phrase: Phrase, onEnd: () => void): () => void {
  audio ??= new AudioContext()
  const ctx = audio
  void ctx.resume()
  const out = ctx.createGain()
  out.connect(ctx.destination)
  let at = ctx.currentTime + 0.05
  for (const step of phrase) {
    const seconds = step.ms / 1000
    for (const note of step.notes) {
      const osc = ctx.createOscillator()
      const env = ctx.createGain()
      osc.type = 'triangle'
      osc.frequency.value = frequency(note)
      // A short fade in and out avoids clicks; chords share the volume.
      const level = 0.25 / Math.max(1, step.notes.length)
      const release = Math.min(0.05, seconds / 2)
      env.gain.setValueAtTime(0, at)
      env.gain.linearRampToValueAtTime(level, at + Math.min(0.01, seconds / 4))
      env.gain.setValueAtTime(level, at + seconds - release)
      env.gain.linearRampToValueAtTime(0, at + seconds)
      osc.connect(env).connect(out)
      osc.start(at)
      osc.stop(at + seconds)
    }
    at += seconds
  }
  const timer = setTimeout(finish, (at - ctx.currentTime) * 1000)
  let done = false
  function finish() {
    if (done) return
    done = true
    clearTimeout(timer)
    out.gain.setValueAtTime(0, ctx.currentTime)
    out.disconnect()
    onEnd()
  }
  return finish
}
