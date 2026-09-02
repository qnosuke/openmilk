import { describe, expect, it } from 'vitest';
import { parseTaskInput, parseEstimateMinutes } from './parseTask';

// 2026-09-02（水）を基準日に固定
const today = new Date(2026, 8, 2);

describe('parseTaskInput', () => {
  it('タグ・優先度・期限・見積もりを解析してタイトルから除去する', () => {
    expect(parseTaskInput('牛乳を買う 明日 !1 #買い物', today)).toEqual({
      title: '牛乳を買う',
      due: '2026-09-03',
      priority: 1,
      tags: ['買い物'],
      estimateMinutes: undefined,
    });
  });

  it('日本語の埋め込み日付（明日レポート提出）', () => {
    const parsed = parseTaskInput('明日レポート提出 30分', today);
    expect(parsed.due).toBe('2026-09-03');
    expect(parsed.estimateMinutes).toBe(30);
    expect(parsed.title).toBe('レポート提出');
  });

  it('中国語: 明天交报告', () => {
    const parsed = parseTaskInput('明天交报告', today);
    expect(parsed.due).toBe('2026-09-03');
    expect(parsed.title).toBe('交报告');
  });

  it('中国語: 下周三（翌週の水曜）', () => {
    expect(parseTaskInput('开会 下周三', today).due).toBe('2026-09-09');
  });

  it('中国語の見積もり: 1小时 / 30分钟', () => {
    expect(parseTaskInput('写代码 1小时', today).estimateMinutes).toBe(60);
    expect(parseTaskInput('健身30分钟', today).estimateMinutes).toBe(30);
  });

  it('英語: report tomorrow', () => {
    const parsed = parseTaskInput('submit report tomorrow', today);
    expect(parsed.due).toBe('2026-09-03');
    expect(parsed.title).toBe('submit report');
  });

  it('英語: next fri', () => {
    expect(parseTaskInput('submit report next fri', today).due).toBe('2026-09-11');
  });

  it('英語の見積もり: 45min / 0.5h', () => {
    expect(parseTaskInput('review docs 45min', today).estimateMinutes).toBe(45);
    expect(parseTaskInput('read paper 0.5h', today).estimateMinutes).toBe(30);
  });

  it('英語の見積もり: 1h30min は時間と分の合算', () => {
    expect(parseTaskInput('write spec 1h30min', today).estimateMinutes).toBe(90);
    expect(parseTaskInput('_cleanup 2h15min', today).estimateMinutes).toBe(135);
    expect(parseTaskInput('workout 1h30m', today).estimateMinutes).toBe(90);
    expect(parseTaskInput('jog 30m', today).estimateMinutes).toBe(30);
    expect(parseTaskInput('write spec 1h30min', today).title).toBe('write spec');
  });

  it('見積もりの合算（1時間30分）', () => {
    expect(parseTaskInput('資料作成 1時間30分 !2 #work', today)).toEqual({
      title: '資料作成',
      due: undefined,
      priority: 2,
      tags: ['work'],
      estimateMinutes: 90,
    });
  });

  it('誤検知しない: 10分割 / 毎日日記 / お金を下ろす', () => {
    expect(parseTaskInput('10分割して進める', today)).toEqual({
      title: '10分割して進める',
      due: undefined,
      priority: undefined,
      tags: [],
      estimateMinutes: undefined,
    });
    expect(parseTaskInput('毎日日記を書く', today).due).toBeUndefined();
    expect(parseTaskInput('お金を下ろす', today).due).toBeUndefined();
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

  it('来週X曜（水曜なら翌週の水曜）', () => {
    expect(parseTaskInput('発表 来週月曜', today).due).toBe('2026-09-07');
    const monday = new Date(2026, 8, 7);
    expect(parseTaskInput('発表 来週月曜', monday).due).toBe('2026-09-14');
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

  it('明日10時（日付+時刻）', () => {
    const parsed = parseTaskInput('明日10時 会議', today);
    expect(parsed.due).toBe('2026-09-03');
    expect(parsed.dueTime).toBe('10:00');
    expect(parsed.title).toBe('会議');
  });

  it('午後3時は15:00、日付なしは今日', () => {
    const parsed = parseTaskInput('午後3時 打合せ', today);
    expect(parsed.due).toBe('2026-09-02');
    expect(parsed.dueTime).toBe('15:00');
  });

  it('コロン表記 9:30', () => {
    const parsed = parseTaskInput('会議 9:30', today);
    expect(parsed.due).toBe('2026-09-02');
    expect(parsed.dueTime).toBe('09:30');
  });

  it('2pm は14:00（tomorrow 併用）', () => {
    const parsed = parseTaskInput('submit report tomorrow 2pm', today);
    expect(parsed.due).toBe('2026-09-03');
    expect(parsed.dueTime).toBe('14:00');
    expect(parsed.title).toBe('submit report');
  });

  it('中国語: 明天上午10点', () => {
    const parsed = parseTaskInput('明天上午10点 开会', today);
    expect(parsed.due).toBe('2026-09-03');
    expect(parsed.dueTime).toBe('10:00');
  });

  it('1時間30分は時刻と誤認しない', () => {
    const parsed = parseTaskInput('1時間30分の資料作成', today);
    expect(parsed.dueTime).toBeUndefined();
    expect(parsed.estimateMinutes).toBe(90);
  });

  it('日付+時刻の併用（10時半）', () => {
    const parsed = parseTaskInput('歯医者 3月10日 10時半', today);
    expect(parsed.due).toBe('2027-03-10');
    expect(parsed.dueTime).toBe('10:30');
  });

  it('時刻のみの入力（朝9時）は今日の予定になる', () => {
    const parsed = parseTaskInput('レポート 朝9時', today);
    expect(parsed.due).toBe('2026-09-02');
    expect(parsed.dueTime).toBe('09:00');
    expect(parsed.title).toBe('レポート 朝');
  });

  it('解析できない語はタイトルに残す', () => {
    const parsed = parseTaskInput('資料レビュー よろしくお願いします', today);
    expect(parsed.title).toBe('資料レビュー よろしくお願いします');
    expect(parsed.due).toBeUndefined();
  });

  it('優先度なし・タグなしでも動く', () => {
    expect(parseTaskInput('散歩する', today)).toEqual({
      title: '散歩する',
      due: undefined,
      priority: undefined,
      tags: [],
      estimateMinutes: undefined,
    });
  });

  it('複数タグ', () => {
    const parsed = parseTaskInput('準備 #work #急ぎ', today);
    expect(parsed.tags).toEqual(['work', '急ぎ']);
  });
});

describe('parseEstimateMinutes', () => {
  it('編集ダイアログ入力を分に変換する', () => {
    expect(parseEstimateMinutes('1時間30分')).toBe(90);
    expect(parseEstimateMinutes('45min')).toBe(45);
    expect(parseEstimateMinutes('2小时')).toBe(120);
    expect(parseEstimateMinutes('')).toBeUndefined();
    expect(parseEstimateMinutes('未定')).toBeUndefined();
  });
});
