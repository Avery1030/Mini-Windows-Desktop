'use client'

import { cn } from '@/lib/cn'
import { winChromeSunken } from '@/lib/winChrome'

type Props = {
  x: Nullable<number>
  y: Nullable<number>
  scale: number
  toolLabel: string
  hint: string
  selectedCount: number
  fileName: string
  dirty: boolean
  unsavedLabel: string
  savedLabel: string
  selectedLabel: string
  zoomLabel: string
}

export function CadStatusBar({
  x,
  y,
  scale,
  toolLabel,
  hint,
  selectedCount,
  fileName,
  dirty,
  unsavedLabel,
  savedLabel,
  selectedLabel,
  zoomLabel,
}: Props) {
  const coord =
    x == null || y == null ? '— , —' : `${x.toFixed(2)} , ${y.toFixed(2)}`

  return (
    <div className='shrink-0 px-1 py-0.5 border-t border-chrome-dark bg-status-bar text-[10px] text-status-bar-fg flex items-stretch gap-1'>
      <div className={cn(winChromeSunken, 'px-2 py-0.5 min-w-[9rem] bg-field')}>X,Y {coord}</div>
      <div className={cn(winChromeSunken, 'px-2 py-0.5 min-w-[4.5rem] bg-field')}>{toolLabel}</div>
      <div className={cn(winChromeSunken, 'px-2 py-0.5 flex-1 min-w-0 bg-field truncate')} title={hint}>
        {hint}
      </div>
      <div className={cn(winChromeSunken, 'px-2 py-0.5 min-w-[5rem] bg-field')}>
        {selectedLabel}: {selectedCount}
      </div>
      <div className={cn(winChromeSunken, 'px-2 py-0.5 min-w-[4.5rem] bg-field')}>
        {zoomLabel} {Math.round(scale * 100)}%
      </div>
      <div className={cn(winChromeSunken, 'px-2 py-0.5 min-w-[7rem] bg-field truncate')} title={fileName}>
        {fileName}
      </div>
      <div
        className={cn(
          winChromeSunken,
          'px-2 py-0.5 shrink-0 bg-field font-bold',
          dirty ? 'text-red-700 dark:text-red-400' : '',
        )}
      >
        {dirty ? unsavedLabel : savedLabel}
      </div>
    </div>
  )
}
