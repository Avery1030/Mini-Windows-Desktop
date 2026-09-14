import { MAX_HISTORY, cloneShapes, type CadShape } from './types'

/**
 * 有限长度撤销/重做栈。每次提交当前图元快照。
 */
export class CadHistory {
  private past: CadShape[][] = []
  private future: CadShape[][] = []

  constructor(private readonly max = MAX_HISTORY) {}

  get canUndo(): boolean {
    return this.past.length > 0
  }

  get canRedo(): boolean {
    return this.future.length > 0
  }

  push(current: readonly CadShape[]): void {
    this.past.push(cloneShapes(current))
    if (this.past.length > this.max) this.past.shift()
    this.future = []
  }

  undo(current: readonly CadShape[]): Nullable<CadShape[]> {
    const prev = this.past.pop()
    if (!prev) return null
    this.future.push(cloneShapes(current))
    return prev
  }

  redo(current: readonly CadShape[]): Nullable<CadShape[]> {
    const next = this.future.pop()
    if (!next) return null
    this.past.push(cloneShapes(current))
    return next
  }

  clear(): void {
    this.past = []
    this.future = []
  }
}
