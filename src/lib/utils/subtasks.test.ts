import { describe, it, expect } from 'vitest';
import type { Task } from '../db/schema';
import { splitOneLevel } from './subtasks';

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

describe('splitOneLevel', () => {
  it('子タスクを親の下に分け、表示順を維持する', () => {
    const parent = task({ id: 'parent' });
    const childA = task({ id: 'childA', parentId: 'parent' });
    const childB = task({ id: 'childB', parentId: 'parent' });
    const result = splitOneLevel([parent, childA, childB]);
    expect(result.rows.map((t) => t.id)).toEqual(['parent']);
    expect(result.childrenByParent.get('parent')?.map((t) => t.id)).toEqual(['childA', 'childB']);
  });

  it('親がビューに存在しない子は通常行として扱う', () => {
    const orphan = task({ id: 'orphan', parentId: 'missing' });
    const result = splitOneLevel([orphan]);
    expect(result.rows.map((t) => t.id)).toEqual(['orphan']);
    expect(result.childrenByParent.size).toBe(0);
  });

  it('孫は隠れず、通常行として扱う（1階層限定）', () => {
    const parent = task({ id: 'parent' });
    const child = task({ id: 'child', parentId: 'parent' });
    const grandchild = task({ id: 'grandchild', parentId: 'child' });
    const result = splitOneLevel([parent, child, grandchild]);
    expect(result.rows.map((t) => t.id)).toEqual(['parent', 'grandchild']);
    expect(result.childrenByParent.get('parent')?.map((t) => t.id)).toEqual(['child']);
    expect(result.childrenByParent.has('child')).toBe(false);
  });

  it('親子関係のないタスクだけでもそのまま返す', () => {
    const a = task({ id: 'a' });
    const b = task({ id: 'b' });
    const result = splitOneLevel([a, b]);
    expect(result.rows.map((t) => t.id)).toEqual(['a', 'b']);
    expect(result.childrenByParent.size).toBe(0);
  });
});
