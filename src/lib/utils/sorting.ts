import type { Task } from '../db/schema';

export type SortMode = 'due' | 'priority' | 'created';

/**
 * 表示順を並び替える。
 * 共通ルール: 未完了が先、完了は最後（新しい完了から）。
 * - due: 期限（なしは最後）→ 優先度 → 新しい順
 * - priority: 優先度 → 期限
 * - created: 追加の新しい順
 */
export function sortTasks(tasks: Task[], mode: SortMode): Task[] {
  return [...tasks].sort((a, b) => compareTasks(a, b, mode));
}

export function compareTasks(a: Task, b: Task, mode: SortMode): number {
  const aDone = a.completedAt !== undefined;
  const bDone = b.completedAt !== undefined;
  if (aDone !== bDone) return aDone ? 1 : -1;
  if (!aDone) {
    if (mode === 'created') {
      return compareNewestFirst(a, b);
    }
    if (mode === 'priority') {
      const ap = a.priority ?? 9;
      const bp = b.priority ?? 9;
      if (ap !== bp) return ap - bp;
    }
    if (!!a.due !== !!b.due) return a.due ? -1 : 1;
    if (a.due && b.due && a.due !== b.due) return a.due < b.due ? -1 : 1;
    const ap = a.priority ?? 9;
    const bp = b.priority ?? 9;
    if (ap !== bp) return ap - bp;
  } else if (a.completedAt !== b.completedAt) {
    return a.completedAt! < b.completedAt! ? 1 : -1;
  }
  return compareNewestFirst(a, b);
}

function compareNewestFirst(a: Task, b: Task): number {
  if (a.createdAt === b.createdAt) return 0;
  return a.createdAt < b.createdAt ? 1 : -1;
}
