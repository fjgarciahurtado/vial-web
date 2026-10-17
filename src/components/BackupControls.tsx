// SPDX-License-Identifier: GPL-2.0-or-later
import { Download, Upload } from 'lucide-react'
import { useRef } from 'react'
import { Button } from '@/components/ui/button'
import { useApp } from '@/store'

/** Save the keymap to a .vil file, or bring one back. Files work in vial-gui too. */
export function BackupControls() {
  const { keyboard, busy, backupText, openBackup } = useApp()
  const input = useRef<HTMLInputElement>(null)
  if (!keyboard) return null

  const save = () => {
    const url = URL.createObjectURL(new Blob([backupText()], { type: 'application/json' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `${fileName(keyboard.name)}.vil`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" onClick={save} disabled={busy}>
        <Download aria-hidden />
        Save backup
      </Button>
      <Button variant="outline" onClick={() => input.current?.click()} disabled={busy}>
        <Upload aria-hidden />
        Restore backup
      </Button>
      <input
        ref={input}
        type="file"
        accept=".vil,application/json"
        className="hidden"
        aria-label="Backup file"
        onChange={async (e) => {
          const file = e.target.files?.[0]
          e.target.value = ''
          if (file) await openBackup(await file.text())
        }}
      />
    </div>
  )
}

/** Asks before restoring a backup that was saved from a different keyboard. */
export function RestoreConfirmation() {
  const { pendingRestore, confirmRestore, cancelRestore } = useApp()
  if (!pendingRestore) return null
  return (
    <div
      role="alertdialog"
      aria-labelledby="restore-title"
      aria-describedby="restore-text"
      className="flex w-full flex-wrap items-center justify-between gap-4 rounded-2xl border-l-4 border-alert bg-field p-4"
    >
      <div>
        <p id="restore-title" className="font-semibold">
          This backup is from a different keyboard
        </p>
        <p id="restore-text" className="text-ink-soft">
          Keys may end up in the wrong places. You can undo the restore afterwards.
        </p>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" onClick={cancelRestore} autoFocus>
          Cancel
        </Button>
        <Button className="bg-alert hover:bg-alert/90" onClick={confirmRestore}>
          Restore anyway
        </Button>
      </div>
    </div>
  )
}

function fileName(name: string): string {
  return name.replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-').toLowerCase() || 'keyboard'
}
