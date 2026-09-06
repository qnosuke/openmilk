import type { Task } from '../db/schema';

export interface OneLevelSplit {
  /** 先頭行として表示するタスク（入力の表示順を維持） */
  rows: Task[];
  /** 親タスク id → 直下のサブタスク（入力の表示順を維持） */
  childrenByParent: Map<string, Task[]>;
}

/**
 * サブタスクは 1 階層限定。parentId を持たないタスク（= 親になりうる行）の直下だけを
 * 子としてぶら下げ、それ以外（孫・親が見つからない子）は通常行として扱う。
 * 作成側（編集ダイアログ）でも子タスクの分割はできないため、孫は通常入らないが、
 * 手入力されたバックアップ JSON 等で混ざっても表示が壊れないようにする。
 */
export function splitOneLevel(tasks: Task[]): OneLevelSplit {
  const parentIds = new Set(tasks.filter((t) => !t.parentId).map((t) => t.id));
  const rows: Task[] = [];
  const childrenByParent = new Map<string, Task[]>();
  for (const task of tasks) {
    if (task.parentId && parentIds.has(task.parentId)) {
      const arr = childrenByParent.get(task.parentId);
      if (arr) arr.push(task);
      else childrenByParent.set(task.parentId, [task]);
    } else {
      rows.push(task);
    }
  }
  return { rows, childrenByParent };
}
