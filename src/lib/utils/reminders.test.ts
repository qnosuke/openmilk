import { describe, expect, it } from 'vitest';
import type { Task } from '../db/schema';
import { collectDueReminders } from './reminders';

// 2026-09-02 09:00 (JST) を現在時刻に固定
const now = new Date(2026, 8, 2, 9, 0).getTime();

function task(p: Partial<Task> & { id: string }): Task {
  return {
    title: p.id,
    tags: [],
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    deleted: 0,
    ...p,
  };
}

describe('collectDueReminders', () => {
  const base = task({
    id: 'r1',
    due: '2026-09-02',
    dueTime: '09:30',
    remindMinutesBefore: 60, // 発火予定 08:30 → 30分前に発火時刻が過ぎている
  });

  it('発火時刻を過ぎたリマインダーを返す', () => {
    const out = collectDueReminders([base], now, {});
    expect(out).toHaveLength(1);
    expect(out[0].key).toBe('r1:2026-09-02:09:30');
  });

  it('通知済みのキーは返さない', () => {
    const out = collectDueReminders([base], now, { 'r1:2026-09-02:09:30': now - 1000 });
    expect(out).toHaveLength(0);
  });

  it('発火時刻が未来なら返さない', () => {
    const future = task({
      id: 'r2',
      due: '2026-09-02',
      dueTime: '23:00',
      remindMinutesBefore: 60, // 発火予定 22:00 → 未来
    });
    expect(collectDueReminders([future], now, {})).toHaveLength(0);
  });

  it('6時間を超えて過ぎたものは見逃し扱いで返さない', () => {
    const late = task({
      id: 'r3',
      due: '2026-09-01',
      dueTime: '09:00',
      remindMinutesBefore: 60, // 発火予定 24時間以上前
    });
    expect(collectDueReminders([late], now, {})).toHaveLength(0);
  });

  it('完了・削除済みは返さない', () => {
    const doneTask = task({ id: 'r4', due: '2026-09-02', dueTime: '09:30', remindMinutesBefore: 60, completedAt: '2026-09-02T00:00:00Z' });
    const deletedTask = task({ id: 'r5', due: '2026-09-02', dueTime: '09:30', remindMinutesBefore: 60, deleted: 1 });
    expect(collectDueReminders([doneTask, deletedTask], now, {})).toHaveLength(0);
  });

  it('リマインダー未設定は返さない', () => {
    expect(collectDueReminders([task({ id: 'r6', due: '2026-09-02' })], now, {})).toHaveLength(0);
  });
});
