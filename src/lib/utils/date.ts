const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

/** ローカル日付を 'YYYY-MM-DD' に整形 */
export function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function todayISO(): string {
  return toISODate(new Date());
}

export function fromISODate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(iso: string, days: number): string {
  const d = fromISODate(iso);
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

/** iso が今日から何日後か（過去は負） */
export function daysFromToday(iso: string, today: Date = new Date()): number {
  const a = fromISODate(iso).getTime();
  const b = fromISODate(toISODate(today)).getTime();
  return Math.round((a - b) / 86_400_000);
}

/** 表示用: 逾期/今日/明日/明後日 は相対表現、それ以外は M/D(曜) */
export function formatDue(iso: string, today: Date = new Date()): string {
  const diff = daysFromToday(iso, today);
  if (diff < 0) return `逾期 ${formatMD(iso)}`;
  if (diff === 0) return '今日';
  if (diff === 1) return '明日';
  if (diff === 2) return '明後日';
  return formatMD(iso);
}

export function formatMD(iso: string): string {
  const [, m, d] = iso.split('-');
  const wd = WEEKDAYS[fromISODate(iso).getDay()];
  return `${Number(m)}/${Number(d)}(${wd})`;
}

export function formatTodayLong(today: Date = new Date()): string {
  const wd = WEEKDAYS[today.getDay()];
  return `${today.getFullYear()}年${today.getMonth() + 1}月${today.getDate()}日(${wd})`;
}
