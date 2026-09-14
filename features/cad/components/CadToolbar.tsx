'use client'

import { Circle, Minus, MousePointer2, Spline, Square, Trash2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button, Checkbox, Select } from '@/components/ui'
import { cn } from '@/lib/cn'
import { CAD_LINE_WIDTHS, CAD_PALETTE, type CadStyleState, type CadTool } from '../types'

const DRAW_TOOLS: {
  id: CadTool
  icon: typeof MousePointer2
  labelKey: 'toolSelect' | 'toolLine' | 'toolRect' | 'toolCircle' | 'toolPolyline'
}[] = [
  { id: 'select', icon: MousePointer2, labelKey: 'toolSelect' },
  { id: 'line', icon: Minus, labelKey: 'toolLine' },
  { id: 'rect', icon: Square, labelKey: 'toolRect' },
  { id: 'circle', icon: Circle, labelKey: 'toolCircle' },
  { id: 'polyline', icon: Spline, labelKey: 'toolPolyline' },
]

type Props = {
  tool: CadTool
  style: CadStyleState
  canUndo: boolean
  canRedo: boolean
  hasSelection: boolean
  onToolChange: (tool: CadTool) => void
  onStyleChange: (patch: Partial<CadStyleState>) => void
  onUndo: () => void
  onRedo: () => void
  onDelete: () => void
  onClear: () => void
  onNew: () => void
  onOpen: () => void
  onSave: () => void
  onSaveAs: () => void
}

export function CadToolbar({
  tool,
  style,
  canUndo,
  canRedo,
  hasSelection,
  onToolChange,
  onStyleChange,
  onUndo,
  onRedo,
  onDelete,
  onClear,
  onNew,
  onOpen,
  onSave,
  onSaveAs,
}: Props) {
  const t = useTranslations('cad')

  return (
    <div className='shrink-0 flex flex-col border-b border-chrome-dark bg-chrome'>
      <div className='flex flex-wrap items-center gap-1 px-2 py-1.5 border-b border-chrome-dark/60'>
        <Button size='sm' onClick={onNew}>
          {t('new')}
        </Button>
        <Button size='sm' onClick={onOpen}>
          {t('open')}
        </Button>
        <Button size='sm' onClick={onSave}>
          {t('save')}
        </Button>
        <Button size='sm' onClick={onSaveAs}>
          {t('saveAs')}
        </Button>
        <div className='w-px h-5 bg-chrome-dark/50 mx-1' />
        <Button size='sm' disabled={!canUndo} onClick={onUndo}>
          {t('undo')}
        </Button>
        <Button size='sm' disabled={!canRedo} onClick={onRedo}>
          {t('redo')}
        </Button>
      </div>

      <div className='flex flex-wrap items-center gap-1.5 px-2 py-1.5'>
        <div className='flex items-center gap-0.5'>
          {DRAW_TOOLS.map(({ id, icon: Icon, labelKey }) => (
            <Button
              key={id}
              size='sm'
              variant={tool === id ? 'pressed' : 'raised'}
              active={tool === id}
              aria-pressed={tool === id}
              title={t(labelKey)}
              aria-label={t(labelKey)}
              onClick={() => onToolChange(id)}
            >
              <Icon size={12} />
              <span className='max-md:hidden'>{t(labelKey)}</span>
            </Button>
          ))}
        </div>

        <div className='w-px h-5 bg-chrome-dark/50 mx-1' />

        <Button size='sm' disabled={!hasSelection} onClick={onDelete} title={t('delete')}>
          <Trash2 size={12} />
          <span className='max-md:hidden'>{t('delete')}</span>
        </Button>
        <Button size='sm' onClick={onClear} title={t('clear')}>
          {t('clear')}
        </Button>

        <div className='w-px h-5 bg-chrome-dark/50 mx-1' />

        <span className='text-[10px] text-muted'>{t('lineWidth')}</span>
        <Select
          size='sm'
          className='w-[4.5rem]'
          aria-label={t('lineWidth')}
          value={String(style.lineWidth)}
          options={CAD_LINE_WIDTHS.map((w) => ({ value: String(w), label: `${w}px` }))}
          onChange={(v) => onStyleChange({ lineWidth: Number(v) })}
        />

        <Checkbox label={t('fill')} checked={style.fill} onChange={(e) => onStyleChange({ fill: e.target.checked })} />

        <div className='w-px h-5 bg-chrome-dark/50 mx-1' />

        <div
          className='w-6 h-6 shrink-0 border-2 border-t-chrome-dark border-l-chrome-dark border-r-chrome-light border-b-chrome-light'
          style={{ background: style.color }}
          title={t('color')}
        />
        <div className='grid grid-cols-[repeat(8,14px)] gap-0.5'>
          {CAD_PALETTE.map((c) => (
            <button
              key={c}
              type='button'
              aria-label={c}
              title={c}
              className={cn(
                'w-[14px] h-[14px] border border-chrome-dark',
                style.color.toLowerCase() === c && 'outline outline-[var(--window-title-active)]',
              )}
              style={{ background: c }}
              onClick={() => onStyleChange({ color: c })}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
