import { describe, it, expect } from 'vitest';
import { splitHighlight } from './highlight';

describe('splitHighlight', () => {
  it('ヒット部分を分割する', () => {
    expect(splitHighlight('牛乳を買う', '乳')).toEqual([
      { text: '牛', hit: false },
      { text: '乳', hit: true },
      { text: 'を買う', hit: false },
    ]);
  });

  it('大文字小文字を区別しない', () => {
    expect(splitHighlight('Submit report', 'REPORT')).toEqual([
      { text: 'Submit ', hit: false },
      { text: 'report', hit: true },
    ]);
  });

  it('複数ヒットする', () => {
    expect(splitHighlight('abcabc', 'b')).toEqual([
      { text: 'a', hit: false },
      { text: 'b', hit: true },
      { text: 'ca', hit: false },
      { text: 'b', hit: true },
      { text: 'c', hit: false },
    ]);
  });

  it('マッチしない場合は元テキストのまま', () => {
    expect(splitHighlight('タスク', 'xyz')).toEqual([{ text: 'タスク', hit: false }]);
  });

  it('クエリが空なら元テキストのまま', () => {
    expect(splitHighlight('タスク', '')).toEqual([{ text: 'タスク', hit: false }]);
    expect(splitHighlight('タスク', undefined)).toEqual([{ text: 'タスク', hit: false }]);
    expect(splitHighlight('タスク', null)).toEqual([{ text: 'タスク', hit: false }]);
    expect(splitHighlight('タスク', '   ')).toEqual([{ text: 'タスク', hit: false }]);
  });

  it('前後にヒットがある場合も正しく分割する', () => {
    expect(splitHighlight('inboxのinbox化', 'inbox')).toEqual([
      { text: 'inbox', hit: true },
      { text: 'の', hit: false },
      { text: 'inbox', hit: true },
      { text: '化', hit: false },
    ]);
  });
});
