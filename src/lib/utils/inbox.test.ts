import { describe, it, expect } from 'vitest';
import { parseInboxLines } from './inbox';

describe('parseInboxLines', () => {
  it('空行を除いて 1 行ずつ返す', () => {
    expect(parseInboxLines('牛乳を買う\n\n明日の準備\n')).toEqual(['牛乳を買う', '明日の準備']);
  });

  it('Markdown の箇条書き記号を取り除く', () => {
    expect(parseInboxLines('- 牛乳を買う 明日 !1\n* レポート修正\n+ 原稿チェック')).toEqual([
      '牛乳を買う 明日 !1',
      'レポート修正',
      '原稿チェック',
    ]);
  });

  it('タスクリストのチェックボックス記号を取り除く', () => {
    expect(parseInboxLines('- [ ] 未完了タスク\n- [x] 済みタスク')).toEqual([
      '未完了タスク',
      '済みタスク',
    ]);
  });

  it('行頭のインデントを許容する', () => {
    expect(parseInboxLines('  - インデント付き')).toEqual(['インデント付き']);
  });

  it('記号だけの行は除く', () => {
    expect(parseInboxLines('-\n-\n- \n')).toEqual([]);
  });
});
