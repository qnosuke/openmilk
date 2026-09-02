// RTM (Remember The Milk) の JSON エクスポートを openmilk のバックアップ形式に変換する。
//
// 使い方:
//   TZ=Asia/Tokyo node scripts/convert-rtm.mjs <rtm-export.json> [output.json] [--incomplete-only]
//
// - 未完了/完了両方のタスクを取り込む（--incomplete-only で完了を除外）
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
    deleted: 0,
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

  if (typeof t.repeat_every === 'string' && t.repeat_every) task.recurrence = t.repeat_every;

  const notes = Array.isArray(t.notes) ? t.notes.join('\n') : t.notes;
  if (notes) task.notes = notes;
  else if (t.url) task.notes = t.url;

  tasks.push(task);
}

const backup = {
  schemaVersion: 3,
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
  withDue: tasks.filter((t) => t.due).length,
  withDueTime: tasks.filter((t) => t.dueTime).length,
  withEstimate: tasks.filter((t) => t.estimateMinutes).length,
  withTags: tasks.filter((t) => t.tags.length > 0).length,
};
console.log(JSON.stringify(stats, null, 2));
