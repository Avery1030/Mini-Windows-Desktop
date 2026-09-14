'use client'

import { useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/cn'
import { embeddedAppShell } from '@/lib/embeddedAppShell'
import { useMetaHotkeys } from '@/hooks/useMetaHotkeys'
import { useWindowActive } from '@/hooks/desktop/useWindowActive'
import { BuiltinAppId } from '@/config/desktop'
import { CadCanvas } from './components/CadCanvas'
import { CadStatusBar } from './components/CadStatusBar'
import { CadToolbar } from './components/CadToolbar'
import { useCadState } from './hooks/useCadState'

export function CadApp() {
  const t = useTranslations('cad')
  const isActive = useWindowActive(BuiltinAppId.Cad)
  const s = useCadState()

  useMetaHotkeys(isActive, {
    s: () => void s.onSave(),
    n: () => void s.onNew(),
    o: () => void s.onOpen(),
  })

  useEffect(() => {
    if (!isActive) return
    const onKey = (e: KeyboardEvent) => {
      const target = e.target
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) {
        return
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        if (e.shiftKey) s.redo()
        else s.undo()
        return
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault()
        s.redo()
        return
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'a') {
        e.preventDefault()
        s.selectAll()
        return
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault()
        s.deleteSelected()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const hint =
    s.tool === 'select'
      ? t('hintSelect')
      : s.tool === 'line'
        ? t('hintLine')
        : s.tool === 'rect'
          ? t('hintRect')
          : s.tool === 'circle'
            ? t('hintCircle')
            : t('hintPolyline')

  return (
    <div className={cn(embeddedAppShell('flex flex-col bg-window text-on-chrome font-pixel'))} {...s.dragProps}>
      <CadToolbar
        tool={s.tool}
        style={s.style}
        canUndo={s.canUndo}
        canRedo={s.canRedo}
        hasSelection={s.selectedIds.length > 0}
        onToolChange={s.setTool}
        onStyleChange={s.applyStyle}
        onUndo={s.undo}
        onRedo={s.redo}
        onDelete={s.deleteSelected}
        onClear={() => void s.clearAll()}
        onNew={() => void s.onNew()}
        onOpen={() => void s.onOpen()}
        onSave={() => void s.onSave()}
        onSaveAs={() => void s.onSaveAs()}
      />
      <div className='flex-1 min-h-0 p-1 flex flex-col'>
        <CadCanvas
          shapes={s.shapes}
          selectedIds={s.selectedIds}
          tool={s.tool}
          style={s.style}
          camera={s.camera}
          onCameraChange={s.setCamera}
          onCursor={s.setCursor}
          onSelect={s.setSelectedIds}
          onAddShape={s.addShape}
          onBeginMove={s.beginMove}
          onMoveSelected={s.moveSelected}
          onPatchShape={s.patchShape}
          onCancelDraw={() => s.setTool('select')}
        />
      </div>
      <CadStatusBar
        x={s.cursor?.x ?? null}
        y={s.cursor?.y ?? null}
        scale={s.camera.scale}
        toolLabel={
          s.tool === 'select'
            ? t('toolSelect')
            : s.tool === 'line'
              ? t('toolLine')
              : s.tool === 'rect'
                ? t('toolRect')
                : s.tool === 'circle'
                  ? t('toolCircle')
                  : t('toolPolyline')
        }
        hint={hint}
        selectedCount={s.selectedIds.length}
        fileName={s.displayPath}
        dirty={s.dirty}
        unsavedLabel={t('unsaved')}
        savedLabel={t('saved')}
        selectedLabel={t('selected')}
        zoomLabel={t('zoom')}
      />
    </div>
  )
}
