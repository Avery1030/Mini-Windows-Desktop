/**
 * CAD 图元与文档模型。
 * 后续扩展圆弧 / 文字标注时：在 CadShape 联合上追加 type，并同步 io / draw / hitTest。
 */

export const CAD_EXT = 'cadjson'
export const CAD_DIR = '/Documents'
export const CAD_MIME = 'application/json'
export const CAD_VERSION = 1 as const
export const MAX_HISTORY = 50
export const MAX_SHAPES = 4000
export const MIN_SCALE = 0.08
export const MAX_SCALE = 64
/** 标尺厚度（CSS 像素） */
export const RULER_SIZE = 22

export type CadTool = 'select' | 'line' | 'rect' | 'circle' | 'polyline'

export interface CadPoint {
  x: number
  y: number
}

interface CadStroke {
  color: string
  lineWidth: number
}

export interface CadLine extends CadStroke {
  type: 'line'
  id: string
  x1: number
  y1: number
  x2: number
  y2: number
}

export interface CadRect extends CadStroke {
  type: 'rect'
  id: string
  x: number
  y: number
  w: number
  h: number
  fill: boolean
}

export interface CadCircle extends CadStroke {
  type: 'circle'
  id: string
  cx: number
  cy: number
  r: number
  fill: boolean
}

export interface CadPolyline extends CadStroke {
  type: 'polyline'
  id: string
  points: CadPoint[]
}

export type CadShape = CadLine | CadRect | CadCircle | CadPolyline

export type CadDocument = {
  version: typeof CAD_VERSION
  shapes: CadShape[]
}

/** 相机：世界坐标中绘图区左下角，scale 为「屏幕像素 / 世界单位」 */
export type CadCamera = {
  x: number
  y: number
  scale: number
}

export type CadViewSize = {
  width: number
  height: number
}

export type CadStyleState = {
  color: string
  lineWidth: number
  fill: boolean
}

/** 绘制预览（世界坐标） */
export type CadDraft =
  | { kind: 'line'; x1: number; y1: number; x2: number; y2: number }
  | { kind: 'rect'; x: number; y: number; w: number; h: number }
  | { kind: 'circle'; cx: number; cy: number; r: number }
  | { kind: 'polyline'; points: CadPoint[]; hover: Nullable<CadPoint> }
  | { kind: 'marquee'; x: number; y: number; w: number; h: number }

export const DEFAULT_STYLE: CadStyleState = {
  color: '#000000',
  lineWidth: 2,
  fill: false,
}

export const DEFAULT_CAMERA: CadCamera = {
  x: -40,
  y: -40,
  scale: 2,
}

export const CAD_PALETTE = [
  '#000000',
  '#808080',
  '#800000',
  '#ff0000',
  '#808000',
  '#ffff00',
  '#008000',
  '#00ff00',
  '#008080',
  '#00ffff',
  '#000080',
  '#0000ff',
  '#800080',
  '#ff00ff',
  '#c0c0c0',
  '#ffffff',
] as const

export const CAD_LINE_WIDTHS = [1, 2, 3, 4, 6, 8] as const

export function createShapeId(): string {
  return `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
}

export function cloneShapes(shapes: readonly CadShape[]): CadShape[] {
  return shapes.map((s) => {
    if (s.type === 'polyline') return { ...s, points: s.points.map((p) => ({ ...p })) }
    return { ...s }
  })
}

export function normalizeRect(x: number, y: number, w: number, h: number): { x: number; y: number; w: number; h: number } {
  let nx = x
  let ny = y
  let nw = w
  let nh = h
  if (nw < 0) {
    nx += nw
    nw = -nw
  }
  if (nh < 0) {
    ny += nh
    nh = -nh
  }
  return { x: nx, y: ny, w: nw, h: nh }
}

export function translateShape(shape: CadShape, dx: number, dy: number): CadShape {
  if (shape.type === 'line') {
    return { ...shape, x1: shape.x1 + dx, y1: shape.y1 + dy, x2: shape.x2 + dx, y2: shape.y2 + dy }
  }
  if (shape.type === 'rect') {
    return { ...shape, x: shape.x + dx, y: shape.y + dy }
  }
  if (shape.type === 'circle') {
    return { ...shape, cx: shape.cx + dx, cy: shape.cy + dy }
  }
  return { ...shape, points: shape.points.map((p) => ({ x: p.x + dx, y: p.y + dy })) }
}
