import { liveQuery } from 'dexie';
import { db, type List, type Task } from './schema';

export interface NewTask {
  title: string;
  notes?: string;
  due?: string;
  dueTime?: string;
  priority?: 1 | 2 | 3;
  tags?: string[];
  estimateMinutes?: number;
  listId?: string;
}

function nowISO(): string {
  return new Date().toISOString();
}

export async function createTask(input: NewTask): Promise<Task> {
  const now = nowISO();
  const task: Task = {
    id: crypto.randomUUID(),
    title: input.title.trim(),
    notes: input.notes,
    due: input.due,
    dueTime: input.dueTime,
    priority: input.priority,
    tags: input.tags ?? [],
    estimateMinutes: input.estimateMinutes,
    listId: input.listId,
    createdAt: now,
    updatedAt: now,
    deleted: 0,
  };
  await db.tasks.add(task);
  return task;
}

/**
 * 部分更新は必ずこの関数経由（updatedAt を自動更新）。
 * undefined を代入するとフィールドが消えるため、get→put で適用する。
 * 完了状態の変更は setCompleted を使う。
 */
export async function updateTask(
  id: string,
  changes: Partial<Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'completedAt'>>,
): Promise<void> {
  await db.transaction('rw', db.tasks, async () => {
    const task = await db.tasks.get(id);
    if (!task) return;
    Object.assign(task, changes, { updatedAt: nowISO() });
    await db.tasks.put(task);
  });
}

export async function setCompleted(id: string, completed: boolean): Promise<void> {
  await db.transaction('rw', db.tasks, async () => {
    const task = await db.tasks.get(id);
    if (!task) return;
    task.completedAt = completed ? nowISO() : undefined;
    task.updatedAt = nowISO();
    await db.tasks.put(task);
  });
}

export async function softDeleteTask(id: string): Promise<void> {
  await updateTask(id, { deleted: 1 });
}

/** 全未削除タスク。表示順は UI 側 (sortTasks) で決める */
export async function fetchVisibleTasks(): Promise<Task[]> {
  return db.tasks.where('deleted').equals(0).toArray();
}

/** UI 向けライブクエリ。DB が変わると自動で再通知される。戻り値の関数で購読解除 */
export function observeVisibleTasks(cb: (tasks: Task[]) => void): () => void {
  const subscription = liveQuery(fetchVisibleTasks).subscribe({
    next: (tasks) => cb(tasks ?? []),
    error: (err) => console.error('openmilk: liveQuery error', err),
  });
  return () => subscription.unsubscribe();
}

export async function createList(name: string): Promise<List> {
  const now = nowISO();
  const existing = await db.lists.count();
  const list: List = {
    id: crypto.randomUUID(),
    name: name.trim(),
    order: existing,
    createdAt: now,
    updatedAt: now,
    deleted: 0,
  };
  await db.lists.add(list);
  return list;
}

/** GTD の固定リスト。同名のリストがあれば固定化して再利用する */
export const FIXED_LIST_NAMES = ['next action', 'waiting', 'someday'] as const;
const FIXED_LIST_ORDER: Record<string, number> = {
  'next action': -3,
  waiting: -2,
  someday: -1,
};

/**
 * 起動時に一度呼び、固定リストが揃っていることを保証する（冪等）。
 * バックアップ移行などで同名リストが重複した場合は、タスクを正規リスト側に
 * 統合してから重複を削除する（自己修復）。
 */
export async function ensureFixedLists(): Promise<void> {
  await db.transaction('rw', db.lists, db.tasks, async () => {
    const now = nowISO();
    const all = await db.lists.toArray();
    for (const name of FIXED_LIST_NAMES) {
      const targetOrder = FIXED_LIST_ORDER[name];
      const matches = all
        .filter((l) => !l.deleted && l.name.toLowerCase() === name)
        .sort((a, b) => (b.fixed ?? 0) - (a.fixed ?? 0));
      if (matches.length === 0) {
        await db.lists.add({
          id: crypto.randomUUID(),
          name,
          order: targetOrder,
          createdAt: now,
          updatedAt: now,
          deleted: 0,
          fixed: 1,
        });
        continue;
      }
      // fixed になっているもの（なければ先頭）を正規リストにする
      const canonical: List = { ...matches[0], fixed: 1, order: targetOrder, updatedAt: now };
      await db.lists.put(canonical);
      for (const dup of matches.slice(1)) {
        const dupTasks = await db.tasks.where('listId').equals(dup.id).toArray();
        for (const t of dupTasks) {
          await db.tasks.put({ ...t, listId: canonical.id, updatedAt: now });
        }
        await db.lists.delete(dup.id);
      }
    }
  });
}

/** リストを削除する。タスクは失わない（INBOX へ戻す）。固定リストは削除できない */
export async function deleteList(id: string): Promise<void> {
  await db.transaction('rw', db.lists, db.tasks, async () => {
    const list = await db.lists.get(id);
    if (list?.fixed) return;
    const now = nowISO();
    const tasks = await db.tasks.where('listId').equals(id).toArray();
    for (const task of tasks) {
      task.listId = undefined;
      task.updatedAt = now;
      await db.tasks.put(task);
    }
    await db.lists.delete(id);
  });
}

export function observeLists(cb: (lists: List[]) => void): () => void {
  const subscription = liveQuery(async () => {
    const all = await db.lists.where('deleted').equals(0).toArray();
    return all.sort((a, b) => a.order - b.order || (a.createdAt < b.createdAt ? -1 : 1));
  }).subscribe({
    next: (lists) => cb(lists ?? []),
    error: (err) => console.error('openmilk: lists liveQuery error', err),
  });
  return () => subscription.unsubscribe();
}

// --- バックアップ ---

export const BACKUP_SCHEMA_VERSION = 3;

export interface BackupData {
  schemaVersion: number;
  exportedAt: string;
  /** 論理削除済みも含む全データ */
  tasks: Task[];
  lists: List[];
}

export async function exportAll(): Promise<BackupData> {
  const [tasks, lists] = await Promise.all([db.tasks.toArray(), db.lists.toArray()]);
  return { schemaVersion: BACKUP_SCHEMA_VERSION, exportedAt: nowISO(), tasks, lists };
}

/**
 * バックアップを取り込む（冪等マージ）。
 * 同じ id のレコードは updatedAt が新しい方を採用し、同時刻なら
 * 取り込み側を優先する（変換ツールでフィールドを増やした再取り込みが反映される）。
 * 戻り値は取り込んだタスク数。
 */
export async function importBackup(data: BackupData): Promise<number> {
  let imported = 0;
  await db.transaction('rw', db.tasks, db.lists, async () => {
    for (const task of data.tasks ?? []) {
      if (!task?.id || typeof task.title !== 'string') continue;
      const existing = await db.tasks.get(task.id);
      if (existing && existing.updatedAt > (task.updatedAt ?? '')) continue;
      await db.tasks.put(task);
      imported += 1;
    }
    for (const list of data.lists ?? []) {
      if (!list?.id || typeof list.name !== 'string') continue;
      const existing = await db.lists.get(list.id);
      if (existing && existing.updatedAt > (list.updatedAt ?? '')) continue;
      // 既存が固定リストの場合、上書きで fixed が外れないようにする
      await db.lists.put(existing?.fixed ? { ...list, fixed: 1 } : list);
    }
  });
  return imported;
}
