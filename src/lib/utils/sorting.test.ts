import { describe, expect, it } from 'vitest';
import type { Task } from '../db/schema';
import { sortTasks } from './sorting';

function task(partial: Partial<Task> & { id: string }): Task {
  return {
    title: partial.id,
    tags: [],
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    deleted: 0,
    ...partial,
  };
}

describe('sortTasks', () => {
  const byDue = task({ id: 'byDue', due: '2026-09-03' });
  const dueAndPrio = task({ id: 'dueAndPrio', due: '2026-09-02', priority: 3 });
  const urgent = task({ id: 'urgent', priority: 1 });
  const noMeta = task({ id: 'noMeta' });
  const done = task({ id: 'done', completedAt: '2026-09-01T01:00:00.000Z' });

  it('期限順: 期限が近い→期限なし、完了は最後', () => {
    expect(sortTasks([urgent, done, byDue, dueAndPrio, noMeta], 'due').map((t) => t.id)).toEqual([
      'dueAndPrio',
      'byDue',
      'urgent',
      'noMeta',
      'done',
    ]);
  });

  it('優先度順: 優先度→期限', () => {
    expect(sortTasks([byDue, done, dueAndPrio, urgent, noMeta], 'priority').map((t) => t.id)).toEqual([
      'urgent',
      'dueAndPrio',
      'byDue',
      'noMeta',
      'done',
    ]);
  });

  it('同じ期限なら時刻つきが先、時刻は早い順', () => {
    const dateOnly = task({ id: 'dateOnly', due: '2026-09-03' });
    const at10 = task({ id: 'at10', due: '2026-09-03', dueTime: '10:00' });
    const at9 = task({ id: 'at9', due: '2026-09-03', dueTime: '09:00' });
    expect(sortTasks([dateOnly, at10, at9], 'due').map((t) => t.id)).toEqual([
      'at9',
      'at10',
      'dateOnly',
    ]);
  });

  it('追加順: 新しいものが先（完了は最後）', () => {
    const older = task({ id: 'older', createdAt: '2026-08-31T00:00:00.000Z' });
    const newer = task({ id: 'newer', createdAt: '2026-09-01T12:00:00.000Z' });
    expect(sortTasks([older, done, newer], 'created').map((t) => t.id)).toEqual([
      'newer',
      'older',
      'done',
    ]);
  });
});
