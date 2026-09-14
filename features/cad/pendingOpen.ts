/** 资源管理器双击 .cadjson：窗口未挂载时缓存路径 */

type OpenListener = (path: string) => void

let pendingPath: Nullable<string> = null
const listeners = new Set<OpenListener>()

export function requestOpenCad(path: string): void {
  if (listeners.size > 0) {
    for (const listener of listeners) listener(path)
    return
  }
  pendingPath = path
}

export function takePendingOpenCad(): Nullable<string> {
  const path = pendingPath
  pendingPath = null
  return path
}

export function subscribeOpenCad(listener: OpenListener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
