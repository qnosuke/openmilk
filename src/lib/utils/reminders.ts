import type { Task } from '../db/schema';

/** 期限の通知予定時刻（ミリ秒）。日付のみのタスクは朝 9:00 基準 */
export function dueMomentMs(task: Task): number | null {
  if (!task.due) return null;
  const [h, m] = (task.dueTime ?? '09:00').split(':').map(Number);
  const d = new Date(task.due + 'T00:00:00');
  d.setHours(h, m ?? 0, 0, 0);
  return d.getTime();
}

export interface DueReminder {
  task: Task;
  /** 通知済み記録用のキー（id + due + dueTime） */
  key: string;
}

/**
 * いま通知すべきリマインダーを返す（純粋関数・副作用なし）。
 * - remindMinutesBefore 設定済みの未完了タスク
 * - 発火予定時刻が now を過ぎてから 6 時間以内（それより前は未来、後は見逃し）
 * - 同一 (id, due, dueTime) で未通知のものだけ
 */
export function collectDueReminders(
  tasks: Task[],
  now: number,
  notified: Record<string, number>,
): DueReminder[] {
  const due: DueReminder[] = [];
  for (const task of tasks) {
    if (task.completedAt !== undefined || task.deleted || !task.remindMinutesBefore) continue;
    const moment = dueMomentMs(task);
    if (moment === null) continue;
    const fireAt = moment - task.remindMinutesBefore * 60_000;
    if (fireAt > now || now - fireAt > 6 * 3_600_000) continue;
    const key = `${task.id}:${task.due}:${task.dueTime ?? ''}`;
    if (notified[key]) continue;
    due.push({ task, key });
  }
  return due;
}
