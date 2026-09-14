/**
 * 屏幕坐标（Canvas 绘图区，原点左上、Y 向下）
 * ↔ 世界坐标（CAD 图纸，Y 向上；默认视觉原点在画布左下）。
 * 拾取 / 绘制 / 缩放平移必须走这里，避免各处换算不一致。
 */
import { MAX_SCALE, MIN_SCALE, RULER_SIZE, type CadCamera, type CadPoint, type CadViewSize } from './types'

export function clampScale(scale: number): number {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale))
}

/** 绘图区 CSS 像素（不含标尺）→ 世界 */
export function screenToWorld(sx: number, sy: number, camera: CadCamera, view: CadViewSize): CadPoint {
  return {
    x: camera.x + sx / camera.scale,
    y: camera.y + (view.height - sy) / camera.scale,
  }
}

/** 世界 → 绘图区 CSS 像素（不含标尺） */
export function worldToScreen(wx: number, wy: number, camera: CadCamera, view: CadViewSize): CadPoint {
  return {
    x: (wx - camera.x) * camera.scale,
    y: view.height - (wy - camera.y) * camera.scale,
  }
}

/** 整块 Canvas CSS 像素（含标尺）→ 世界 */
export function canvasToWorld(cssX: number, cssY: number, camera: CadCamera, view: CadViewSize): CadPoint {
  return screenToWorld(cssX - RULER_SIZE, cssY - RULER_SIZE, camera, view)
}

/** 世界 → 整块 Canvas CSS 像素（含标尺） */
export function worldToCanvas(wx: number, wy: number, camera: CadCamera, view: CadViewSize): CadPoint {
  const s = worldToScreen(wx, wy, camera, view)
  return { x: s.x + RULER_SIZE, y: s.y + RULER_SIZE }
}

/** 右键平移：屏幕增量（右/下为正）→ 相机 */
export function panBy(camera: CadCamera, dxScreen: number, dyScreen: number): CadCamera {
  return {
    ...camera,
    x: camera.x - dxScreen / camera.scale,
    y: camera.y + dyScreen / camera.scale,
  }
}

/** 以光标（绘图区屏幕坐标）为中心缩放，缩放后该点世界坐标不变 */
export function zoomAt(
  camera: CadCamera,
  view: CadViewSize,
  sx: number,
  sy: number,
  factor: number,
): CadCamera {
  const before = screenToWorld(sx, sy, camera, view)
  const next: CadCamera = { ...camera, scale: clampScale(camera.scale * factor) }
  const after = screenToWorld(sx, sy, next, view)
  return {
    x: next.x + before.x - after.x,
    y: next.y + before.y - after.y,
    scale: next.scale,
  }
}

/** 当前视口覆盖的世界范围 */
export function worldBounds(camera: CadCamera, view: CadViewSize): { left: number; right: number; bottom: number; top: number } {
  return {
    left: camera.x,
    right: camera.x + view.width / camera.scale,
    bottom: camera.y,
    top: camera.y + view.height / camera.scale,
  }
}

/**
 * 网格步长（世界单位）：目标约 40px 一格，按 1-2-5 取整。
 */
export function gridStep(scale: number): number {
  const world = 40 / Math.max(scale, 1e-6)
  const mag = 10 ** Math.floor(Math.log10(world))
  const n = world / mag
  if (n <= 1) return mag
  if (n <= 2) return 2 * mag
  if (n <= 5) return 5 * mag
  return 10 * mag
}

export function formatTick(value: number, step: number): string {
  if (step >= 1) return String(Math.round(value))
  const digits = Math.min(4, Math.max(0, Math.ceil(-Math.log10(step))))
  const n = Number(value.toFixed(digits))
  return String(n)
}
