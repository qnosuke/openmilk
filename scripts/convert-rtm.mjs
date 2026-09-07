// RTM (Remember The Milk) の JSON エクスポートを openmilk のバックアップ形式に変換する。
//
// 使い方:
//   TZ=Asia/Tokyo node scripts/convert-rtm.mjs <rtm-export.json> [output.json] [--incomplete-only]
//
// - 未完了/完了両方のタスクを取り込む（--incomplete-only で完了を除外）
// - メモはトップレベル notes 配列にあり、series_id でタスクに紐づけて合成する
// - repeat（RRULE）は recurrence に保存、ゴミ箱タスクは deleted: 1
// - RTM の「Inbox」「Sent」は openmilk の INBOX（listId なし）に合流
// - アーカイブ済みリストも通常リストとして取り込む
// - スマートリスト（保存済み検索）は変換できないためスキップ
// - 見積もり (PT2H30M) は分に変換、due はローカル日付、時刻つきは HH:mm
import { readFileSync, writeFileSync } from 'node:fs';

const input = process.argv[2];
const output = process.argv[3] ?? 'openmilk-import.json';
const incompleteOnly = process.argv.includes('--incomplete-only');

if (!input) {
  console.error('使い方: TZ=Asia/Tokyo node scripts/convert-rtm.mjs <rtm-export.json> [output.json] [--incomplete-only]');
  process.exit(1);
}

const rtm = JSON.parse(readFileSync(input, 'utf8'));
const SKIP_LIST_NAMES = new Set(['Inbox', 'Sent']);

// 構造の事前チェック（エクスポート形式が想定と違うときに分かりやすく失敗させる）
if (!Array.isArray(rtm.tasks) || !Array.isArray(rtm.lists)) {
  console.error('RTM のエクスポートとして認識できません（tasks / lists の配列がありません）。');
  console.error(`トップレベルのキー: ${Object.keys(rtm).join(', ') || '(なし)'}`);
  if (rtm.tasks && typeof rtm.tasks === 'object') {
    console.error(`tasks のキー: ${Object.keys(rtm.tasks).join(', ')}`);
  }
  console.error('Export は RTM の設定歯車 → Account settings → Export →「Download Export」（JSON）で取得してください。');
  process.exit(1);
}

// --- リスト ---
const lists = [];
const listIdMap = new Map(); // RTM list id -> openmilk list id（INBOX 合流分は undefined）
let order = 0;
for (const l of rtm.lists ?? []) {
  if (SKIP_LIST_NAMES.has(l.name)) {
    listIdMap.set(l.id, undefined);
    continue;
  }
  const id = `rtm-list-${l.id}`;
  listIdMap.set(l.id, id);
  lists.push({
    id,
    name: l.name,
    order: order++,
    createdAt: new Date(l.date_created).toISOString(),
    updatedAt: new Date(l.date_modified ?? l.date_created).toISOString(),
    deleted: 0,
  });
}

// --- 見積もり (ISO 8601 duration) を分へ ---
function parseEstimateMinutes(iso) {
  if (typeof iso !== 'string') return undefined;
  const m = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso);
  if (!m) return undefined;
  const minutes = Number(m[1] ?? 0) * 60 + Number(m[2] ?? 0);
  return minutes > 0 ? minutes : undefined;
}

// --- エポックms → ローカル日付/時刻（TZ 環境変数でタイムゾーンを固定して実行すること） ---
function toDate(ms) {
  const d = new Date(ms);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function toTime(ms) {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// --- メモ: トップレベル notes を series_id でタスクに紐づける ---
const notesBySeries = new Map();
for (const n of rtm.notes ?? []) {
  if (!notesBySeries.has(n.series_id)) notesBySeries.set(n.series_id, []);
  notesBySeries.get(n.series_id).push(n);
}
function notesFor(task) {
  const notes = (notesBySeries.get(task.series_id) ?? [])
    .slice()
    .sort((a, b) => (a.date_created ?? 0) - (b.date_created ?? 0));
  return notes
    .map((n) => (n.title ? `【${n.title}】\n${n.content}` : n.content))
    .filter((c) => c && String(c).trim())
    .join('\n---\n');
}

// --- タスク ---
const tasks = [];
let skipped = 0;
for (const t of rtm.tasks ?? []) {
  if (incompleteOnly && t.date_completed) {
    skipped += 1;
    continue;
  }
  if (!t.name || typeof t.name !== 'string') {
    skipped += 1;
    continue;
  }

  const task = {
    id: `rtm-${t.id}`,
    title: t.name,
    tags: Array.isArray(t.tags) ? t.tags : [],
    createdAt: new Date(t.date_created ?? Date.now()).toISOString(),
    updatedAt: new Date(t.date_modified ?? t.date_created ?? Date.now()).toISOString(),
    deleted: t.date_trashed ? 1 : 0,
  };
  if (t.date_completed) task.completedAt = new Date(t.date_completed).toISOString();

  const priority = t.priority === 'P1' ? 1 : t.priority === 'P2' ? 2 : t.priority === 'P3' ? 3 : undefined;
  if (priority) task.priority = priority;

  if (t.date_due) {
    task.due = toDate(t.date_due);
    if (t.date_due_has_time) task.dueTime = toTime(t.date_due);
  }

  const estimate = parseEstimateMinutes(t.estimate);
  if (estimate) task.estimateMinutes = estimate;

  const listId = listIdMap.get(t.list_id);
  if (listId) task.listId = listId;

  const recurrence = typeof t.repeat === 'string' && t.repeat ? t.repeat : undefined;
  if (recurrence) task.recurrence = recurrence;

  const noteText = notesFor(t);
  if (noteText) task.notes = noteText;
  else if (t.url) task.notes = t.url;

  tasks.push(task);
}

const backup = {
  schemaVersion: 4,
  exportedAt: new Date().toISOString(),
  tasks,
  lists,
};

writeFileSync(output, JSON.stringify(backup, null, 2));

const completed = tasks.filter((t) => t.completedAt).length;
const stats = {
  output,
  tasks: tasks.length,
  completed,
  incomplete: tasks.length - completed,
  lists: lists.length,
  skipped: skipped,
  trashed: tasks.filter((t) => t.deleted).length,
  withNotes: tasks.filter((t) => t.notes).length,
  withRecurrence: tasks.filter((t) => t.recurrence).length,
  withDue: tasks.filter((t) => t.due).length,
  withDueTime: tasks.filter((t) => t.dueTime).length,
  withEstimate: tasks.filter((t) => t.estimateMinutes).length,
  withTags: tasks.filter((t) => t.tags.length > 0).length,
};
console.log(JSON.stringify(stats, null, 2));
