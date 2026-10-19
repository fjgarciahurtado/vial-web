// SPDX-License-Identifier: GPL-2.0-or-later
/**
 * The Learn section's lessons: short tasks, one per page, for each mode. Each lesson
 * names the section it happens in, so "Try it" can open the demo keyboard there.
 *
 * Pictures are in public/learn/<lesson id>.jpg, taken from the demo keyboard by
 * `npm run learn:shots` (e2e-learn/learn.shots.ts). Run it again after changing the UI.
 */
import type { Profile, Section } from '@/core/profiles'

export interface Lesson {
  /** Used in the address (#learn/<id>) and as the picture's file name. */
  id: string
  /** The modes that list this lesson. It comes first among the lessons of the first one. */
  modes: Profile[]
  title: string
  /** One sentence: what you'll be able to do. */
  goal: string
  /** Where the lesson starts. */
  section: Section
  steps: string[]
  /** How to see that it worked. */
  check: string
  /** Something worth knowing, shown after the steps. */
  tip?: string
}

/** The modes in the order Learn shows them, with who each is for. */
export const LEARN_MODES: { mode: Profile; intro: string }[] = [
  {
    mode: 'easy',
    intro:
      'For changing what keys do: everyday keys, shortcuts, layers, macros and lighting. Start here if you are new.',
  },
  {
    mode: 'musician',
    intro:
      'For keyboards that play music. The keys are pads, the piano shows which pad plays each note, and macros are short phrases of notes.',
  },
  {
    mode: 'advanced',
    intro:
      'Everything in Easy, plus tap dance, combos, key overrides, Alt Repeat and typing settings. For people who want to fine-tune. New to the app? Do the Easy lessons first.',
  },
]

export const LESSONS: Lesson[] = [
  // Easy
  {
    id: 'change-a-key',
    modes: ['easy'],
    title: 'Change what a key does',
    goal: 'Make any key do something else, such as turning the volume up.',
    section: 'keys',
    steps: [
      'Go to **Keys**.',
      'Click the key you want to change in the drawing of your keyboard. It turns a different colour.',
      'Below the keyboard, choose a tab, such as **Media & mouse**.',
      'Click what the key should do, such as **Volume Up**. The change is saved on the keyboard straight away.',
      'Changed your mind? Click **Undo change**, or press Ctrl + Z.',
    ],
    check: 'Press the key on your keyboard. The message under the drawing also says "Saved. This key is now …".',
    tip: 'Changes live in the keyboard itself, so they work on any computer, even without this page open.',
  },
  {
    id: 'search-keys',
    modes: ['easy'],
    title: 'Find a key by name',
    goal: 'Find a key without looking through the tabs.',
    section: 'keys',
    steps: [
      'Go to **Keys** and click the key you want to change.',
      'Type what you are looking for in **Search keys**, in plain words: "copy", "next track", "brightness".',
      'Click the key you want from the results.',
    ],
    check: 'The key in the drawing shows its new name.',
  },
  {
    id: 'shortcut-key',
    modes: ['easy'],
    title: 'Make a shortcut key',
    goal: 'Make one key press several keys at once, such as Ctrl + C to copy.',
    section: 'keys',
    steps: [
      'Go to **Keys** and click the key you want to change.',
      'Choose the **Shortcuts & holds** tab, then **Shortcut**.',
      'Choose the keys to hold, such as **Ctrl**.',
      'Choose the key to press with them, such as **C**. The sentence at the bottom says what the key will do.',
      'Click **Use on this key**.',
    ],
    check: 'Select some text and press the key: it copies, as Ctrl + C does.',
  },
  {
    id: 'tap-or-hold',
    modes: ['easy'],
    title: 'Tap for one thing, hold for another',
    goal: 'Make a key do two jobs, such as Caps Lock tapping Escape and holding Ctrl.',
    section: 'keys',
    steps: [
      'Go to **Keys** and click the key, such as **Caps Lock**.',
      'Choose the **Shortcuts & holds** tab, then **Tap or hold: modifier**.',
      'Choose what holding it does, such as **Ctrl**.',
      'Search for and choose what a tap does, such as **Escape**.',
      'Check the sentence at the bottom, then click **Use on this key**.',
    ],
    check: 'Tap the key: Escape. Hold it and press C: Ctrl + C.',
    tip: 'Choose **Tap or hold: layer** instead to make holding the key switch to another layer.',
  },
  {
    id: 'layers',
    modes: ['easy'],
    title: 'Use layers',
    goal: 'Give keys a second job, used while you hold a layer key, like the Fn key on a laptop.',
    section: 'keys',
    steps: [
      'Go to **Keys**. The tabs above the keyboard are its layers: **Main layer** is what keys do normally.',
      'On the **Main layer**, click a key you rarely use, choose the **Layers** tab and click **L1 hold** (hold for layer 1).',
      'Click the **Layer 1** tab above the keyboard. These are the keys used while that key is held.',
      'Change keys on Layer 1, as on the main layer. For example, make the number keys F1 to F12.',
      'Keys showing ▽ are **Same as the layer below**: they do what they do on the main layer.',
    ],
    check: 'Hold your layer key and press a key you changed on Layer 1.',
    tip: 'Leave the layer key itself as Same as the layer below on Layer 1, or you may not be able to let go of the layer.',
  },
  {
    id: 'macro',
    modes: ['easy'],
    title: 'Type text with one key',
    goal: 'Make a macro: one key that types a sentence or presses several keys in a row.',
    section: 'macros',
    steps: [
      'Go to **Macros** and choose a macro from the list.',
      'Click **Type text** and write what the key should type.',
      'Add more steps if you like: **Press a key** (such as Enter), **Hold a key down**, **Let go of a key**, **Wait**.',
      'Click **Save macros**. The keyboard asks to be unlocked the first time: hold the keys it highlights until the bar is full.',
      'Go to **Keys**, click a key, choose the **Macros** tab and click your macro.',
    ],
    check: 'Open a text editor and press the key: it types your text.',
    tip: 'The bar under the list shows how much macro memory is left on the keyboard.',
  },
  {
    id: 'lighting',
    modes: ['easy', 'musician'],
    title: 'Change the lights',
    goal: 'Choose the lighting effect, colour, brightness and speed.',
    section: 'lighting',
    steps: [
      'Go to **Lighting**. Changes show on the keyboard straight away.',
      'Choose an **Effect**, such as **Solid Color** or **Breathing**.',
      'Set the **Colour**, **Brightness** and, for moving effects, the **Speed**.',
      'Click **Save lighting** to keep it after unplugging.',
    ],
    check: 'Unplug the keyboard and plug it back in: the lights come back as you saved them.',
    tip: 'Only keyboards with lights show the Lighting section.',
  },
  {
    id: 'key-tester',
    modes: ['easy'],
    title: 'Check that every key works',
    goal: 'Find keys that don’t work, for example after building or cleaning a keyboard.',
    section: 'tester',
    steps: [
      'Go to **Key tester** and click **Unlock to test**. Hold the highlighted keys until the bar is full.',
      'Press every key on the keyboard once. Each one turns blue while held and green once it has worked.',
      'The count says how many keys work so far. Click **Start again** to clear it.',
    ],
    check: 'Every key in the drawing is green. A key that stays grey may not be working.',
    tip: 'The tester shows the switch itself, whatever the key is set to do, so it works even on layers and macros.',
  },
  {
    id: 'backup',
    modes: ['easy', 'musician'],
    title: 'Keep a backup',
    goal: 'Save all your keys to a file, and bring them back later.',
    section: 'keys',
    steps: [
      'At the bottom of the page, click **Save backup**. A .vil file is downloaded.',
      'To bring it back, click **Restore backup** and choose the file.',
      'Read the warning, then click **Restore anyway**. **Undo change** puts things back if it was the wrong file.',
    ],
    check: 'Change a key, restore your backup and see the key come back.',
    tip: 'Backup files also open in the Vial desktop app.',
  },

  // Musician
  {
    id: 'pads-and-piano',
    modes: ['musician'],
    title: 'Read the pads and the piano',
    goal: 'See at a glance which pad plays which note.',
    section: 'keys',
    steps: [
      'Choose **Musician** in the Mode switch at the top. It shows only on keyboards that play music.',
      'Go to **Keys**. Each key is a **pad**, numbered in the corner, row by row from the top left.',
      'Under the pads, the piano shows the number of every pad that plays each note.',
      'Point at a piano key: the pads that play it light up.',
      'Prefer Do Re Mi, or middle C called C3? Use the switches above the piano.',
    ],
    check: 'Point at a piano key with a number on it, and its pad lights up.',
  },
  {
    id: 'note-on-a-pad',
    modes: ['musician'],
    title: 'Put a note on a pad',
    goal: 'Choose the note each pad plays.',
    section: 'keys',
    steps: [
      'Go to **Keys** and click a pad.',
      'In the **Notes** tab, click a piano key. The pad plays that note from now on.',
      'Click the next pad and choose its note, and so on.',
      'Made a mistake? Click **Undo change**, or press Ctrl + Z.',
    ],
    check: 'Open your music app, choose the keyboard as its MIDI input, and press the pad.',
    tip: 'Notes follow the Octave keys: with Octave up on a pad, every note pad plays an octave higher.',
  },
  {
    id: 'chord-on-a-pad',
    modes: ['musician'],
    title: 'Put a chord on a pad',
    goal: 'Play a whole chord with one pad.',
    section: 'keys',
    steps: [
      'Go to **Keys** and click a pad.',
      'Choose the **Chords** tab. Point at a chord to see its notes lit on the piano.',
      'Click the chord. The pad plays all its notes for as long as it is held.',
    ],
    check: 'Press the pad and hear the whole chord in your music app.',
    tip: 'The chords come from the keyboard’s firmware, so each keyboard can offer different ones. Keyboards without chord keys don’t show this tab.',
  },
  {
    id: 'octave-and-pedals',
    modes: ['musician'],
    title: 'Octave, pedals and more',
    goal: 'Add pads that change octave, transpose, or work like a sustain pedal.',
    section: 'keys',
    steps: [
      'Go to **Keys** and click a pad.',
      'Choose the **Octave, pedals and more** tab.',
      'Choose a key, such as **Octave up**, **Octave down** or **Sustain pedal**.',
    ],
    check: 'Press Octave up, then a note pad: the note sounds an octave higher.',
    tip: 'Pedals work while the pad is held, like a real pedal.',
  },
  {
    id: 'musician-layers',
    modes: ['musician'],
    title: 'Switch sounds with layers',
    goal: 'Give the pads a second set of notes, used while you hold a layer pad.',
    section: 'keys',
    steps: [
      'Go to **Keys**, click a pad and choose the **Layers** tab.',
      'Click **L1 hold** (hold for layer 1). This pad now switches the others while it is held.',
      'Click the **Layer 1** tab above the pads and give the pads other notes.',
      'Pads set to **Same as the layer below** (in the **Blank** tab) keep their main-layer note.',
    ],
    check: 'Hold the layer pad and press another pad: it plays its Layer 1 note.',
    tip: 'Choose **L1 toggle** instead to switch with a tap and stay there until the next tap.',
  },
  {
    id: 'write-a-phrase',
    modes: ['musician'],
    title: 'Write a phrase',
    goal: 'Make a pad play a short tune or chord progression on its own.',
    section: 'macros',
    steps: [
      'Go to **Macros** and choose a macro from the list.',
      'Set the **Tempo** and the length of **New notes last**, such as a quarter note.',
      'With **Recording** on, click piano keys: each one adds a step to the phrase.',
      'Click a step to change it: click more piano keys to make it a chord, or pick another length. **Add a rest** adds a silence.',
      'Click **Play** to hear it on the computer. Then click **Save macros**.',
      'Go to **Keys**, click a pad, choose the **Macros** tab and click your macro.',
    ],
    check: 'Press the pad: your music app plays the whole phrase.',
    tip: 'A phrase plays to the end, however long the pad is held. For a chord that lasts while held, use the Chords tab.',
  },

  // Advanced
  {
    id: 'tap-dance',
    modes: ['advanced'],
    title: 'Tap dance: one key, several jobs',
    goal: 'Make a key do different things when tapped once, tapped twice, or held.',
    section: 'advanced',
    steps: [
      'Go to **Advanced** and choose **Tap dance**.',
      'Click **New tap dance**, then choose what a single tap does.',
      'Click **Tap twice**, **Hold** or **Tap, then hold** and choose what each does. Empty ones explain what happens instead.',
      'Change the **Wait time** if the keyboard mixes up taps and holds.',
      'Go to **Keys**, click a key, choose the **Tap dance** tab and click your tap dance.',
    ],
    check: 'Tap the key once, then twice: each does its own job.',
  },
  {
    id: 'combos',
    modes: ['advanced'],
    title: 'Combos: press keys together',
    goal: 'Make two or more keys pressed at the same time do something else, such as D + F for Tab.',
    section: 'advanced',
    steps: [
      'Go to **Advanced** and choose **Combos**.',
      'Click **New combo**.',
      'Choose the first key, then the second. Add more if you like.',
      'Choose what the combo does. It is saved straight away.',
    ],
    check: 'Press the keys at the same moment: you get the combo’s key instead.',
    tip: 'Pressing the keys one after the other still types them normally.',
  },
  {
    id: 'key-overrides',
    modes: ['advanced'],
    title: 'Key overrides',
    goal: 'Change what a key does while a modifier is held, such as Shift + Backspace deleting forwards.',
    section: 'advanced',
    steps: [
      'Go to **Advanced** and choose **Key overrides**.',
      'Click **New key override**.',
      'Under **Hold these modifiers**, choose the modifiers, such as **Left Shift**.',
      'Choose the key, such as **Backspace**, then click **Sends instead** and choose what it sends, such as **Delete**.',
      'Choose which layers it works on, if not all of them.',
    ],
    check: 'Hold Shift and press Backspace: the text after the cursor is deleted.',
  },
  {
    id: 'alt-repeat',
    modes: ['advanced'],
    title: 'Alt Repeat',
    goal: 'A key that sends the "opposite" of the last key, such as Right after Left.',
    section: 'advanced',
    steps: [
      'Go to **Advanced** and choose **Alt Repeat**.',
      'Click **New pair** and choose the last key pressed, such as **Left arrow**.',
      'Click **Alt Repeat sends** and choose its opposite, such as **Right arrow**. Tick **Works both ways** if you like.',
      'Go to **Keys**, click a key, choose the **Special** tab and click **Alt Repeat**.',
    ],
    check: 'Press Left arrow, then the Alt Repeat key: the cursor moves right.',
    tip: 'Alt Repeat needs recent firmware. Keyboards without it don’t show this tab.',
  },
  {
    id: 'typing-settings',
    modes: ['advanced'],
    title: 'Typing settings',
    goal: 'Fine-tune timing, such as how long a key must be held to count as a hold.',
    section: 'advanced',
    steps: [
      'Go to **Advanced** and choose **Typing settings**.',
      'Each setting says what it does. Change one, such as **Hold time** under Tap and hold.',
      'Click **Save settings**, or **Discard changes** to go back.',
    ],
    check: 'Type normally: tap-or-hold keys should feel right. If not, change the hold time a little at a time.',
    tip: 'The defaults suit most people. Change one thing at a time.',
  },
]

/** A mode's lessons: its own first, then the ones it shares with another mode. */
export const lessonsFor = (mode: Profile) =>
  LESSONS.filter((l) => l.modes.includes(mode)).sort((a, b) => Number(a.modes[0] !== mode) - Number(b.modes[0] !== mode))

export const findLesson = (id: string | null) => LESSONS.find((l) => l.id === id)

const isMode = (s: string | undefined): s is Profile => LEARN_MODES.some((m) => m.mode === s)

/**
 * Reads where Learn is from its address: "<mode>/<lesson id>", "<mode>", "<lesson id>"
 * or nothing. Anything unknown falls back to the first lesson of the mode.
 */
export function parseLearnPath(path: string, fallbackMode: Profile): { mode: Profile; lesson: Lesson; path: string } {
  const [first, second] = path.split('/')
  let mode: Profile
  let lesson: Lesson | undefined
  if (isMode(first)) {
    mode = first
    lesson = findLesson(second ?? null)
  } else {
    lesson = findLesson(first)
    mode = lesson?.modes[0] ?? fallbackMode
  }
  if (!lesson || !lesson.modes.includes(mode)) lesson = lessonsFor(mode)[0]
  return { mode, lesson, path: `${mode}/${lesson.id}` }
}

/** Splits "a **bold** b" into plain and bold parts. */
export function boldParts(text: string): { text: string; bold: boolean }[] {
  return text
    .split('**')
    .map((part, i) => ({ text: part, bold: i % 2 === 1 }))
    .filter((p) => p.text)
}
