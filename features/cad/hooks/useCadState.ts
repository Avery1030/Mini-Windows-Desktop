'use client'

import { useCallback, useEffect, useRef, useState, type DragEvent } from 'react'
import { useTranslations } from 'next-intl'
import { modal, toast } from '@/components/ui'
import { preventVfsFileDrag, vfsPathsFromDrag } from '@/lib/desktop/vfsDrop'
import { getBasename } from '@/lib/vfs'
import { pickCadFile } from '../components/CadFileDialog'
import { CadHistory } from '../history'
import { cadTitleFromPath, isCadPath, loadCadFile, saveCadFile } from '../io'
import { subscribeOpenCad, takePendingOpenCad } from '../pendingOpen'
import { BuiltinAppId } from '@/config/desktop'
import { getDesktopWindow } from '@/lib/desktop/window'
import { confirmCadUnsaved } from '../unsavedClose'
import {
  CAD_DIR,
  DEFAULT_CAMERA,
  DEFAULT_STYLE,
  MAX_SHAPES,
  cloneShapes,
  translateShape,
  type CadCamera,
  type CadShape,
  type CadStyleState,
  type CadTool,
} from '../types'

export function useCadState() {
  const t = useTranslations('cad')
  const tm = useTranslations('modal')

  const [shapes, setShapes] = useState<CadShape[]>([])
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [tool, setTool] = useState<CadTool>('select')
  const [style, setStyle] = useState<CadStyleState>(DEFAULT_STYLE)
  const [camera, setCamera] = useState<CadCamera>(DEFAULT_CAMERA)
  const [filePath, setFilePath] = useState<Nullable<string>>(null)
  const [fileName, setFileName] = useState('')
  const [dirty, setDirty] = useState(false)
  const [cursor, setCursor] = useState<Nullable<{ x: number; y: number }>>(null)
  const [historyTick, setHistoryTick] = useState(0)

  const shapesRef = useRef(shapes)
  const selectedRef = useRef(selectedIds)
  const filePathRef = useRef(filePath)
  const dirtyRef = useRef(dirty)
  const historyRef = useRef(new CadHistory())

  shapesRef.current = shapes
  selectedRef.current = selectedIds
  filePathRef.current = filePath
  dirtyRef.current = dirty

  const bumpHistory = useCallback(() => setHistoryTick((n) => n + 1), [])

  const commit = useCallback(
    (next: CadShape[]) => {
      historyRef.current.push(shapesRef.current)
      setShapes(next)
      setDirty(true)
      bumpHistory()
    },
    [bumpHistory],
  )

  const applyFile = useCallback((path: string, nextShapes: CadShape[]) => {
    historyRef.current.clear()
    setShapes(cloneShapes(nextShapes))
    setSelectedIds([])
    setFilePath(path)
    setFileName(cadTitleFromPath(path))
    setDirty(false)
    setTool('select')
    bumpHistory()
  }, [bumpHistory])

  const confirmDiscard = useCallback(async () => {
    if (!dirtyRef.current) return true
    return modal.confirm({
      title: tm('confirmTitle'),
      message: t('confirmDiscard'),
    })
  }, [t, tm])

  const resetBlank = useCallback(() => {
    historyRef.current.clear()
    setShapes([])
    setSelectedIds([])
    setFilePath(null)
    setFileName('')
    setDirty(false)
    setCamera(DEFAULT_CAMERA)
    setTool('select')
    bumpHistory()
  }, [bumpHistory])

  const onNew = useCallback(async () => {
    if (!(await confirmDiscard())) return
    resetBlank()
  }, [confirmDiscard, resetBlank])

  const openPath = useCallback(
    async (path: string) => {
      try {
        const file = await loadCadFile(path)
        applyFile(file.node.path, file.shapes)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : t('loadFail'))
      }
    },
    [applyFile, t],
  )

  const onOpen = useCallback(async () => {
    if (!(await confirmDiscard())) return
    const picked = await pickCadFile({
      mode: 'open',
      title: t('openTitle'),
      confirmLabel: t('open'),
      nameLabel: t('fileName'),
      emptyLabel: t('emptyList'),
      defaultPath: filePathRef.current ?? CAD_DIR,
    })
    if (!picked) return
    await openPath(picked.path)
  }, [confirmDiscard, openPath, t])

  const persistTo = useCallback(
    async (path: string) => {
      try {
        const node = await saveCadFile(path, shapesRef.current)
        setFilePath(node.path)
        setFileName(cadTitleFromPath(node.path))
        setDirty(false)
        toast.success(t('savedOk'))
      } catch (err) {
        toast.error(err instanceof Error ? err.message : t('saveFail'))
      }
    },
    [t],
  )

  const onSaveAs = useCallback(async () => {
    const picked = await pickCadFile({
      mode: 'save',
      title: t('saveAsTitle'),
      confirmLabel: t('save'),
      nameLabel: t('fileName'),
      emptyLabel: t('emptyList'),
      defaultName: fileName || t('untitled'),
      defaultPath: filePathRef.current ?? CAD_DIR,
    })
    if (!picked) return
    await persistTo(picked.path)
  }, [fileName, persistTo, t])

  const onSave = useCallback(async () => {
    const path = filePathRef.current
    if (!path) {
      await onSaveAs()
      return
    }
    await persistTo(path)
  }, [onSaveAs, persistTo])

  const addShape = useCallback(
    (shape: CadShape) => {
      if (shapesRef.current.length >= MAX_SHAPES) {
        toast.error(t('tooMany'))
        return
      }
      commit([...shapesRef.current, shape])
      setSelectedIds([shape.id])
    },
    [commit, t],
  )

  const deleteSelected = useCallback(() => {
    const ids = new Set(selectedRef.current)
    if (ids.size === 0) return
    commit(shapesRef.current.filter((s) => !ids.has(s.id)))
    setSelectedIds([])
  }, [commit])

  const clearAll = useCallback(async () => {
    if (shapesRef.current.length === 0) return
    const ok = await modal.confirm({
      title: tm('confirmTitle'),
      message: t('confirmClear'),
    })
    if (!ok) return
    commit([])
    setSelectedIds([])
  }, [commit, t, tm])

  const moveSelected = useCallback((dx: number, dy: number) => {
    const ids = new Set(selectedRef.current)
    if (ids.size === 0) return
    setShapes((prev) => prev.map((s) => (ids.has(s.id) ? translateShape(s, dx, dy) : s)))
    setDirty(true)
  }, [])

  const beginMove = useCallback(() => {
    historyRef.current.push(shapesRef.current)
    bumpHistory()
  }, [bumpHistory])

  const patchShape = useCallback((id: string, next: CadShape) => {
    setShapes((prev) => prev.map((s) => (s.id === id ? next : s)))
    setDirty(true)
  }, [])

  const selectAll = useCallback(() => {
    setSelectedIds(shapesRef.current.map((s) => s.id))
  }, [])

  const undo = useCallback(() => {
    const prev = historyRef.current.undo(shapesRef.current)
    if (!prev) return
    setShapes(prev)
    setSelectedIds([])
    setDirty(true)
    bumpHistory()
  }, [bumpHistory])

  const redo = useCallback(() => {
    const next = historyRef.current.redo(shapesRef.current)
    if (!next) return
    setShapes(next)
    setSelectedIds([])
    setDirty(true)
    bumpHistory()
  }, [bumpHistory])

  const applyStyle = useCallback(
    (patch: Partial<CadStyleState>) => {
      setStyle((prev) => ({ ...prev, ...patch }))
      const ids = new Set(selectedRef.current)
      if (ids.size === 0) return
      historyRef.current.push(shapesRef.current)
      setShapes((prev) =>
        prev.map((s) => {
          if (!ids.has(s.id)) return s
          if (s.type === 'line' || s.type === 'polyline') {
            return {
              ...s,
              color: patch.color ?? s.color,
              lineWidth: patch.lineWidth ?? s.lineWidth,
            }
          }
          return {
            ...s,
            color: patch.color ?? s.color,
            lineWidth: patch.lineWidth ?? s.lineWidth,
            fill: patch.fill ?? s.fill,
          }
        }),
      )
      setDirty(true)
      bumpHistory()
    },
    [bumpHistory],
  )

  useEffect(() => {
    const pending = takePendingOpenCad()
    if (pending) void openPath(pending)
    return subscribeOpenCad((path) => {
      void (async () => {
        if (!(await confirmDiscard())) return
        await openPath(path)
      })()
    })
  }, [confirmDiscard, openPath])

  useEffect(() => {
    const win = getDesktopWindow(BuiltinAppId.Cad)
    if (!win) return
    const previous = win.onBeforeClose.bind(win)
    let confirming = false
    win.onBeforeClose = () => {
      if (!dirtyRef.current) return true
      if (confirming) return false
      confirming = true
      void (async () => {
        try {
          const choice = await confirmCadUnsaved({
            title: tm('confirmTitle'),
            message: t('confirmUnsavedClose'),
            save: t('save'),
            discard: t('closeDiscard'),
            cancel: t('closeCancel'),
          })
          if (choice === 'save') {
            const path = filePathRef.current
            if (path) await persistTo(path)
            else await onSaveAs()
            if (!dirtyRef.current) win.close()
          } else if (choice === 'discard') {
            dirtyRef.current = false
            setDirty(false)
            win.close()
          }
        } finally {
          confirming = false
        }
      })()
      return false
    }
    return () => {
      win.onBeforeClose = previous
    }
  }, [onSaveAs, persistTo, t, tm])

  return {
    shapes,
    selectedIds,
    setSelectedIds,
    tool,
    setTool,
    style,
    applyStyle,
    camera,
    setCamera,
    fileName: fileName || t('untitled'),
    dirty,
    cursor,
    setCursor,
    canUndo: historyTick >= 0 && historyRef.current.canUndo,
    canRedo: historyTick >= 0 && historyRef.current.canRedo,
    onNew,
    onOpen,
    onSave,
    onSaveAs,
    addShape,
    deleteSelected,
    clearAll,
    moveSelected,
    beginMove,
    patchShape,
    selectAll,
    undo,
    redo,
    dragProps: {
      onDragOver: preventVfsFileDrag,
      onDrop: (e: DragEvent) => {
        e.preventDefault()
        const path = vfsPathsFromDrag(e).find(isCadPath)
        if (!path) return
        void (async () => {
          if (!(await confirmDiscard())) return
          await openPath(path)
        })()
      },
    },
    displayPath: filePath ? getBasename(filePath) : t('untitled'),
  }
}

export type CadState = ReturnType<typeof useCadState>
