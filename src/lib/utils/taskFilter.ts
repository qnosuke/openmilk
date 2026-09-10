import type { Task } from '../db/schema';
import { addDays, todayISO } from './date';
import { sortTasks, type SortMode } from './sorting';

/** タグなし絞り込みを表すセンチネル値（tagFilter に渡す） */
export const UNTAGGED = '__untagged__';

export type View = 'active' | 'completed' | 'trash';
export type DueFilter = 'overdue' | 'today' | 'tomorrow' | 'week' | null;

export interface TaskViewContext {
  view: View;
  /** 'all' | 'inbox' | listId */
  selected: string;
  tagFilter: string | null;
  mutedTags: string[];
  searchQuery: string;
  dueFilter: DueFilter;
  /** 基準日（テストで固定する用。通常は省略） */
  today?: Date;
}

function matchesContext(task: Task, ctx: TaskViewContext, today: Date): boolean {
  // ゴミ箱ビューでは削除済みだけ、他のビューでは削除済みを除く
  if (ctx.view === 'trash' ? !task.deleted : task.deleted) return false;
  const inSelectedList =
    ctx.selected === 'all' ||
    (ctx.selected === 'inbox' ? !task.listId : task.listId === ctx.selected);
  if (!inSelectedList) return false;
  if (ctx.tagFilter === UNTAGGED) {
    if (task.tags.length > 0) return false;
  } else if (ctx.tagFilter !== null && !task.tags.includes(ctx.tagFilter)) return false;
  // 非表示タグのついたタスクは全部のビューから消える
  if (task.tags.some((tag) => ctx.mutedTags.includes(tag))) return false;
  // 通常ビューは未完了だけ。完了ビューは完了だけ。ゴミ箱は両方出す
  if (ctx.view === 'active' && task.completedAt !== undefined) return false;
  if (ctx.view === 'completed' && task.completedAt === undefined) return false;
  if (ctx.searchQuery) {
    const q = ctx.searchQuery.trim().toLowerCase();
    const haystack = `${task.title}\n${task.notes ?? ''}\n${task.tags.join(' ')}`.toLowerCase();
    if (!haystack.includes(q)) return false;
  }
  if (ctx.dueFilter === null) return true;
  if (!task.due) return false;
  const t0 = todayISO(today);
  const tomorrow = addDays(t0, 1);
  const weekEnd = addDays(t0, 7);
  if (ctx.dueFilter === 'overdue') return task.due < t0;
  if (ctx.dueFilter === 'today') return task.due === t0;
  if (ctx.dueFilter === 'tomorrow') return task.due === tomorrow;
  return task.due >= t0 && task.due <= weekEnd;
}

/** 表示条件に合うタスクだけを返す */
export function filterTasks(tasks: Task[], ctx: TaskViewContext): Task[] {
  return tasks.filter((task) => matchesContext(task, ctx, todayOf(ctx)));
}

/** 表示用にフィルタ→ソートしたタスク一覧を返す */
export function visibleTasksOf(
  tasks: Task[],
  ctx: TaskViewContext & { sortMode: SortMode },
): Task[] {
  return sortTasks(filterTasks(tasks, ctx), ctx.sortMode);
}

function todayOf(ctx: { today?: Date }): Date {
  return ctx.today ?? new Date();
}

/** サイドバーの期間タイルに表示する未完了件数 */
export function rangeCountsOf(tasks: Task[], today: Date = new Date()) {
  const t0 = todayISO(today);
  const tomorrow = addDays(t0, 1);
  const weekEnd = addDays(t0, 7);
  let overdue = 0;
  let todayCount = 0;
  let tomorrowCount = 0;
  let week = 0;
  for (const task of tasks) {
    if (task.completedAt !== undefined || task.deleted || !task.due) continue;
    if (task.due < t0) overdue += 1;
    if (task.due === t0) todayCount += 1;
    if (task.due === tomorrow) tomorrowCount += 1;
    if (task.due >= t0 && task.due <= weekEnd) week += 1;
  }
  return { overdue, today: todayCount, tomorrow: tomorrowCount, week };
}

/** リスト別の未完了件数（すべて/INBOX/各リストのバッジ用） */
export function countByList(tasks: Task[]): Record<string, number> {
  const result: Record<string, number> = { all: 0, inbox: 0 };
  for (const task of tasks) {
    if (task.completedAt !== undefined || task.deleted) continue;
    result.all += 1;
    if (task.listId) result[task.listId] = (result[task.listId] ?? 0) + 1;
    else result.inbox += 1;
  }
  return result;
}

/** 未完了タスクのタグ出現数（多い順、ミュート状態つき） */
export function tagCountsOf(tasks: Task[], mutedTags: string[]) {
  const map = new Map<string, number>();
  for (const task of tasks) {
    if (task.completedAt !== undefined || task.deleted) continue;
    for (const tag of task.tags) map.set(tag, (map.get(tag) ?? 0) + 1);
  }
  return [...map.entries()]
    .map(([name, count]) => ({ name, count, muted: mutedTags.includes(name) }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

/** タグの付いていない未完了タスク数 */
export function untaggedCountOf(tasks: Task[]): number {
  return tasks.filter(
    (t) => t.completedAt === undefined && !t.deleted && t.tags.length === 0,
  ).length;
}

export function completedCountOf(tasks: Task[]): number {
  return tasks.filter((t) => t.completedAt !== undefined && !t.deleted).length;
}

/**
 * フッターの「今日の作業予定」: 表示コンテキスト（リスト・タグ絞り込み・
 * ミュート）で見えている、今日期限の未完了タスクの見積もり合計
 */
export function todayMinutesOf(
  tasks: Task[],
  ctx: Pick<TaskViewContext, 'selected' | 'tagFilter' | 'mutedTags'>,
  today: Date = new Date(),
): number {
  const t0 = todayISO(today);
  return tasks
    .filter((task) => {
      if (task.completedAt !== undefined || task.deleted) return false;
      if (ctx.selected !== 'all') {
        const inList = ctx.selected === 'inbox' ? !task.listId : task.listId === ctx.selected;
        if (!inList) return false;
      }
      if (ctx.tagFilter && !task.tags.includes(ctx.tagFilter)) return false;
      if (ctx.mutedTags.some((tag) => task.tags.includes(tag))) return false;
      return task.due !== undefined && task.due <= t0 && !!task.estimateMinutes;
    })
    .reduce((sum, task) => sum + (task.estimateMinutes ?? 0), 0);
}
