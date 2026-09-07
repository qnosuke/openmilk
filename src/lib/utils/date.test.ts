import { describe, it, expect } from 'vitest';
import { addDays, addMonths } from './date';

describe('addMonths', () => {
  it('月を加算する（日付は維持）', () => {
    expect(addMonths('2026-03-15', 1)).toBe('2026-04-15');
    expect(addMonths('2026-01-10', 2)).toBe('2026-03-10');
  });

  it('月末日は翌月の末日に詰める（1/31 + 1ヶ月 → 2/28）', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    // うるう年
    expect(addMonths('2024-01-31', 1)).toBe('2024-02-29');
    expect(addMonths('2026-12-31', 2)).toBe('2027-02-28');
  });

  it('年をまたぐ', () => {
    expect(addMonths('2026-11-20', 3)).toBe('2027-02-20');
  });

  it('0 か月は元の日付', () => {
    expect(addMonths('2026-09-07', 0)).toBe('2026-09-07');
  });
});

describe('addDays', () => {
  it('日を加算する', () => {
    expect(addDays('2026-09-30', 1)).toBe('2026-10-01');
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01');
    expect(addDays('2026-09-10', -7)).toBe('2026-09-03');
  });
});
