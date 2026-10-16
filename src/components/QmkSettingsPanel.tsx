// SPDX-License-Identifier: GPL-2.0-or-later
import { useId, useState } from 'react'
import { Button } from '@/components/ui/button'
import { changedSettings, fieldValue, settingGroups, type SettingField } from '@/core/qmk-settings'
import { useApp } from '@/store'

/**
 * QMK settings, grouped by feature (editor/qmk_settings.py). Changes are kept as a
 * draft until saved, as in vial-gui.
 */
export function QmkSettingsPanel() {
  const { keyboard, settingsDraft, setSettingDraft, saveSettings, discardSettingsDraft, resetSettings, busy } = useApp()
  const [confirmReset, setConfirmReset] = useState(false)
  if (!keyboard) return null

  const groups = settingGroups(keyboard.qmkSettings.supported)
  const changed = new Set(changedSettings(keyboard.qmkSettings.values, settingsDraft))

  return (
    <section aria-label="Typing settings" className="flex w-full flex-col gap-4">
      {groups.map((group) => (
        <fieldset key={group.id} className="flex flex-col gap-4 rounded-2xl bg-panel p-4 sm:p-5">
          <legend className="float-left w-full">
            <span className="text-lg font-bold">{group.title}</span>
            {group.fields.some((f) => changed.has(f.qsid)) && (
              <span className="ml-3 rounded-full bg-field px-2 py-0.5 text-sm text-ink-soft">Not saved</span>
            )}
          </legend>
          <p className="-mt-2 text-ink-soft">{group.description}</p>
          <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
            {group.fields.map((field) => (
              <SettingControl
                key={`${field.qsid}:${field.bit ?? ''}`}
                field={field}
                value={fieldValue(settingsDraft, field)}
                onChange={(value) => setSettingDraft(field, value)}
              />
            ))}
          </div>
        </fieldset>
      ))}

      <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-desk px-4 py-3">
        {confirmReset ? (
          <>
            <p className="font-semibold">Put every setting back to the keyboard's default?</p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setConfirmReset(false)}>
                Cancel
              </Button>
              <Button
                className="bg-alert text-desk hover:bg-alert/90"
                disabled={busy}
                onClick={async () => {
                  setConfirmReset(false)
                  await resetSettings()
                }}
              >
                Reset settings
              </Button>
            </div>
          </>
        ) : (
          <>
            <p className="text-ink-soft">
              {changed.size ? 'Save to send your changes to the keyboard.' : 'Settings are saved on the keyboard.'}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="ghost" onClick={() => setConfirmReset(true)} disabled={busy}>
                Reset to defaults
              </Button>
              <Button variant="outline" onClick={discardSettingsDraft} disabled={!changed.size || busy}>
                Discard changes
              </Button>
              <Button className="bg-pick hover:bg-pick-skirt" onClick={saveSettings} disabled={!changed.size || busy}>
                Save settings
              </Button>
            </div>
          </>
        )}
      </div>
    </section>
  )
}

function SettingControl({
  field,
  value,
  onChange,
}: {
  field: SettingField
  value: number | boolean
  onChange(value: number | boolean): void
}) {
  const helpId = useId()
  const help = field.help && (
    <span id={helpId} className="text-sm text-ink-soft">
      {field.help}
    </span>
  )

  if (field.type === 'boolean') {
    return (
      <label className="flex items-start gap-3">
        <input
          type="checkbox"
          className="mt-0.5 size-5 flex-none accent-pick"
          checked={value as boolean}
          aria-describedby={field.help ? helpId : undefined}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span className="flex flex-col gap-0.5">
          <span className="font-semibold">{field.title}</span>
          {help}
        </span>
      </label>
    )
  }

  return (
    <label className="flex flex-col gap-1.5">
      <span className="font-semibold">{field.title}</span>
      <span className="flex items-center gap-2">
        <NumberInput
          value={value as number}
          min={field.min ?? 0}
          max={field.max ?? 65535}
          label={field.title}
          describedBy={field.help ? helpId : undefined}
          onChange={onChange}
        />
        {field.unit && <span className="text-ink-soft">{field.unit}</span>}
      </span>
      {help}
    </label>
  )
}

/** A number box that lets people clear it while typing, and settles on a valid value when they leave it. */
function NumberInput({
  value,
  min,
  max,
  label,
  describedBy,
  onChange,
}: {
  value: number
  min: number
  max: number
  label: string
  describedBy?: string
  onChange(value: number): void
}) {
  const [text, setText] = useState(String(value))
  // Show the new value when it changes from outside, such as Discard changes or a restore.
  const [shown, setShown] = useState(value)
  if (value !== shown) {
    setShown(value)
    setText(String(value))
  }

  return (
    <input
      type="number"
      inputMode="numeric"
      min={min}
      max={max}
      value={text}
      aria-label={label}
      aria-describedby={describedBy}
      onChange={(e) => {
        const typed = e.target.value
        const n = Number(typed)
        if (typed.trim() === '' || !Number.isFinite(n)) {
          setText(typed)
          return
        }
        // Out of range: show the limit the setting will actually get, not what was typed.
        setText(n > max ? String(max) : n < min ? String(min) : typed)
        onChange(n)
      }}
      onBlur={() => setText(String(value))}
      className="h-10 w-32 rounded-lg border border-line bg-field px-3 focus-visible:outline-2 focus-visible:outline-pick"
    />
  )
}
