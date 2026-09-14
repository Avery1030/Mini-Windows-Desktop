import { worldToScreen } from './coords'
import { normalizeRect, type CadCamera, type CadPoint, type CadShape, type CadViewSize } from './types'

export type CadHandle =
  | { shapeId: string; kind: 'rect-corner'; corner: 0 | 1 | 2 | 3 }
  | { shapeId: string; kind: 'circle-radius' }
  | { shapeId: string; kind: 'poly-vertex'; index: number }

export type CadHandleHit = {
  handle: CadHandle
  world: CadPoint
  /** 矩形对角锚点（拖拽时保持对角不动） */
  anchor?: CadPoint
}

export const HANDLE_SIZE_PX = 6
const HANDLE_HIT_PX = 8

function rectCorners(shape: Extract<CadShape, { type: 'rect' }>): CadPoint[] {
  const r = normalizeRect(shape.x, shape.y, shape.w, shape.h)
  return [
    { x: r.x, y: r.y },
    { x: r.x + r.w, y: r.y },
    { x: r.x + r.w, y: r.y + r.h },
    { x: r.x, y: r.y + r.h },
  ]
}

export function handlesForShape(shape: CadShape): CadHandleHit[] {
  if (shape.type === 'rect') {
    const corners = rectCorners(shape)
    return corners.map((world, i) => {
      const corner = i as 0 | 1 | 2 | 3
      const opp = corners[(i + 2) % 4]!
      return {
        handle: { shapeId: shape.id, kind: 'rect-corner', corner },
        world,
        anchor: opp,
      }
    })
  }
  if (shape.type === 'circle') {
    return [
      {
        handle: { shapeId: shape.id, kind: 'circle-radius' },
        world: { x: shape.cx + shape.r, y: shape.cy },
      },
    ]
  }
  if (shape.type === 'polyline') {
    return shape.points.map((world, index) => ({
      handle: { shapeId: shape.id, kind: 'poly-vertex', index },
      world,
    }))
  }
  return []
}

/** 仅在单选时显示/拾取控制点 */
export function pickHandle(
  shapes: readonly CadShape[],
  selectedIds: readonly string[],
  sx: number,
  sy: number,
  camera: CadCamera,
  view: CadViewSize,
): Nullable<CadHandleHit> {
  if (selectedIds.length !== 1) return null
  const id = selectedIds[0]
  const shape = shapes.find((s) => s.id === id)
  if (!shape) return null
  for (const hit of handlesForShape(shape)) {
    const s = worldToScreen(hit.world.x, hit.world.y, camera, view)
    if (Math.hypot(s.x - sx, s.y - sy) <= HANDLE_HIT_PX) return hit
  }
  return null
}

export function applyHandleDrag(shape: CadShape, hit: CadHandleHit, p: CadPoint): CadShape {
  if (hit.handle.kind === 'rect-corner' && shape.type === 'rect' && hit.anchor) {
    const box = normalizeRect(hit.anchor.x, hit.anchor.y, p.x - hit.anchor.x, p.y - hit.anchor.y)
    if (box.w < 1e-4) box.w = 1e-4
    if (box.h < 1e-4) box.h = 1e-4
    return { ...shape, ...box }
  }
  if (hit.handle.kind === 'circle-radius' && shape.type === 'circle') {
    return { ...shape, r: Math.max(1e-4, Math.hypot(p.x - shape.cx, p.y - shape.cy)) }
  }
  if (hit.handle.kind === 'poly-vertex' && shape.type === 'polyline') {
    const index = hit.handle.index
    return {
      ...shape,
      points: shape.points.map((pt, i) => (i === index ? { x: p.x, y: p.y } : pt)),
    }
  }
  return shape
}
