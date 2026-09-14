'use client'

import { useCallback, useEffect, useRef, type PointerEvent as ReactPointerEvent } from 'react'
import { cn } from '@/lib/cn'
import { winChromeSunken } from '@/lib/winChrome'
import { canvasToWorld, panBy, zoomAt } from '../coords'
import { drawCadFrame } from '../draw'
import { applyHandleDrag, pickHandle, type CadHandleHit } from '../handles'
import { pickShape, shapesInMarquee } from '../hitTest'
import {
  RULER_SIZE,
  createShapeId,
  normalizeRect,
  type CadCamera,
  type CadDraft,
  type CadPoint,
  type CadShape,
  type CadStyleState,
  type CadTool,
  type CadViewSize,
} from '../types'

type Props = {
  shapes: readonly CadShape[]
  selectedIds: readonly string[]
  tool: CadTool
  style: CadStyleState
  camera: CadCamera
  onCameraChange: (camera: CadCamera) => void
  onCursor: (pt: Nullable<CadPoint>) => void
  onSelect: (ids: string[]) => void
  onAddShape: (shape: CadShape) => void
  onBeginMove: () => void
  onMoveSelected: (dx: number, dy: number) => void
  onPatchShape: (id: string, next: CadShape) => void
  onCancelDraw: () => void
}

type DragMode =
  | { kind: 'pan'; lastX: number; lastY: number; originX: number; originY: number; moved: boolean }
  | { kind: 'move'; last: CadPoint; started: boolean }
  | { kind: 'handle'; hit: CadHandleHit; started: boolean }
  | { kind: 'rect'; start: CadPoint }
  | { kind: 'circle'; start: CadPoint }
  | { kind: 'marquee'; start: CadPoint; additive: boolean }

const PAN_CLICK_PX = 5

function viewFromCss(cssW: number, cssH: number): CadViewSize {
  return {
    width: Math.max(1, cssW - RULER_SIZE),
    height: Math.max(1, cssH - RULER_SIZE),
  }
}

function almostSame(a: CadPoint, b: CadPoint, eps = 1e-4): boolean {
  return Math.hypot(a.x - b.x, a.y - b.y) < eps
}

export function CadCanvas({
  shapes,
  selectedIds,
  tool,
  style,
  camera,
  onCameraChange,
  onCursor,
  onSelect,
  onAddShape,
  onBeginMove,
  onMoveSelected,
  onPatchShape,
  onCancelDraw,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef(0)
  const dragRef = useRef<Nullable<DragMode>>(null)
  const lineStartRef = useRef<Nullable<CadPoint>>(null)
  const polyRef = useRef<CadPoint[]>([])
  const draftRef = useRef<Nullable<CadDraft>>(null)
  const skipPolyClickRef = useRef(false)

  const shapesRef = useRef(shapes)
  const selectedRef = useRef(selectedIds)
  const toolRef = useRef(tool)
  const styleRef = useRef(style)
  const cameraRef = useRef(camera)
  const viewRef = useRef<CadViewSize>({ width: 1, height: 1 })
  const cssRef = useRef({ w: 1, h: 1 })
  const onCancelDrawRef = useRef(onCancelDraw)
  onCancelDrawRef.current = onCancelDraw

  shapesRef.current = shapes
  selectedRef.current = selectedIds
  toolRef.current = tool
  styleRef.current = style
  cameraRef.current = camera

  const setDraft = (d: Nullable<CadDraft>) => {
    draftRef.current = d
    schedule()
  }

  const paint = useCallback(() => {
    const canvas = canvasRef.current
    const wrap = wrapRef.current
    if (!canvas || !wrap) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const rect = wrap.getBoundingClientRect()
    const w = Math.max(1, rect.width)
    const h = Math.max(1, rect.height)
    cssRef.current = { w, h }
    viewRef.current = viewFromCss(w, h)
    const dpr = Math.max(1, window.devicePixelRatio || 1)
    const bw = Math.max(1, Math.floor(w * dpr))
    const bh = Math.max(1, Math.floor(h * dpr))
    if (canvas.width !== bw) canvas.width = bw
    if (canvas.height !== bh) canvas.height = bh
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    drawCadFrame(ctx, {
      cssW: w,
      cssH: h,
      view: viewRef.current,
      camera: cameraRef.current,
      shapes: shapesRef.current,
      selectedIds: new Set(selectedRef.current),
      draft: draftRef.current,
      styleColor: styleRef.current.color,
      styleWidth: styleRef.current.lineWidth,
      styleFill: styleRef.current.fill,
    })
  }, [])

  const schedule = useCallback(() => {
    if (rafRef.current) return
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = 0
      paint()
    })
  }, [paint])

  useEffect(() => {
    schedule()
  }, [shapes, selectedIds, tool, style, camera, schedule])

  useEffect(() => {
    const wrap = wrapRef.current
    if (!wrap) return
    const onResize = () => schedule()
    const ro = new ResizeObserver(onResize)
    ro.observe(wrap)
    onResize()
    return () => {
      ro.disconnect()
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = 0
      }
    }
  }, [schedule])

  useEffect(() => {
    lineStartRef.current = null
    polyRef.current = []
    dragRef.current = null
    setDraft(null)
  }, [tool])

  const eventPos = (e: { clientX: number; clientY: number }) => {
    const canvas = canvasRef.current
    if (!canvas) return null
    const rect = canvas.getBoundingClientRect()
    const cssX = e.clientX - rect.left
    const cssY = e.clientY - rect.top
    const sx = cssX - RULER_SIZE
    const sy = cssY - RULER_SIZE
    const view = viewRef.current
    const world = canvasToWorld(cssX, cssY, cameraRef.current, view)
    return { cssX, cssY, sx, sy, world, view }
  }

  const hoverCursor = (sx: number, sy: number, world: CadPoint) => {
    const canvas = canvasRef.current
    if (!canvas) return
    if (toolRef.current !== 'select') {
      canvas.style.cursor = 'crosshair'
      return
    }
    const handle = pickHandle(shapesRef.current, selectedRef.current, sx, sy, cameraRef.current, viewRef.current)
    if (handle) {
      canvas.style.cursor = handle.handle.kind === 'circle-radius' ? 'ew-resize' : 'nwse-resize'
      return
    }
    const hit = pickShape(shapesRef.current, world, cameraRef.current.scale)
    canvas.style.cursor = hit ? 'move' : 'default'
  }

  const finishLine = (end: CadPoint) => {
    const start = lineStartRef.current
    lineStartRef.current = null
    setDraft(null)
    if (!start || almostSame(start, end)) return
    onAddShape({
      type: 'line',
      id: createShapeId(),
      x1: start.x,
      y1: start.y,
      x2: end.x,
      y2: end.y,
      color: styleRef.current.color,
      lineWidth: styleRef.current.lineWidth,
    })
  }

  const finishPolyline = () => {
    skipPolyClickRef.current = true
    const pts = polyRef.current.filter((p, i, arr) => i === 0 || !almostSame(p, arr[i - 1]!))
    polyRef.current = []
    setDraft(null)
    if (pts.length < 2) return
    onAddShape({
      type: 'polyline',
      id: createShapeId(),
      points: pts,
      color: styleRef.current.color,
      lineWidth: styleRef.current.lineWidth,
    })
  }

  /** 右键单击：在光标处结束当前直线 / 折线 */
  const finishStrokeAt = (end: CadPoint) => {
    if (lineStartRef.current) {
      finishLine(end)
      return
    }
    if (polyRef.current.length === 0) return
    const last = polyRef.current[polyRef.current.length - 1]
    if (!last || !almostSame(last, end, 0.2)) polyRef.current.push(end)
    finishPolyline()
  }

  const cancelDraw = () => {
    const drawing = Boolean(lineStartRef.current || polyRef.current.length || draftRef.current)
    lineStartRef.current = null
    polyRef.current = []
    dragRef.current = null
    setDraft(null)
    if (drawing || toolRef.current !== 'select') onCancelDrawRef.current()
    else onSelect([])
  }

  const onPointerDown = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const pos = eventPos(e)
    if (!pos) return
    try {
      canvasRef.current?.setPointerCapture(e.pointerId)
    } catch {
      /* untrusted synthetic events cannot capture */
    }

    if (e.button === 2 || e.button === 1) {
      dragRef.current = {
        kind: 'pan',
        lastX: e.clientX,
        lastY: e.clientY,
        originX: e.clientX,
        originY: e.clientY,
        moved: false,
      }
      return
    }
    if (e.button !== 0) return

    const currentTool = toolRef.current
    if (currentTool === 'select') {
      const handle = pickHandle(
        shapesRef.current,
        selectedRef.current,
        pos.sx,
        pos.sy,
        cameraRef.current,
        pos.view,
      )
      if (handle) {
        dragRef.current = { kind: 'handle', hit: handle, started: false }
        return
      }
      const hit = pickShape(shapesRef.current, pos.world, cameraRef.current.scale)
      if (hit) {
        const already = selectedRef.current.includes(hit.id)
        if (e.shiftKey) {
          onSelect(already ? selectedRef.current.filter((id) => id !== hit.id) : [...selectedRef.current, hit.id])
          return
        }
        if (!already) onSelect([hit.id])
        dragRef.current = { kind: 'move', last: pos.world, started: false }
      } else {
        if (!e.shiftKey) onSelect([])
        dragRef.current = { kind: 'marquee', start: pos.world, additive: e.shiftKey }
        setDraft({ kind: 'marquee', x: pos.world.x, y: pos.world.y, w: 0, h: 0 })
      }
      return
    }

    if (currentTool === 'line') {
      if (!lineStartRef.current) {
        lineStartRef.current = pos.world
        setDraft({ kind: 'line', x1: pos.world.x, y1: pos.world.y, x2: pos.world.x, y2: pos.world.y })
      } else {
        finishLine(pos.world)
      }
      return
    }

    if (currentTool === 'rect') {
      dragRef.current = { kind: 'rect', start: pos.world }
      setDraft({ kind: 'rect', x: pos.world.x, y: pos.world.y, w: 0, h: 0 })
      return
    }

    if (currentTool === 'circle') {
      dragRef.current = { kind: 'circle', start: pos.world }
      setDraft({ kind: 'circle', cx: pos.world.x, cy: pos.world.y, r: 0 })
      return
    }

    if (currentTool === 'polyline') {
      if (skipPolyClickRef.current) {
        skipPolyClickRef.current = false
        return
      }
      const pts = polyRef.current
      const last = pts[pts.length - 1]
      if (!last || !almostSame(last, pos.world, 0.2)) pts.push(pos.world)
      setDraft({ kind: 'polyline', points: [...pts], hover: pos.world })
    }
  }

  const onPointerMove = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const pos = eventPos(e)
    if (!pos) return
    onCursor(pos.world)
    if (!dragRef.current) hoverCursor(pos.sx, pos.sy, pos.world)

    const drag = dragRef.current
    if (drag?.kind === 'pan') {
      const dist = Math.hypot(e.clientX - drag.originX, e.clientY - drag.originY)
      const moved = drag.moved || dist > PAN_CLICK_PX
      if (moved) {
        onCameraChange(panBy(cameraRef.current, e.clientX - drag.lastX, e.clientY - drag.lastY))
      }
      dragRef.current = {
        kind: 'pan',
        lastX: e.clientX,
        lastY: e.clientY,
        originX: drag.originX,
        originY: drag.originY,
        moved,
      }
      return
    }

    if (drag?.kind === 'handle') {
      if (!drag.started) {
        onBeginMove()
        drag.started = true
      }
      const shape = shapesRef.current.find((s) => s.id === drag.hit.handle.shapeId)
      if (shape) onPatchShape(shape.id, applyHandleDrag(shape, drag.hit, pos.world))
      return
    }

    if (drag?.kind === 'move') {
      const dx = pos.world.x - drag.last.x
      const dy = pos.world.y - drag.last.y
      if (!drag.started && (dx !== 0 || dy !== 0)) {
        onBeginMove()
        drag.started = true
      }
      if (drag.started) onMoveSelected(dx, dy)
      drag.last = pos.world
      return
    }

    if (drag?.kind === 'rect') {
      setDraft({
        kind: 'rect',
        x: drag.start.x,
        y: drag.start.y,
        w: pos.world.x - drag.start.x,
        h: pos.world.y - drag.start.y,
      })
      return
    }

    if (drag?.kind === 'circle') {
      setDraft({
        kind: 'circle',
        cx: drag.start.x,
        cy: drag.start.y,
        r: Math.hypot(pos.world.x - drag.start.x, pos.world.y - drag.start.y),
      })
      return
    }

    if (drag?.kind === 'marquee') {
      setDraft({
        kind: 'marquee',
        x: drag.start.x,
        y: drag.start.y,
        w: pos.world.x - drag.start.x,
        h: pos.world.y - drag.start.y,
      })
      return
    }

    if (lineStartRef.current) {
      const s = lineStartRef.current
      setDraft({ kind: 'line', x1: s.x, y1: s.y, x2: pos.world.x, y2: pos.world.y })
    } else if (polyRef.current.length > 0) {
      setDraft({ kind: 'polyline', points: [...polyRef.current], hover: pos.world })
    }
  }

  const onPointerUp = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const pos = eventPos(e)
    const drag = dragRef.current
    dragRef.current = null
    try {
      canvasRef.current?.releasePointerCapture(e.pointerId)
    } catch {
      /* already released */
    }
    if (!pos) return
    if (e.button === 2 && drag?.kind === 'pan' && !drag.moved) {
      finishStrokeAt(pos.world)
      return
    }
    if (e.button !== 0) return

    if (drag?.kind === 'rect') {
      const box = normalizeRect(drag.start.x, drag.start.y, pos.world.x - drag.start.x, pos.world.y - drag.start.y)
      setDraft(null)
      if (box.w > 1e-4 && box.h > 1e-4) {
        onAddShape({
          type: 'rect',
          id: createShapeId(),
          ...box,
          color: styleRef.current.color,
          lineWidth: styleRef.current.lineWidth,
          fill: styleRef.current.fill,
        })
      }
      return
    }

    if (drag?.kind === 'circle') {
      const r = Math.hypot(pos.world.x - drag.start.x, pos.world.y - drag.start.y)
      setDraft(null)
      if (r > 1e-4) {
        onAddShape({
          type: 'circle',
          id: createShapeId(),
          cx: drag.start.x,
          cy: drag.start.y,
          r,
          color: styleRef.current.color,
          lineWidth: styleRef.current.lineWidth,
          fill: styleRef.current.fill,
        })
      }
      return
    }

    if (drag?.kind === 'marquee') {
      const ids = shapesInMarquee(shapesRef.current, {
        x: drag.start.x,
        y: drag.start.y,
        w: pos.world.x - drag.start.x,
        h: pos.world.y - drag.start.y,
      })
      setDraft(null)
      if (drag.additive) {
        const next = new Set(selectedRef.current)
        for (const id of ids) next.add(id)
        onSelect([...next])
      } else {
        onSelect(ids)
      }
    }
  }

  const onPointerLeave = () => {
    if (!dragRef.current) onCursor(null)
  }

  const onDoubleClick = () => {
    if (toolRef.current === 'polyline') finishPolyline()
  }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const onNativeWheel = (ev: WheelEvent) => {
      ev.preventDefault()
      const pos = eventPos(ev)
      if (!pos) return
      const factor = ev.deltaY < 0 ? 1.12 : 1 / 1.12
      onCameraChange(zoomAt(cameraRef.current, pos.view, pos.sx, pos.sy, factor))
    }
    canvas.addEventListener('wheel', onNativeWheel, { passive: false })
    return () => canvas.removeEventListener('wheel', onNativeWheel)
  }, [onCameraChange])

  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key !== 'Escape') return
      ev.preventDefault()
      cancelDraw()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div ref={wrapRef} className={cn(winChromeSunken, 'relative min-h-0 flex-1 bg-field overflow-hidden')}>
      <canvas
        ref={canvasRef}
        className='block w-full h-full touch-none cursor-crosshair'
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerLeave={onPointerLeave}
        onDoubleClick={onDoubleClick}
        onContextMenu={(e) => e.preventDefault()}
      />
    </div>
  )
}
