import { liveQuery } from 'dexie';
import { db, type Task } from './schema';

export interface NewTask {
  title: string;
  notes?: string;
  due?: string;
  priority?: 1 | 2 | 3;
  tags?: string[];
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
    priority: input.priority,
    tags: input.tags ?? [],
    createdAt: now,
    updatedAt: now,
    deleted: 0,
  };
  await db.tasks.add(task);
  return task;
}

/** 部分更新は必ずこの関数経由（updatedAt を自動更新）。完了状態の変更は setCompleted を使う */
export async function updateTask(
  id: string,
  changes: Partial<Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'completedAt'>>,
): Promise<void> {
  await db.tasks.update(id, { ...changes, updatedAt: nowISO() });
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

/** 未削除タスクを表示順で返す: 未完了（期限→優先度→新しい順）→ 完了（新しい順） */
export async function fetchVisibleTasks(): Promise<Task[]> {
  const all = await db.tasks.where('deleted').equals(0).toArray();
  return all.sort(compareTasks);
}

export function compareTasks(a: Task, b: Task): number {
  const aDone = a.completedAt !== undefined;
  const bDone = b.completedAt !== undefined;
  if (aDone !== bDone) return aDone ? 1 : -1;
  if (!aDone) {
    if (!!a.due !== !!b.due) return a.due ? -1 : 1;
    if (a.due && b.due && a.due !== b.due) return a.due < b.due ? -1 : 1;
    const ap = a.priority ?? 9;
    const bp = b.priority ?? 9;
    if (ap !== bp) return ap - bp;
  } else if (a.completedAt !== b.completedAt) {
    return a.completedAt! < b.completedAt! ? 1 : -1;
  }
  return a.createdAt < b.createdAt ? 1 : -1;
}

/** UI 向けライブクエリ。DB が変わると自動で再通知される。戻り値の関数で購読解除 */
export function observeVisibleTasks(cb: (tasks: Task[]) => void): () => void {
  const subscription = liveQuery(fetchVisibleTasks).subscribe({
    next: (tasks) => cb(tasks ?? []),
    error: (err) => console.error('openmilk: liveQuery error', err),
  });
  return () => subscription.unsubscribe();
}
