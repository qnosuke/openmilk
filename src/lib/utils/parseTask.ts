import { addDays, toISODate } from './date';

export interface ParsedTask {
  title: string;
  /** 'YYYY-MM-DD' */
  due?: string;
  /** 時刻 'HH:mm'（24時間表記）。日付なしで時刻だけあれば「今日」の予定になる */
  dueTime?: string;
  priority?: 1 | 2 | 3;
  tags: string[];
  estimateMinutes?: number;
}

const WEEKDAY_KANJI: Record<string, number> = {
  日: 0, 月: 1, 火: 2, 水: 3, 木: 4, 金: 5, 土: 6,
};

const WEEKDAY_ZH: Record<string, number> = {
  日: 0, 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 天: 0,
};

const WEEKDAY_EN: Record<string, number> = {
  sun: 0, mon: 1, tue: 2, tues: 2, wed: 3,
  thu: 4, thur: 4, thurs: 4, fri: 5, sat: 6,
};

/**
 * クイック追加の1行入力を解析する（日/英/中 共通）。
 * 記法:
 * - 期限: 明日/明天/tomorrow/金曜/周三/next fri/9月15日/9/15/2026-10-01 など
 *   （日本語は「明日レポート提出」のように語中でも拾う）
 * - 見積もり: 30分/2時間/1時間半/45min/0.5h/2小时/30分钟
 * - 優先度: !1〜!3 / タグ: #tag
 * 解釈できた語はタイトルから除き、解釈できなかった語はそのまま残す（情報を落とさない）。
 */
export function parseTaskInput(input: string, today: Date = new Date()): ParsedTask {
  let rest = ` ${input.trim()} `;
  const tags: string[] = [];
  let priority: 1 | 2 | 3 | undefined;
  let due: string | undefined;

  // #タグ
  rest = rest.replace(/[#＃]([^\s#！!、。]+)/g, (_, raw: string) => {
    const tag = raw.replace(/[,，.)）】》]+$/, '');
    if (tag) tags.push(tag);
    return ' ';
  });

  // !優先度
  rest = rest.replace(/(?<!\d)!([123])(?!\d)/g, (_, p: string) => {
    priority = Number(p) as 1 | 2 | 3;
    return ' ';
  });

  // 時刻（見積もりの「時間」「N分」と衝突するため、必ず見積もりより先に処理する）
  let dueTime: string | undefined;
  const setTime = (hour: number, minute: number) => {
    dueTime = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  };
  const to24Hour = (hour: number, meridiem: string) => {
    if (/午後|下午|pm/i.test(meridiem)) return hour === 12 ? 12 : hour + 12;
    if (/午前|上午|am/i.test(meridiem)) return hour === 12 ? 0 : hour;
    return hour;
  };

  // 10時 / 10時半 / 10時30分 / 午後3時 / 下午3点（「1時間」を誤認しないよう 時の直後の間を除外）
  rest = rest.replace(
    /(?<!\d)(午前|午後|上午|下午)?\s*([01]?\d|2[0-3])[時点](?!間)(半|[0-5]?\d分)?(?![0-9])/g,
    (_, meridiem: string, hour: string, minutes?: string) => {
      const h = to24Hour(Number(hour), meridiem ?? '');
      const m = minutes === '半' ? 30 : minutes ? Number(minutes.replace('分', '')) : 0;
      setTime(h, m);
      return ' ';
    },
  );
  // 9:30
  rest = rest.replace(/(?<!\d)([01]?\d|2[0-3]):([0-5]\d)(?!\d)/g, (_, h: string, m: string) => {
    setTime(Number(h), Number(m));
    return ' ';
  });
  // 2pm / 10:30am
  rest = rest.replace(
    /(?<!\d)([1-9]|1[0-2])(?::([0-5]\d))?\s*(am|pm)(?![a-z])/gi,
    (_, hour: string, minutes: string | undefined, meridiem: string) => {
      setTime(to24Hour(Number(hour), meridiem), minutes ? Number(minutes) : 0);
      return ' ';
    },
  );

  // 見積もり
  let estimate: number | undefined;
  const takeEstimate = (re: RegExp, toMinutes: (n: string, unit: string) => number) => {
    rest = rest.replace(re, (_, n: string, unit: string) => {
      estimate = (estimate ?? 0) + toMinutes(n, unit);
      return ' ';
    });
  };
  takeEstimate(/(?<!\d)(\d+(?:\.\d+)?)\s*(時間半|時間|个?小时)(?![一-龥])/gi, (n, unit) =>
    Math.round(Number(n) * 60) + (unit === '時間半' ? 30 : 0),
  );
  // 1h30min のように数字が続いても h を拾えるようにする
  takeEstimate(/(?<!\d)(\d+(?:\.\d+)?)\s*h(?![a-z])/gi, (n) => Math.round(Number(n) * 60));
  takeEstimate(
    /(?<!\d)(\d+)\s*(分钟|min(?:ute)?s?|m(?![a-z])|分(?![一-龥]))(?![a-z])/gi,
    (n) => Number(n),
  );
  if (estimate === 0) estimate = undefined;

  // 期限（先に見つかったものが採用され、その語だけ取り除く）
  const base = toISODate(today);
  const takeDate = (re: RegExp, resolve: (m: RegExpExecArray) => string | undefined) => {
    if (due) return;
    const m = re.exec(rest);
    if (!m) return;
    const resolved = resolve(m);
    if (!resolved) return;
    due = resolved;
    rest = rest.slice(0, m.index) + ' ' + rest.slice(m.index + m[0].length);
  };

  takeDate(/(?<!\d)(\d{4})-(\d{1,2})-(\d{1,2})(?!\d)/, (m) =>
    toISODate(new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))),
  );
  takeDate(/(?<!\d)(\d{1,2})月(\d{1,2})日?/, (m) => upcomingMD(Number(m[1]), Number(m[2]), today));
  takeDate(/(?<!\d)(\d{1,2})\/(\d{1,2})(?!\d)/, (m) => upcomingMD(Number(m[1]), Number(m[2]), today));
  takeDate(/(?<![a-zA-Z])(今日|本日|きょう|今天|today)(?![a-zA-Z])/i, () => base);
  takeDate(/(?<![a-zA-Z])(明日|あした|あす|明天|tomorrow)(?![a-zA-Z])/i, () => addDays(base, 1));
  takeDate(/(?<![a-zA-Z])(明後日|あさって|后天)(?![a-zA-Z])/i, () => addDays(base, 2));

  // CJK 曜日: 来週/下周/next プレフィックス付き。曜の付かない裸の漢字1字は誤検知防止のため拾わない
  takeDate(
    /(?<![一-龥a-zA-Z0-9])(再来週|来週|らいらいしゅう|らいしゅう|再下|下|next\s+)?((?:星期|礼拜|周)[一二三四五六日天]|[日月火水木金土](?:曜日?|ようび))(?![一-龥a-zA-Z0-9])/,
    (m) => {
      const token = m[2];
      const target = token.includes('曜') || token.includes('よう')
        ? WEEKDAY_KANJI[token[0]]
        : WEEKDAY_ZH[token[token.length - 1]];
      if (target === undefined) return undefined;
      return prefixedWeekday(m[1] ?? '', target, today);
    },
  );

  // 英語曜日: next fri / wednesday など
  takeDate(
    /(?<![a-zA-Z])(next\s+)?(sun(?:day)?|mon(?:day)?|tues?(?:day)?|wed(?:nesday)?|thur?(?:sday)?|fri(?:day)?|sat(?:urday)?)(?![a-z])/i,
    (m) => {
      const target = WEEKDAY_EN[m[2].toLowerCase()];
      if (target === undefined) return undefined;
      return prefixedWeekday(/next/i.test(m[1] ?? '') ? 'next' : '', target, today);
    },
  );

  return {
    title: rest.replace(/\s+/g, ' ').trim(),
    // 時刻だけ入力された場合は「今日」の予定として扱う
    due: due ?? (dueTime ? toISODate(today) : undefined),
    dueTime,
    priority,
    tags,
    estimateMinutes: estimate,
  };
}

function weekdayOffset(target: number, today: Date): number {
  return ((target - today.getDay()) + 7) % 7;
}

/** 翌週の月曜までの日数（週は月曜始まり） */
function nextMondayOffset(today: Date): number {
  return ((1 - today.getDay() + 7) % 7) || 7;
}

function prefixedWeekday(prefix: string, target: number, today: Date): string {
  const base = toISODate(today);
  if (/再来週|らいらいしゅう|再下/.test(prefix)) {
    return addDays(base, nextMondayOffset(today) + 7 + ((target - 1 + 7) % 7));
  }
  if (/来週|らいしゅう|下|next/i.test(prefix)) {
    return addDays(base, nextMondayOffset(today) + ((target - 1 + 7) % 7));
  }
  return addDays(base, weekdayOffset(target, today));
}

/** テキストから見積もり（分）だけを取り出す。編集ダイアログでも使う */
export function parseEstimateMinutes(text: string): number | undefined {
  let total: number | undefined;
  let rest = text;
  rest = rest.replace(/(?<!\d)(\d+(?:\.\d+)?)\s*(時間半|時間|个?小时)(?![一-龥])/gi,
    (_, n: string, unit: string) => {
      total = (total ?? 0) + Math.round(Number(n) * 60) + (unit === '時間半' ? 30 : 0);
      return ' ';
    });
  rest = rest.replace(/(?<!\d)(\d+(?:\.\d+)?)\s*h(?![a-z])/gi,
    (_, n: string) => {
      total = (total ?? 0) + Math.round(Number(n) * 60);
      return ' ';
    });
  rest = rest.replace(/(?<!\d)(\d+)\s*(分钟|min(?:ute)?s?|m(?![a-z])|分(?![一-龥]))(?![a-z])/gi,
    (_, n: string) => {
      total = (total ?? 0) + Number(n);
      return ' ';
    });
  rest = rest.replace(/(?<!\d)(\d+)\s*(分钟|min(?:ute)?s?|分(?![一-龥]))(?![a-z])/gi,
    (_, n: string) => {
      total = (total ?? 0) + Number(n);
      return ' ';
    });
  return total;
}

function upcomingMD(month: number, day: number, today: Date): string | undefined {
  if (month < 1 || month > 12 || day < 1 || day > 31) return undefined;
  const t = toISODate(today);
  let candidate = toISODate(new Date(today.getFullYear(), month - 1, day));
  if (candidate < t) {
    candidate = toISODate(new Date(today.getFullYear() + 1, month - 1, day));
  }
  return candidate;
}
