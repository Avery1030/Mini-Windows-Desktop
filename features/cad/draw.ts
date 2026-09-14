import { formatTick, gridStep, worldBounds, worldToScreen } from './coords'
import { handlesForShape, HANDLE_SIZE_PX } from './handles'
import {
  RULER_SIZE,
  normalizeRect,
  type CadCamera,
  type CadDraft,
  type CadShape,
  type CadViewSize,
} from './types'

const GRID = '#c8c8c8'
const AXIS = '#404040'
const RULER_BG = '#d4d0c8'
const RULER_FG = '#000000'
const SELECT = '#000080'
const PREVIEW_ALPHA = 0.45

function applyStroke(ctx: CanvasRenderingContext2D, color: string, lineWidth: number, alpha = 1): void {
  ctx.globalAlpha = alpha
  ctx.strokeStyle = color
  ctx.fillStyle = color
  ctx.lineWidth = Math.max(1, lineWidth)
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
}

function strokeShape(ctx: CanvasRenderingContext2D, shape: CadShape, camera: CadCamera, view: CadViewSize): void {
  if (shape.type === 'line') {
    const a = worldToScreen(shape.x1, shape.y1, camera, view)
    const b = worldToScreen(shape.x2, shape.y2, camera, view)
    ctx.beginPath()
    ctx.moveTo(a.x, a.y)
    ctx.lineTo(b.x, b.y)
    ctx.stroke()
    return
  }
  if (shape.type === 'rect') {
    const r = normalizeRect(shape.x, shape.y, shape.w, shape.h)
    const p = worldToScreen(r.x, r.y + r.h, camera, view)
    const w = r.w * camera.scale
    const h = r.h * camera.scale
    if (shape.fill) {
      ctx.save()
      ctx.globalAlpha *= 0.35
      ctx.fillRect(p.x, p.y, w, h)
      ctx.restore()
    }
    ctx.strokeRect(p.x, p.y, w, h)
    return
  }
  if (shape.type === 'circle') {
    const c = worldToScreen(shape.cx, shape.cy, camera, view)
    const rad = Math.max(0.5, shape.r * camera.scale)
    ctx.beginPath()
    ctx.arc(c.x, c.y, rad, 0, Math.PI * 2)
    if (shape.fill) {
      ctx.save()
      ctx.globalAlpha *= 0.35
      ctx.fill()
      ctx.restore()
      ctx.beginPath()
      ctx.arc(c.x, c.y, rad, 0, Math.PI * 2)
    }
    ctx.stroke()
    return
  }
  if (shape.points.length < 2) return
  ctx.beginPath()
  shape.points.forEach((pt, i) => {
    const s = worldToScreen(pt.x, pt.y, camera, view)
    if (i === 0) ctx.moveTo(s.x, s.y)
    else ctx.lineTo(s.x, s.y)
  })
  ctx.stroke()
}

function draftToShape(draft: CadDraft, color: string, lineWidth: number, fill: boolean): Nullable<CadShape> {
  if (!draft || draft.kind === 'marquee') return null
  if (draft.kind === 'line') {
    return { type: 'line', id: '_draft', x1: draft.x1, y1: draft.y1, x2: draft.x2, y2: draft.y2, color, lineWidth }
  }
  if (draft.kind === 'rect') {
    return { type: 'rect', id: '_draft', x: draft.x, y: draft.y, w: draft.w, h: draft.h, color, lineWidth, fill }
  }
  if (draft.kind === 'circle') {
    return { type: 'circle', id: '_draft', cx: draft.cx, cy: draft.cy, r: draft.r, color, lineWidth, fill }
  }
  const points = draft.hover ? [...draft.points, draft.hover] : draft.points
  if (points.length < 2) return null
  return { type: 'polyline', id: '_draft', points, color, lineWidth }
}

function drawGrid(ctx: CanvasRenderingContext2D, camera: CadCamera, view: CadViewSize): void {
  const bounds = worldBounds(camera, view)
  const step = gridStep(camera.scale)
  const x0 = Math.floor(bounds.left / step) * step
  const y0 = Math.floor(bounds.bottom / step) * step

  ctx.beginPath()
  ctx.strokeStyle = GRID
  ctx.lineWidth = 1
  ctx.globalAlpha = 1
  for (let x = x0; x <= bounds.right + step * 0.01; x += step) {
    const s = worldToScreen(x, 0, camera, view)
    ctx.moveTo(s.x + 0.5, 0)
    ctx.lineTo(s.x + 0.5, view.height)
  }
  for (let y = y0; y <= bounds.top + step * 0.01; y += step) {
    const s = worldToScreen(0, y, camera, view)
    ctx.moveTo(0, s.y + 0.5)
    ctx.lineTo(view.width, s.y + 0.5)
  }
  ctx.stroke()
}

function drawAxes(ctx: CanvasRenderingContext2D, camera: CadCamera, view: CadViewSize): void {
  const origin = worldToScreen(0, 0, camera, view)
  ctx.globalAlpha = 1
  ctx.strokeStyle = AXIS
  ctx.fillStyle = AXIS
  ctx.lineWidth = 1.5

  ctx.beginPath()
  ctx.moveTo(0, origin.y + 0.5)
  ctx.lineTo(view.width, origin.y + 0.5)
  ctx.moveTo(origin.x + 0.5, 0)
  ctx.lineTo(origin.x + 0.5, view.height)
  ctx.stroke()

  ctx.font = '11px Tahoma, sans-serif'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  ctx.fillText('X', view.width - 12, origin.y + 4)
  ctx.fillText('Y', origin.x + 6, 4)
}

function drawRulers(ctx: CanvasRenderingContext2D, camera: CadCamera, view: CadViewSize, cssW: number, cssH: number): void {
  const step = gridStep(camera.scale)
  const bounds = worldBounds(camera, view)

  ctx.globalAlpha = 1
  ctx.fillStyle = RULER_BG
  ctx.fillRect(0, 0, cssW, RULER_SIZE)
  ctx.fillRect(0, 0, RULER_SIZE, cssH)

  ctx.strokeStyle = '#808080'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(0, RULER_SIZE - 0.5)
  ctx.lineTo(cssW, RULER_SIZE - 0.5)
  ctx.moveTo(RULER_SIZE - 0.5, 0)
  ctx.lineTo(RULER_SIZE - 0.5, cssH)
  ctx.stroke()

  ctx.fillStyle = RULER_FG
  ctx.strokeStyle = RULER_FG
  ctx.font = '10px Tahoma, sans-serif'

  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  const x0 = Math.floor(bounds.left / step) * step
  for (let x = x0; x <= bounds.right + step * 0.01; x += step) {
    const s = worldToScreen(x, 0, camera, view)
    const px = s.x + RULER_SIZE
    if (px < RULER_SIZE - 2 || px > cssW) continue
    ctx.beginPath()
    ctx.moveTo(px + 0.5, RULER_SIZE)
    ctx.lineTo(px + 0.5, RULER_SIZE - 8)
    ctx.stroke()
    ctx.fillText(formatTick(x, step), px, 3)
  }

  ctx.textAlign = 'right'
  ctx.textBaseline = 'middle'
  const y0 = Math.floor(bounds.bottom / step) * step
  for (let y = y0; y <= bounds.top + step * 0.01; y += step) {
    const s = worldToScreen(0, y, camera, view)
    const py = s.y + RULER_SIZE
    if (py < RULER_SIZE - 2 || py > cssH) continue
    ctx.beginPath()
    ctx.moveTo(RULER_SIZE, py + 0.5)
    ctx.lineTo(RULER_SIZE - 8, py + 0.5)
    ctx.stroke()
    ctx.save()
    ctx.translate(RULER_SIZE - 10, py)
    ctx.rotate(-Math.PI / 2)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'bottom'
    ctx.fillText(formatTick(y, step), 0, 0)
    ctx.restore()
  }

  ctx.fillStyle = RULER_BG
  ctx.fillRect(0, 0, RULER_SIZE, RULER_SIZE)
  ctx.strokeStyle = '#808080'
  ctx.strokeRect(0.5, 0.5, RULER_SIZE - 1, RULER_SIZE - 1)
}

function drawMarquee(ctx: CanvasRenderingContext2D, draft: Extract<CadDraft, { kind: 'marquee' }>, camera: CadCamera, view: CadViewSize): void {
  const r = normalizeRect(draft.x, draft.y, draft.w, draft.h)
  const p = worldToScreen(r.x, r.y + r.h, camera, view)
  ctx.save()
  ctx.globalAlpha = 1
  ctx.setLineDash([4, 3])
  ctx.strokeStyle = SELECT
  ctx.lineWidth = 1
  ctx.fillStyle = 'rgba(0, 0, 128, 0.08)'
  ctx.fillRect(p.x, p.y, r.w * camera.scale, r.h * camera.scale)
  ctx.strokeRect(p.x, p.y, r.w * camera.scale, r.h * camera.scale)
  ctx.restore()
}

function drawHandles(ctx: CanvasRenderingContext2D, shape: CadShape, camera: CadCamera, view: CadViewSize): void {
  const half = HANDLE_SIZE_PX / 2
  ctx.save()
  ctx.globalAlpha = 1
  ctx.setLineDash([])
  for (const hit of handlesForShape(shape)) {
    const s = worldToScreen(hit.world.x, hit.world.y, camera, view)
    ctx.fillStyle = '#ffffff'
    ctx.strokeStyle = SELECT
    ctx.lineWidth = 1
    ctx.fillRect(s.x - half, s.y - half, HANDLE_SIZE_PX, HANDLE_SIZE_PX)
    ctx.strokeRect(s.x - half + 0.5, s.y - half + 0.5, HANDLE_SIZE_PX - 1, HANDLE_SIZE_PX - 1)
  }
  ctx.restore()
}

/**
 * 分层绘制：网格/轴/标尺 → 图元 → 选中高亮/预览。
 * ctx 应已按 devicePixelRatio 缩放到 CSS 像素。
 */
export function drawCadFrame(
  ctx: CanvasRenderingContext2D,
  opts: {
    cssW: number
    cssH: number
    view: CadViewSize
    camera: CadCamera
    shapes: readonly CadShape[]
    selectedIds: ReadonlySet<string>
    draft: Nullable<CadDraft>
    styleColor: string
    styleWidth: number
    styleFill: boolean
  },
): void {
  const { cssW, cssH, view, camera, shapes, selectedIds, draft } = opts
  ctx.clearRect(0, 0, cssW, cssH)

  ctx.save()
  ctx.beginPath()
  ctx.rect(RULER_SIZE, RULER_SIZE, view.width, view.height)
  ctx.clip()
  ctx.translate(RULER_SIZE, RULER_SIZE)

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, view.width, view.height)

  drawGrid(ctx, camera, view)
  drawAxes(ctx, camera, view)

  for (const shape of shapes) {
    applyStroke(ctx, shape.color, shape.lineWidth)
    strokeShape(ctx, shape, camera, view)
  }

  if (selectedIds.size > 0) {
    for (const shape of shapes) {
      if (!selectedIds.has(shape.id)) continue
      applyStroke(ctx, SELECT, shape.lineWidth + 2)
      ctx.setLineDash([5, 3])
      strokeShape(ctx, shape, camera, view)
      ctx.setLineDash([])
    }
  }

  if (draft?.kind === 'marquee') {
    drawMarquee(ctx, draft, camera, view)
  } else if (draft) {
    const preview = draftToShape(draft, opts.styleColor, opts.styleWidth, opts.styleFill)
    if (preview) {
      applyStroke(ctx, opts.styleColor, opts.styleWidth, PREVIEW_ALPHA)
      strokeShape(ctx, preview, camera, view)
    }
  }

  if (selectedIds.size === 1) {
    const selected = shapes.find((s) => selectedIds.has(s.id))
    if (selected) drawHandles(ctx, selected, camera, view)
  }

  ctx.restore()
  ctx.globalAlpha = 1
  drawRulers(ctx, camera, view, cssW, cssH)
}
