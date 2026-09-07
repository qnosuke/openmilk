import { liveQuery } from 'dexie';
import { db, type List, type Task } from './schema';

export interface NewTask {
  title: string;
  notes?: string;
  due?: string;
  dueTime?: string;
  remindMinutesBefore?: number;
  priority?: 1 | 2 | 3;
  tags?: string[];
  estimateMinutes?: number;
  listId?: string;
  /** 親タスクの id（サブタスクとして作る場合） */
  parentId?: string;
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
    remindMinutesBefore: input.remindMinutesBefore,
    priority: input.priority,
    tags: input.tags ?? [],
    estimateMinutes: input.estimateMinutes,
    listId: input.listId,
    parentId: input.parentId,
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
    if (completed && task.timerStartedAt) {
      // 計測中に完了した場合は経過を実績に確定してから完了にする
      stopTimerInternal(task, nowISO());
    } else if (!completed) {
      task.timerStartedAt = undefined;
    }
    task.completedAt = completed ? nowISO() : undefined;
    task.updatedAt = nowISO();
    await db.tasks.put(task);
  });
}

export async function softDeleteTask(id: string): Promise<void> {
  await updateTask(id, { deleted: 1 });
}

/** 選択したタスクを1日延期する。期限が無いものは「明日」になる */
export async function postponeTasks(ids: string[], days = 1): Promise<void> {
  await db.transaction('rw', db.tasks, async () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + days);
    const tomorrowISO = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;
    for (const id of ids) {
      const task = await db.tasks.get(id);
      if (!task) continue;
      task.due = task.due
        ? addDaysISO(task.due, days)
        : tomorrowISO;
      task.updatedAt = nowISO();
      await db.tasks.put(task);
    }
  });
}

function addDaysISO(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** 計測中の経過を trackedMinutes に確定させ、timerStartedAt を空にする */
function stopTimerInternal(task: Task, now: string): void {
  if (!task.timerStartedAt) return;
  const elapsedMin = (Date.now() - new Date(task.timerStartedAt).getTime()) / 60_000;
  task.trackedMinutes = Math.round(((task.trackedMinutes ?? 0) + Math.max(0, elapsedMin)) * 10) / 10;
  task.timerStartedAt = undefined;
  task.updatedAt = now;
}

/** タスクの計測を開始する。他の計測中タスクがあれば自動で停止する（同時計測は不可） */
export async function startTaskTimer(id: string): Promise<void> {
  await db.transaction('rw', db.tasks, async () => {
    const now = nowISO();
    const all = await db.tasks.toArray();
    for (const t of all) {
      if (t.timerStartedAt && t.id !== id) {
        stopTimerInternal(t, now);
        await db.tasks.put(t);
      }
    }
    const task = await db.tasks.get(id);
    if (!task || task.timerStartedAt || task.completedAt !== undefined) return;
    task.timerStartedAt = now;
    task.updatedAt = now;
    await db.tasks.put(task);
  });
}

/** タスクの計測を停止し、経過を実績に加算する */
export async function stopTaskTimer(id: string): Promise<void> {
  await db.transaction('rw', db.tasks, async () => {
    const task = await db.tasks.get(id);
    if (!task?.timerStartedAt) return;
    stopTimerInternal(task, nowISO());
    await db.tasks.put(task);
  });
}

/** 完了済みタスクを論理削除する（一括消し）。戻り値は処理件数 */
export async function deleteCompletedTasks(): Promise<number> {
  let count = 0;
  await db.transaction('rw', db.tasks, async () => {
    const all = await db.tasks.toArray();
    for (const task of all) {
      if (task.completedAt !== undefined && !task.deleted) {
        task.deleted = 1;
        task.updatedAt = nowISO();
        await db.tasks.put(task);
        count += 1;
      }
    }
  });
  return count;
}

/** ゴミ箱のタスクを INBOX に戻す（復元） */
export async function restoreTasks(ids: string[]): Promise<void> {
  await db.transaction('rw', db.tasks, async () => {
    for (const id of ids) {
      const task = await db.tasks.get(id);
      if (!task) continue;
      task.deleted = 0;
      task.updatedAt = nowISO();
      await db.tasks.put(task);
    }
  });
}

/** ゴミ箱で30日以上経過したタスクを物理削除する。戻り値は消した件数 */
export async function purgeExpiredTrash(days = 30): Promise<number> {
  const cutoff = Date.now() - days * 86_400_000;
  let purged = 0;
  await db.transaction('rw', db.tasks, async () => {
    const all = await db.tasks.toArray();
    for (const task of all) {
      if (task.deleted === 1 && new Date(task.updatedAt).getTime() < cutoff) {
        await db.tasks.delete(task.id);
        purged += 1;
      }
    }
  });
  return purged;
}

/** 全タスク（削除済みも含む）。完了/ゴミ箱などの表示絞り込みは UI 側で行う */
export async function fetchVisibleTasks(): Promise<Task[]> {
  return db.tasks.toArray();
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

export const BACKUP_SCHEMA_VERSION = 4;

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
 *
 * 形式チェックは必須フィールド（createdAt/updatedAt/deleted）まで見る。
 * 例えば RTM の生エクスポートは id/name だけなら通ってしまうため、
 * タスクが全スキップされたのにリストだけ生のまま混入する事故を防ぐ。
 */
export function isValidTaskRecord(task: unknown): task is Task {
  const t = task as Task | null;
  return (
    !!t &&
    typeof t.id === 'string' &&
    typeof t.title === 'string' &&
    typeof t.createdAt === 'string' &&
    typeof t.updatedAt === 'string' &&
    (t.deleted === 0 || t.deleted === 1)
  );
}

export function isValidListRecord(list: unknown): list is List {
  const l = list as List | null;
  return (
    !!l &&
    typeof l.id === 'string' &&
    typeof l.name === 'string' &&
    typeof l.createdAt === 'string' &&
    typeof l.updatedAt === 'string' &&
    (l.deleted === 0 || l.deleted === 1)
  );
}

export async function importBackup(data: BackupData): Promise<number> {
  let imported = 0;
  await db.transaction('rw', db.tasks, db.lists, async () => {
    for (const task of data.tasks ?? []) {
      if (!isValidTaskRecord(task)) continue;
      const existing = await db.tasks.get(task.id);
      if (existing && existing.updatedAt > (task.updatedAt ?? '')) continue;
      await db.tasks.put(task);
      imported += 1;
    }
    for (const list of data.lists ?? []) {
      if (!isValidListRecord(list)) continue;
      const existing = await db.lists.get(list.id);
      if (existing && existing.updatedAt > (list.updatedAt ?? '')) continue;
      // 既存が固定リストの場合、上書きで fixed が外れないようにする
      await db.lists.put(existing?.fixed ? { ...list, fixed: 1 } : list);
    }
  });
  return imported;
}
