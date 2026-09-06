import type { Task } from '../db/schema';

export type SortMode = 'due' | 'priority' | 'created' | 'added';

/**
 * 表示順を並び替える。
 * 共通ルール: 未完了が先、完了は最後（新しい完了から）。
 * - due: 期限（なしは最後）→ 優先度 → 新しい順
 * - priority: 優先度 → 期限
 * - created: 追加の新しい順
 * - added: 追加の古い順（INBOX 固定。先に入れたものから仕分ける）
 */
export function sortTasks(tasks: Task[], mode: SortMode): Task[] {
  return [...tasks].sort((a, b) => compareTasks(a, b, mode));
}

export function compareTasks(a: Task, b: Task, mode: SortMode): number {
  const aDone = a.completedAt !== undefined;
  const bDone = b.completedAt !== undefined;
  if (aDone !== bDone) return aDone ? 1 : -1;
  if (!aDone) {
    if (mode === 'added') {
      if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? -1 : 1;
      return 0;
    }
    if (mode === 'created') {
      return compareNewestFirst(a, b);
    }
    if (mode === 'priority') {
      const ap = a.priority ?? 9;
      const bp = b.priority ?? 9;
      if (ap !== bp) return ap - bp;
    }
    if (!!a.due !== !!b.due) return a.due ? -1 : 1;
    if (a.due && b.due) {
      if (a.due !== b.due) return a.due < b.due ? -1 : 1;
      // 同じ日付なら時刻つき（その日の予定）を先に、時刻は早い順。
      // 時刻なしは '99' 扱いなので同日の最後に回る
      const at = a.dueTime ?? '99';
      const bt = b.dueTime ?? '99';
      if (at !== bt) return at < bt ? -1 : 1;
    }
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
