import { getBasename, getExtension, getParentPath, joinPath, sanitizeFileStem, vfs, type FileNode } from '@/lib/vfs'
import {
  CAD_DIR,
  CAD_EXT,
  CAD_MIME,
  CAD_VERSION,
  MAX_SHAPES,
  cloneShapes,
  createShapeId,
  type CadCircle,
  type CadDocument,
  type CadLine,
  type CadPoint,
  type CadPolyline,
  type CadRect,
  type CadShape,
} from './types'

const MAX_JSON_CHARS = 700_000

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v)
}

function asColor(v: unknown, fallback = '#000000'): string {
  if (typeof v !== 'string') return fallback
  const s = v.trim()
  if (/^#[0-9a-fA-F]{6}$/.test(s)) return s.toLowerCase()
  if (/^#[0-9a-fA-F]{3}$/.test(s)) {
    const r = s[1]
    const g = s[2]
    const b = s[3]
    if (r && g && b) return `#${r}${r}${g}${g}${b}${b}`.toLowerCase()
  }
  return fallback
}

function asWidth(v: unknown, fallback = 2): number {
  if (!isFiniteNumber(v)) return fallback
  return Math.min(32, Math.max(1, Math.round(v)))
}

function asPoint(v: unknown): Nullable<CadPoint> {
  if (!v || typeof v !== 'object') return null
  const o = v as { x?: unknown; y?: unknown }
  if (!isFiniteNumber(o.x) || !isFiniteNumber(o.y)) return null
  return { x: o.x, y: o.y }
}

function parseShape(raw: unknown): Nullable<CadShape> {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const id = typeof o.id === 'string' && o.id ? o.id : createShapeId()
  const color = asColor(o.color)
  const lineWidth = asWidth(o.lineWidth)
  const type = o.type

  if (type === 'line' && isFiniteNumber(o.x1) && isFiniteNumber(o.y1) && isFiniteNumber(o.x2) && isFiniteNumber(o.y2)) {
    const line: CadLine = { type: 'line', id, x1: o.x1, y1: o.y1, x2: o.x2, y2: o.y2, color, lineWidth }
    return line
  }
  if (type === 'rect' && isFiniteNumber(o.x) && isFiniteNumber(o.y) && isFiniteNumber(o.w) && isFiniteNumber(o.h)) {
    const rect: CadRect = {
      type: 'rect',
      id,
      x: o.x,
      y: o.y,
      w: o.w,
      h: o.h,
      color,
      lineWidth,
      fill: Boolean(o.fill),
    }
    return rect
  }
  if (type === 'circle' && isFiniteNumber(o.cx) && isFiniteNumber(o.cy) && isFiniteNumber(o.r) && o.r >= 0) {
    const circle: CadCircle = {
      type: 'circle',
      id,
      cx: o.cx,
      cy: o.cy,
      r: o.r,
      color,
      lineWidth,
      fill: Boolean(o.fill),
    }
    return circle
  }
  if (type === 'polyline' && Array.isArray(o.points)) {
    const points: CadPoint[] = []
    for (const p of o.points) {
      const pt = asPoint(p)
      if (pt) points.push(pt)
    }
    if (points.length < 2) return null
    const poly: CadPolyline = { type: 'polyline', id, points, color, lineWidth }
    return poly
  }
  return null
}

export function parseCadDocument(raw: unknown): CadDocument {
  let data: unknown = raw
  if (typeof raw === 'string') {
    const trimmed = raw.trim()
    if (!trimmed) return { version: CAD_VERSION, shapes: [] }
    try {
      data = JSON.parse(trimmed) as unknown
    } catch {
      throw new Error('Invalid CAD JSON')
    }
  }
  if (!data || typeof data !== 'object') throw new Error('Invalid CAD JSON')
  const root = data as { version?: unknown; shapes?: unknown }
  const list = Array.isArray(root.shapes) ? root.shapes : Array.isArray(data) ? data : []
  const shapes: CadShape[] = []
  for (const item of list) {
    if (shapes.length >= MAX_SHAPES) break
    const s = parseShape(item)
    if (s) shapes.push(s)
  }
  return { version: CAD_VERSION, shapes }
}

export function serializeCadDocument(shapes: readonly CadShape[]): string {
  const doc: CadDocument = { version: CAD_VERSION, shapes: cloneShapes(shapes) }
  const json = JSON.stringify(doc)
  if (json.length > MAX_JSON_CHARS) throw new Error('Drawing too large')
  return json
}

export function isCadPath(path: string): boolean {
  return getExtension(path).toLowerCase() === CAD_EXT
}

export function ensureCadFileName(raw: string, fallback = 'untitled'): string {
  const stripped = raw.replace(new RegExp(`\\.${CAD_EXT}$`, 'i'), '')
  const stem = sanitizeFileStem(stripped, fallback)
  return `${stem}.${CAD_EXT}`
}

export function cadTitleFromPath(path: string): string {
  return getBasename(path)
}

async function ensureDir(path: string): Promise<void> {
  try {
    await vfs.readDir(path)
  } catch {
    await vfs.mkdir(path)
  }
}

export async function loadCadFile(path: string): Promise<{ node: FileNode; shapes: CadShape[] }> {
  const { content, node } = await vfs.readFile(path)
  if (!isCadPath(node.path)) throw new Error('Not a CAD file')
  const text = typeof content === 'string' ? content : new TextDecoder().decode(content)
  const doc = parseCadDocument(text)
  return { node, shapes: doc.shapes }
}

export async function saveCadFile(path: string, shapes: readonly CadShape[]): Promise<FileNode> {
  const name = ensureCadFileName(getBasename(path))
  const parent = getParentPath(path)
  const dest = parent === '/' ? `/${name}` : joinPath(parent, name)
  await ensureDir(parent === '/' ? '/' : parent)
  const body = serializeCadDocument(shapes)
  return vfs.writeFile(dest, body, CAD_MIME)
}

export async function saveCadFileAs(dir: string, fileName: string, shapes: readonly CadShape[]): Promise<FileNode> {
  await ensureDir(dir || CAD_DIR)
  const name = ensureCadFileName(fileName)
  const path = joinPath(dir || CAD_DIR, name)
  return saveCadFile(path, shapes)
}
