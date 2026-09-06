import type { Locale } from '../i18n.svelte';

const WEEKDAY_CHARS: Record<Locale, string[]> = {
  ja: ['日', '月', '火', '水', '木', '金', '土'],
  en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  zh: ['日', '一', '二', '三', '四', '五', '六'],
};

const MONTHS_EN = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

const DUE_LABELS: Record<Locale, { today: string; tomorrow: string; dayAfter: string; overdue: string }> = {
  ja: { today: '今日', tomorrow: '明日', dayAfter: '明後日', overdue: '期限切れ' },
  en: { today: 'Today', tomorrow: 'Tomorrow', dayAfter: 'In 2 days', overdue: 'Overdue' },
  zh: { today: '今天', tomorrow: '明天', dayAfter: '后天', overdue: '已过期' },
};

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

/** 表示用: 期限切れ/今日/明日/明後日 は相対表現、それ以外は M/D(曜) */
export function formatDue(iso: string, locale: Locale, today: Date = new Date()): string {
  const diff = daysFromToday(iso, today);
  const labels = DUE_LABELS[locale];
  if (diff < 0) return `${labels.overdue} ${formatMD(iso, locale)}`;
  if (diff === 0) return labels.today;
  if (diff === 1) return labels.tomorrow;
  if (diff === 2) return labels.dayAfter;
  return formatMD(iso, locale);
}

export function formatMD(iso: string, locale: Locale): string {
  const [, m, d] = iso.split('-');
  const wd = WEEKDAY_CHARS[locale][fromISODate(iso).getDay()];
  if (locale === 'zh') return `${Number(m)}/${Number(d)}(周${wd})`;
  return `${Number(m)}/${Number(d)}(${wd})`;
}

export function formatTodayLong(locale: Locale, today: Date = new Date()): string {
  const y = today.getFullYear();
  const m = today.getMonth();
  const d = today.getDate();
  const wd = WEEKDAY_CHARS[locale][today.getDay()];
  if (locale === 'ja') return `${y}年${m + 1}月${d}日(${wd})`;
  if (locale === 'zh') return `${y}年${m + 1}月${d}日 周${wd}`;
  return `${wd}, ${MONTHS_EN[m]} ${d}, ${y}`;
}

/** 分を「1時間30分」/「1h 30m」/「1小时30分」表記に */
export function formatDuration(minutes: number, locale: Locale): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (locale === 'en') {
    const parts: string[] = [];
    if (h > 0) parts.push(`${h}h`);
    if (m > 0) parts.push(`${m}m`);
    return parts.join(' ') || '0m';
  }
  const hourUnit = locale === 'ja' ? '時間' : '小时';
  if (h > 0 && m > 0) return `${h}${hourUnit}${m}分`;
  if (h > 0) return `${h}${hourUnit}`;
  return `${m}分`;
}
