import { describe, expect, it } from 'vitest';
import type { Task } from '../db/schema';
import {
  UNTAGGED,
  countByList,
  filterTasks,
  rangeCountsOf,
  tagCountsOf,
  todayMinutesOf,
  untaggedCountOf,
} from './taskFilter';

// 2026-09-02（水）を基準日に固定
const today = new Date(2026, 8, 2);

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

const ctx = {
  view: 'active' as const,
  selected: 'all',
  tagFilter: null,
  mutedTags: [],
  searchQuery: '',
  dueFilter: null,
  today,
};

describe('filterTasks', () => {
  const active = task({ id: 'active' });
  const done = task({ id: 'done', completedAt: '2026-09-01T01:00:00Z' });
  const trashed = task({ id: 'trashed', deleted: 1 });
  const tasks = [active, done, trashed];

  it('active ビューは未完了の未削除だけ', () => {
    expect(filterTasks(tasks, ctx).map((t) => t.id)).toEqual(['active']);
  });

  it('completed ビューは完了だけ', () => {
    const out = filterTasks(tasks, { ...ctx, view: 'completed' });
    expect(out.map((t) => t.id)).toEqual(['done']);
  });

  it('trash ビューは削除済み（完了状態は問わない）', () => {
    const out = filterTasks(tasks, { ...ctx, view: 'trash' });
    expect(out.map((t) => t.id)).toEqual(['trashed']);
  });

  it('リスト絞り込み', () => {
    const inList = task({ id: 'inList', listId: 'L1' });
    const out = filterTasks([active, inList], { ...ctx, selected: 'L1' });
    expect(out.map((t) => t.id)).toEqual(['inList']);
  });

  it('タグ絞り込みとタグなし', () => {
    const withTag = task({ id: 'withTag', tags: ['work'] });
    const out1 = filterTasks([active, withTag], { ...ctx, tagFilter: 'work' });
    expect(out1.map((t) => t.id)).toEqual(['withTag']);
    const out2 = filterTasks(
      [active, withTag],
      { ...ctx, tagFilter: UNTAGGED },
    );
    expect(out2.map((t) => t.id)).toEqual(['active']);
  });

  it('ミュートタグは非表示', () => {
    const tagged = task({ id: 'tagged', tags: ['life'] });
    const out = filterTasks([tagged], { ...ctx, mutedTags: ['life'] });
    expect(out).toEqual([]);
  });

  it('検索はタイトル/メモ/タグが対象', () => {
    const t1 = task({ id: 't1', title: '請求書作成' });
    const t2 = task({ id: 't2', title: ' misc ', notes: '在庫CSVの話' });
    const t3 = task({ id: 't3', tags: ['在庫'] });
    const out = filterTasks([t1, t2, t3], { ...ctx, searchQuery: '在庫' });
    expect(out.map((t) => t.id)).toEqual(['t2', 't3']);
  });

  it('dueFilter: overdue は期限切れのみ', () => {
    const past = task({ id: 'past', due: '2026-09-01' });
    const todayTask = task({ id: 'todayTask', due: '2026-09-02' });
    const out = filterTasks([past, todayTask], { ...ctx, dueFilter: 'overdue' });
    expect(out.map((t) => t.id)).toEqual(['past']);
  });

  it('dueFilter: week は今日から1週間', () => {
    const inWeek = task({ id: 'inWeek', due: '2026-09-08' });
    const out = filterTasks([inWeek, task({ id: 'far', due: '2026-09-20' })], {
      ...ctx,
      dueFilter: 'week',
    });
    expect(out.map((t) => t.id)).toEqual(['inWeek']);
  });
});

describe('rangeCountsOf', () => {
  it('期限切れ/今日/明日/1週間を数える', () => {
    const tasks = [
      task({ id: 'a', due: '2026-08-30' }), // 期限切れ
      task({ id: 'b', due: '2026-09-02' }), // 今日
      task({ id: 'c', due: '2026-09-03' }), // 明日
      task({ id: 'd', due: '2026-09-05' }), // 1週間以内
      task({ id: 'e', due: '2026-09-20' }), // 範囲外
      task({ id: 'f', completedAt: '2026-09-02T01:00:00Z', due: '2026-09-02' }), // 完了は対象外
      task({ id: 'g' }), // 期限なし
    ];
    expect(rangeCountsOf(tasks, today)).toEqual({
      overdue: 1,
      today: 1,
      tomorrow: 1,
      week: 3,
    });
  });
});

describe('countByList / untaggedCountOf', () => {
  it('リスト別とタグなしを数える', () => {
    const tasks = [
      task({ id: 'a' }),
      task({ id: 'b', listId: 'L1' }),
      task({ id: 'c', listId: 'L1', tags: ['work'] }),
      task({ id: 'd', deleted: 1 }),
      task({ id: 'e', completedAt: '2026-09-01T00:00:00Z' }),
    ];
    expect(countByList(tasks)).toEqual({ all: 3, inbox: 1, L1: 2 });
    expect(untaggedCountOf(tasks)).toBe(2);
  });
});

describe('todayMinutesOf', () => {
  it('絞り込みコンテキストを反映する', () => {
    const tasks = [
      task({ id: 'a', due: '2026-09-02', estimateMinutes: 30, tags: ['work'] }),
      task({ id: 'b', due: '2026-09-02', estimateMinutes: 60, tags: ['life'] }),
    ];
    expect(todayMinutesOf(tasks, { selected: 'all', tagFilter: 'work', mutedTags: [] }, today)).toBe(30);
    expect(
      todayMinutesOf(tasks, { selected: 'all', tagFilter: null, mutedTags: ['life'] }, today),
    ).toBe(30);
    expect(
      todayMinutesOf(tasks, { selected: 'all', tagFilter: null, mutedTags: [] }, today),
    ).toBe(90);
  });
});
