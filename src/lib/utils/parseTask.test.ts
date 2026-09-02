import { describe, expect, it } from 'vitest';
import { parseTaskInput } from './parseTask';

// 2026-09-02（水）を基準日に固定
const today = new Date(2026, 8, 2);

describe('parseTaskInput', () => {
  it('タグ・優先度・期限を解析してタイトルから除去する', () => {
    expect(parseTaskInput('牛乳を買う 明日 !1 #買い物', today)).toEqual({
      title: '牛乳を買う',
      due: '2026-09-03',
      priority: 1,
      tags: ['買い物'],
    });
  });

  it('今日', () => {
    expect(parseTaskInput('ゴミ出し 今日', today).due).toBe('2026-09-02');
  });

  it('曜日（今週の残り）', () => {
    expect(parseTaskInput('レポート 金曜', today).due).toBe('2026-09-04');
  });

  it('曜日（過ぎた曜日は翌週）', () => {
    expect(parseTaskInput('レポート 月曜', today).due).toBe('2026-09-07');
  });

  it('曜日（今日と同じ曜日は今日）', () => {
    expect(parseTaskInput('レポート 水曜', today).due).toBe('2026-09-02');
  });

  it('来週X曜', () => {
    expect(parseTaskInput('発表 来週月曜', today).due).toBe('2026-09-14');
  });

  it('M/D は当年の未来直近', () => {
    expect(parseTaskInput('確定申告 12/31', today).due).toBe('2026-12-31');
  });

  it('M/D が過去なら来年', () => {
    expect(parseTaskInput('健康診断 1/5', today).due).toBe('2027-01-05');
  });

  it('M月D日', () => {
    expect(parseTaskInput('歯医者 3月10日', today).due).toBe('2027-03-10');
  });

  it('YYYY-MM-DD', () => {
    expect(parseTaskInput('リマインダー 2027-04-01', today).due).toBe('2027-04-01');
  });

  it('解析できない語はタイトルに残す', () => {
    const parsed = parseTaskInput('資料レビュー 朝9時', today);
    expect(parsed.title).toBe('資料レビュー 朝9時');
    expect(parsed.due).toBeUndefined();
  });

  it('優先度なし・タグなしでも動く', () => {
    expect(parseTaskInput('散歩する', today)).toEqual({
      title: '散歩する',
      due: undefined,
      priority: undefined,
      tags: [],
    });
  });

  it('複数タグ', () => {
    const parsed = parseTaskInput('準備 #work #急ぎ', today);
    expect(parsed.tags).toEqual(['work', '急ぎ']);
  });
});
