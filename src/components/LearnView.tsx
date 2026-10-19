// SPDX-License-Identifier: GPL-2.0-or-later
import { ArrowLeft, ArrowRight, CircleCheck, Lightbulb, Play, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { PROFILE_TITLES, profilesFor, type Profile } from '@/core/profiles'
import { boldParts, LEARN_MODES, lessonsFor, parseLearnPath, type Lesson } from '@/learn/lessons'
import { closeLearn, openLearn } from '@/lib/learn-route'
import { SECTION_TITLES, sectionsFor } from '@/lib/sections'
import { useApp } from '@/store'

/** Text with **bold** parts, as the lessons write the names of buttons and tabs. */
function Rich({ text }: { text: string }) {
  return (
    <>
      {boldParts(text).map((p, i) =>
        p.bold ? (
          <strong key={i} className="font-semibold text-ink">
            {p.text}
          </strong>
        ) : (
          p.text
        ),
      )}
    </>
  )
}

/**
 * Learn: short lessons for each mode, each one task with steps, a picture taken from the
 * demo keyboard, and a button to try it there.
 */
export function LearnView({ route }: { route: string }) {
  const profile = useApp((s) => s.profile)
  const keyboard = useApp((s) => s.keyboard)
  // The address says where Learn is; before a keyboard is open it starts on Easy.
  const { mode, lesson, path } = parseLearnPath(route, keyboard ? profile : 'easy')
  const lessons = lessonsFor(mode)
  const at = lessons.indexOf(lesson)
  const top = useRef<HTMLDivElement>(null)
  const opened = useRef(false)

  // Show the full address for what is on screen, so a copied link opens the same page.
  useEffect(() => {
    if (route !== path) openLearn(path)
  }, [route, path])

  // A new lesson starts at its top, with focus on its title for keyboards and screen readers.
  useEffect(() => {
    if (!opened.current) {
      opened.current = true
      return
    }
    top.current?.scrollIntoView({ block: 'start' })
    document.getElementById('lesson-title')?.focus({ preventScroll: true })
  }, [path])

  return (
    <div ref={top} className="mx-auto flex w-full max-w-6xl scroll-mt-4 flex-col gap-6 pt-4 pb-12">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex max-w-2xl flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight">Learn</h1>
          <p className="text-ink-soft">
            Short lessons, one task each. Read the steps, then click Try it to do it yourself on the demo keyboard. Nothing you
            do there touches a real keyboard.
          </p>
        </div>
        <Button variant="outline" onClick={closeLearn}>
          <X aria-hidden />
          Close Learn
        </Button>
      </div>

      <div className="flex flex-col gap-2">
        <div role="group" aria-label="Modes" className="flex w-fit gap-1 rounded-xl bg-panel p-1">
          {LEARN_MODES.map(({ mode: m }) => (
            <button
              key={m}
              aria-pressed={mode === m}
              onClick={() => openLearn(m)}
              className={`rounded-lg px-4 py-1.5 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-pick ${
                mode === m ? 'bg-pick text-desk' : 'text-ink-soft hover:text-ink'
              }`}
            >
              {PROFILE_TITLES[m]}
            </button>
          ))}
        </div>
        <p className="max-w-2xl text-ink-soft">{LEARN_MODES.find((l) => l.mode === mode)?.intro}</p>
      </div>

      <div className="grid gap-6 md:grid-cols-[16rem_minmax(0,1fr)]">
        {/* On phones the lesson comes first and the list follows it. */}
        <nav aria-label="Lessons" className="flex flex-col gap-1 max-md:order-last md:sticky md:top-0 md:self-start">
          <ol className="flex flex-col gap-1">
            {lessons.map((l, i) => (
              <li key={l.id}>
                <button
                  aria-current={l === lesson ? 'page' : undefined}
                  onClick={() => openLearn(`${mode}/${l.id}`)}
                  className={`flex w-full items-start gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors focus-visible:outline-2 focus-visible:outline-pick ${
                    l === lesson ? 'bg-ink font-semibold text-desk' : 'text-ink-soft hover:bg-panel hover:text-ink'
                  }`}
                >
                  <span className="w-4 flex-none text-right tabular-nums">{i + 1}</span>
                  {l.title}
                </button>
              </li>
            ))}
          </ol>
        </nav>

        <LessonPage
          key={lesson.id}
          lesson={lesson}
          mode={mode}
          number={at + 1}
          previous={lessons[at - 1]}
          next={lessons[at + 1]}
        />
      </div>
    </div>
  )
}

function LessonPage({
  lesson,
  mode,
  number,
  previous,
  next,
}: {
  lesson: Lesson
  mode: Profile
  number: number
  previous?: Lesson
  next?: Lesson
}) {
  const [pictureMissing, setPictureMissing] = useState(false)
  const picture = `${import.meta.env.BASE_URL}learn/${lesson.id}.jpg`
  return (
    <article aria-labelledby="lesson-title" className="flex min-w-0 flex-col gap-5">
      <header className="flex flex-col gap-1">
        <p className="text-sm font-semibold text-ink-soft">
          {PROFILE_TITLES[mode]} · Lesson {number}
        </p>
        <h2 id="lesson-title" tabIndex={-1} className="text-2xl font-bold tracking-tight outline-none">
          {lesson.title}
        </h2>
        <p className="text-lg text-ink-soft">{lesson.goal}</p>
      </header>

      <ol aria-label="Steps" className="flex flex-col gap-3">
        {lesson.steps.map((step, i) => (
          <li key={i} className="flex gap-3">
            <span
              className="flex size-7 flex-none items-center justify-center rounded-full bg-pick text-sm font-bold text-desk"
              aria-hidden
            >
              {i + 1}
            </span>
            <p className="pt-0.5 text-ink-soft">
              <Rich text={step} />
            </p>
          </li>
        ))}
      </ol>

      {!pictureMissing && (
        <figure className="flex flex-col gap-2">
          <a href={picture} target="_blank" rel="noreferrer" className="focus-visible:outline-2 focus-visible:outline-pick">
            <img
              src={picture}
              alt={`The app during “${lesson.title}”, on the demo keyboard.`}
              loading="lazy"
              onError={() => setPictureMissing(true)}
              className="w-full rounded-xl border border-line"
            />
          </a>
          <figcaption className="text-sm text-ink-soft">
            On the demo keyboard. Yours may look different. Click the picture to see it full size.
          </figcaption>
        </figure>
      )}

      <section aria-label="How to check" className="flex gap-3 rounded-xl bg-panel p-4">
        <CircleCheck className="mt-0.5 size-5 flex-none text-pick" aria-hidden />
        <p>
          <strong className="font-semibold">How to check: </strong>
          <Rich text={lesson.check} />
        </p>
      </section>

      {lesson.tip && (
        <section aria-label="Tip" className="flex gap-3 rounded-xl border border-line p-4">
          <Lightbulb className="mt-0.5 size-5 flex-none text-ink-soft" aria-hidden />
          <p className="text-ink-soft">
            <Rich text={lesson.tip} />
          </p>
        </section>
      )}

      <TryIt lesson={lesson} mode={mode} />

      <div className="flex flex-wrap justify-between gap-3 border-t border-line pt-4">
        {previous ? (
          <Button variant="ghost" onClick={() => openLearn(`${mode}/${previous.id}`)}>
            <ArrowLeft aria-hidden />
            {previous.title}
          </Button>
        ) : (
          <span />
        )}
        {next && (
          <Button variant="ghost" onClick={() => openLearn(`${mode}/${next.id}`)}>
            Next: {next.title}
            <ArrowRight aria-hidden />
          </Button>
        )}
      </div>
    </article>
  )
}

/**
 * Opens the lesson's section in its mode: on the open keyboard, or on the demo keyboard
 * when none is open. On a real keyboard it says when the mode changes, and explains
 * when the keyboard can't follow the lesson.
 */
function TryIt({ lesson, mode }: { lesson: Lesson; mode: Profile }) {
  const { keyboard, isDemo, profile, openDemo, setProfile, setView } = useApp()
  const [opening, setOpening] = useState(false)

  const go = async () => {
    if (!useApp.getState().keyboard) {
      setOpening(true)
      try {
        await openDemo()
      } finally {
        setOpening(false)
      }
    }
    const { keyboard: kb, profile: was, isDemo: demo } = useApp.getState()
    if (!kb) return
    setProfile(mode)
    setView(lesson.section)
    if (!demo && was !== mode) {
      useApp.setState({
        notice: `Switched to ${PROFILE_TITLES[mode]} mode for this lesson. The Mode switch at the top changes it back.`,
      })
    }
    closeLearn()
  }

  if (keyboard && !isDemo) {
    const problem = !profilesFor(keyboard.catalog).includes(mode)
      ? `${PROFILE_TITLES[mode]} mode needs a keyboard that plays music, and ${keyboard.name} doesn’t.`
      : !sectionsFor(keyboard, mode).some((s) => s.id === lesson.section)
        ? `${keyboard.name} has no ${SECTION_TITLES[lesson.section]} section, so this lesson doesn’t apply to it.`
        : null
    if (problem) {
      return (
        <p className="rounded-xl bg-panel p-4 text-ink-soft">
          {problem} Disconnect it and try the demo keyboard to follow this lesson.
        </p>
      )
    }
  }
  return (
    <div className="flex flex-col gap-2">
      <Button size="lg" className="h-12 w-fit bg-pick px-6 text-base hover:bg-pick-skirt" onClick={go} disabled={opening}>
        <Play aria-hidden />
        {!keyboard || isDemo ? 'Try it on the demo keyboard' : `Try it on ${keyboard.name}`}
      </Button>
      {keyboard && !isDemo && profile !== mode && (
        <p className="text-sm text-ink-soft">This switches {keyboard.name} to {PROFILE_TITLES[mode]} mode.</p>
      )}
    </div>
  )
}
