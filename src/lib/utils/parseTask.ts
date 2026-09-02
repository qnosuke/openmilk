import { addDays, toISODate } from './date';

export interface ParsedTask {
  title: string;
  /** 'YYYY-MM-DD' */
  due?: string;
  priority?: 1 | 2 | 3;
  tags: string[];
}

const WEEKDAY_KANJI: Record<string, number> = {
  日: 0,
  月: 1,
  火: 2,
  水: 3,
  木: 4,
  金: 5,
  土: 6,
};

/**
 * クイック追加の1行入力を解析する。
 * 記法: '#タグ' '!1〜!3' 期限は 今日/明日/明後日/月曜…/来週月曜/M月D日/M/D/YYYY-MM-DD
 * 期限・優先度・タグに解釈できた語はタイトルから除き、
 * 解釈できなかった語はそのままタイトルに残す（情報を落とさない）。
 */
export function parseTaskInput(input: string, today: Date = new Date()): ParsedTask {
  const tags: string[] = [];
  let priority: 1 | 2 | 3 | undefined;
  let due: string | undefined;
  const titleParts: string[] = [];

  for (const token of input.trim().split(/\s+/)) {
    const tag = /^#(.+)$/.exec(token);
    if (tag) {
      tags.push(tag[1]);
      continue;
    }

    const prio = /^!([123])$/.exec(token);
    if (prio) {
      priority = Number(prio[1]) as 1 | 2 | 3;
      continue;
    }

    const parsedDue = parseDueToken(token, today);
    if (parsedDue) {
      due = parsedDue;
      continue;
    }

    titleParts.push(token);
  }

  return { title: titleParts.join(' '), due, priority, tags };
}

function parseDueToken(token: string, today: Date): string | undefined {
  const base = toISODate(today);

  if (/^(今日|きょう|today)$/i.test(token)) return base;
  if (/^(明日|あした|あす|tomorrow)$/i.test(token)) return addDays(base, 1);
  if (/^(明後日|あさって)$/.test(token)) return addDays(base, 2);

  // 来週X曜 → 翌週以降の直近のX曜
  const nextWeek = /^(?:来週|らいしゅう)([日月火水木金土])(?:曜|ようび)?$/.exec(token);
  if (nextWeek) {
    const target = WEEKDAY_KANJI[nextWeek[1]];
    const diff = ((target - today.getDay()) + 7) % 7 || 7;
    return addDays(base, diff + 7);
  }

  // X曜 → 直近のX曜（今日を含む）
  const weekday = /^([日月火水木金土])(?:曜|ようび)?$/.exec(token);
  if (weekday) {
    const target = WEEKDAY_KANJI[weekday[1]];
    const diff = ((target - today.getDay()) + 7) % 7;
    return addDays(base, diff);
  }

  // YYYY-MM-DD
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(token);
  if (iso) {
    const d = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
    return toISODate(d); // 月日が不正（2/31 等）でも Date が正規化するので許容
  }

  // M月D日 / M/D → 未来直近（過ぎていれば来年）
  const jp = /^(\d{1,2})月(\d{1,2})日?$/.exec(token);
  if (jp) return upcomingMD(Number(jp[1]), Number(jp[2]), today);
  const slash = /^(\d{1,2})\/(\d{1,2})$/.exec(token);
  if (slash) return upcomingMD(Number(slash[1]), Number(slash[2]), today);

  return undefined;
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
