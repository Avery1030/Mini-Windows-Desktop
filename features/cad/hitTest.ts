import type { CadPoint, CadShape } from './types'
import { normalizeRect } from './types'

export type CadBounds = { x: number; y: number; w: number; h: number }

function distToSegment(p: CadPoint, a: CadPoint, b: CadPoint): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len2 = dx * dx + dy * dy
  if (len2 < 1e-12) return Math.hypot(p.x - a.x, p.y - a.y)
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2))
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy))
}

function rectsIntersect(a: CadBounds, b: CadBounds): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
}

function nearRectEdge(p: CadPoint, r: CadBounds, pad: number): boolean {
  const inX = p.x >= r.x - pad && p.x <= r.x + r.w + pad
  const inY = p.y >= r.y - pad && p.y <= r.y + r.h + pad
  if (!inX || !inY) return false
  return (
    Math.abs(p.x - r.x) <= pad ||
    Math.abs(p.x - (r.x + r.w)) <= pad ||
    Math.abs(p.y - r.y) <= pad ||
    Math.abs(p.y - (r.y + r.h)) <= pad
  )
}

export function shapeBounds(shape: CadShape): CadBounds {
  if (shape.type === 'line') {
    const x = Math.min(shape.x1, shape.x2)
    const y = Math.min(shape.y1, shape.y2)
    return { x, y, w: Math.abs(shape.x2 - shape.x1), h: Math.abs(shape.y2 - shape.y1) }
  }
  if (shape.type === 'rect') {
    return normalizeRect(shape.x, shape.y, shape.w, shape.h)
  }
  if (shape.type === 'circle') {
    return { x: shape.cx - shape.r, y: shape.cy - shape.r, w: shape.r * 2, h: shape.r * 2 }
  }
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const p of shape.points) {
    minX = Math.min(minX, p.x)
    minY = Math.min(minY, p.y)
    maxX = Math.max(maxX, p.x)
    maxY = Math.max(maxY, p.y)
  }
  if (!Number.isFinite(minX)) return { x: 0, y: 0, w: 0, h: 0 }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY }
}

/** 拾取缓冲（世界单位）：细线至少约 8px，并随线宽加宽 */
export function hitPadWorld(shape: CadShape, scale: number): number {
  const px = Math.max(8, shape.lineWidth * 0.5 + 5)
  return px / Math.max(scale, 1e-6)
}

export function hitTestShape(shape: CadShape, p: CadPoint, hitPad: number): boolean {
  if (shape.type === 'line') {
    return distToSegment(p, { x: shape.x1, y: shape.y1 }, { x: shape.x2, y: shape.y2 }) <= hitPad
  }
  if (shape.type === 'rect') {
    const r = normalizeRect(shape.x, shape.y, shape.w, shape.h)
    if (shape.fill) {
      return p.x >= r.x - hitPad && p.x <= r.x + r.w + hitPad && p.y >= r.y - hitPad && p.y <= r.y + r.h + hitPad
    }
    return nearRectEdge(p, r, hitPad)
  }
  if (shape.type === 'circle') {
    const d = Math.hypot(p.x - shape.cx, p.y - shape.cy)
    if (shape.fill) return d <= shape.r + hitPad
    return Math.abs(d - shape.r) <= hitPad
  }
  for (let i = 1; i < shape.points.length; i++) {
    const a = shape.points[i - 1]
    const b = shape.points[i]
    if (a && b && distToSegment(p, a, b) <= hitPad) return true
  }
  return false
}

/** 从上往下（后绘制优先）点选 */
export function pickShape(shapes: readonly CadShape[], p: CadPoint, scale: number): Nullable<CadShape> {
  for (let i = shapes.length - 1; i >= 0; i--) {
    const s = shapes[i]
    if (s && hitTestShape(s, p, hitPadWorld(s, scale))) return s
  }
  return null
}

export function shapesInMarquee(shapes: readonly CadShape[], marquee: CadBounds): string[] {
  const box = normalizeRect(marquee.x, marquee.y, marquee.w, marquee.h)
  if (box.w < 1e-6 && box.h < 1e-6) return []
  return shapes.filter((s) => rectsIntersect(shapeBounds(s), box)).map((s) => s.id)
}
