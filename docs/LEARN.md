# Phase 3.7: Learn

Training for the three modes, inside the app, so people can learn it without leaving
the page or reading developer docs.

## What users see

A **Learn** button sits in the header, and the welcome page says "New here? Learn how
it works". Learn replaces the page's content until it is closed; the header stays.

- Tabs for **Easy**, **Musician** and **Advanced**, each with a sentence on who it is
  for. Learn opens on the mode in use, or on Easy before a keyboard is open.
- A numbered list of lessons. A mode's own lessons come first, then the ones it shares
  (Musician shares Change the lights and Keep a backup with Easy). Advanced has only
  its own lessons and points people to Easy first.
- Each lesson is one task: what you'll be able to do, numbered steps with the names of
  buttons in bold, a picture from the demo keyboard with the thing to look at ringed,
  **How to check** it worked, and sometimes a tip.
- **Try it on the demo keyboard** opens the demo in the lesson's mode and section. With
  a real keyboard open the button says **Try it on <name>** and goes there instead.
  Musician lessons on a keyboard without MIDI explain how to reach the demo.
- **Next** and the previous lesson's name move through the list.

Learn lives in the address (`#learn`, `#learn/<lesson id>`), so lessons can be linked
to and the browser's Back button closes them. Choosing a section in the header closes
Learn too.

## Lessons

| Easy | Musician | Advanced |
| --- | --- | --- |
| Change what a key does | Read the pads and the piano | Tap dance |
| Find a key by name | Put a note on a pad | Combos |
| Make a shortcut key | Put a chord on a pad | Key overrides |
| Tap for one thing, hold for another | Octave, pedals and more | Alt Repeat |
| Use layers | Switch sounds with layers | Typing settings |
| Type text with one key | Write a phrase | |
| Change the lights | Change the lights | |
| Check that every key works | Keep a backup | |
| Keep a backup | | |

## Changing lessons

- Lessons are data in `src/learn/lessons.ts`: id, modes, title, goal, section, steps,
  check and tip. Write `**name**` around the names of buttons and tabs; they show in
  bold. Use the names the UI shows.
- Each lesson needs a picture at `public/learn/<id>.jpg`. `e2e-learn/learn.shots.ts`
  has the steps that set up each picture on the demo keyboard and rings the important
  part. Run `npm run learn:shots` (Playwright, 1280×900, light theme, JPEG) and look at
  the pictures before committing them.
- Retake the pictures after changing the UI they show. `npm run test:e2e` doesn't run
  the picture script, but `src/learn/lessons.test.ts` fails when a lesson has no
  picture.

## How it works

- `src/components/LearnView.tsx` draws Learn. `src/lib/learn-route.ts` keeps it in the
  address. `src/lib/sections.ts` lists the sections a keyboard shows in each mode, for
  the header and for Try it.

## Testing

- Unit tests: `src/learn/lessons.test.ts` (ids, order, sections, pictures, bold marks).
- Browser tests: `e2e/learn.spec.ts` (welcome page to a lesson and Try it, a Musician
  lesson, links and Back, closing from the header).
