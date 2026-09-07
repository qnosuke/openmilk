import { db } from './db/schema';
import { createTask, exportAll, importBackup } from './db/taskRepository';
import { parseInboxLines } from './utils/inbox';
import { parseTaskInput } from './utils/parseTask';

/**
 * 自動バックアップ + inbox ファイル取り込み（Phase 6 / 6.5）。
 * ユーザーが選んだローカルフォルダ（File System Access API）に
 * - 変更のたび openmilk-backup.json を自動保存する（エージェントはこれを読んで一覧を得られる）
 * - inbox.md（1 行 = 1 タスク）/ inbox.json（BackupData）が置かれていたら起動時・
 *   フォーカス時に取り込み、処理済みファイルは imported/ へ移動する（冪等化）
 *
 * API は Chrome / Edge のみ対応。未対応ブラウザでは UI も無効になる。
 */

// lib.dom の TypeScript バージョン差異に左右されないよう、必要な面だけの最小構造型を定義する
interface WritableLike {
  write(data: string | Blob): Promise<void>;
  close(): Promise<void>;
}
interface FileHandleLike {
  name: string;
  getFile(): Promise<File>;
  createWritable(): Promise<WritableLike>;
}
export interface FolderHandleLike {
  name: string;
  getFileHandle(name: string, options?: { create?: boolean }): Promise<FileHandleLike>;
  getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<FolderHandleLike>;
  removeEntry(name: string): Promise<void>;
  queryPermission(description?: { mode: 'read' | 'readwrite' }): Promise<PermissionState>;
  requestPermission(description?: { mode: 'read' | 'readwrite' }): Promise<PermissionState>;
  values(): AsyncIterableIterator<FolderHandleLike | FileHandleLike>;
}

declare global {
  interface Window {
    showDirectoryPicker?: (options?: {
      id?: string;
      mode?: 'read' | 'readwrite';
    }) => Promise<FolderHandleLike>;
  }
}

const SETTINGS_KEY = 'backupFolder';
const BACKUP_FILE_NAME = 'openmilk-backup.json';
const INBOX_MD = 'inbox.md';
const INBOX_JSON = 'inbox.json';
const IMPORTED_DIR = 'imported';
/** inbox.md の一括取り込み上限（複数行追加と同じ） */
const INBOX_LIMIT = 100;

let cachedHandle: FolderHandleLike | null = null;

export function isAutoBackupSupported(): boolean {
  return typeof window !== 'undefined' && typeof window.showDirectoryPicker === 'function';
}

async function loadHandle(): Promise<FolderHandleLike | null> {
  if (cachedHandle) return cachedHandle;
  try {
    const record = await db.settings.get(SETTINGS_KEY);
    const value = record?.value as FolderHandleLike | undefined;
    if (value) {
      cachedHandle = value;
      return value;
    }
  } catch {
    // 設定が読めない環境では無効のまま
  }
  return null;
}

async function queryPermission(handle: FolderHandleLike): Promise<PermissionState> {
  try {
    return await handle.queryPermission({ mode: 'readwrite' });
  } catch {
    return 'prompt';
  }
}

export async function getBackupFolderInfo(): Promise<{
  folderName: string | null;
  needsPermission: boolean;
}> {
  if (!isAutoBackupSupported()) return { folderName: null, needsPermission: false };
  const handle = await loadHandle();
  if (!handle) return { folderName: null, needsPermission: false };
  return { folderName: handle.name, needsPermission: (await queryPermission(handle)) !== 'granted' };
}

/** ユーザー操作の中でフォルダを選ばせる。キャンセル時は例外なので呼び出し側で握りつぶす */
export async function chooseBackupFolder(): Promise<string | null> {
  if (!isAutoBackupSupported() || !window.showDirectoryPicker) return null;
  const handle = await window.showDirectoryPicker({ id: 'openmilk-backup', mode: 'readwrite' });
  cachedHandle = handle;
  await db.settings.put({ key: SETTINGS_KEY, value: handle });
  return handle.name;
}

/** 権限が切れた場合に、ユーザー操作の中で再許可を求める */
export async function reconnectBackupFolder(): Promise<string | null> {
  const handle = await loadHandle();
  if (!handle) return null;
  try {
    const result = await handle.requestPermission({ mode: 'readwrite' });
    return result === 'granted' ? handle.name : null;
  } catch {
    return null;
  }
}

export async function disconnectBackupFolder(): Promise<void> {
  cachedHandle = null;
  await db.settings.delete(SETTINGS_KEY);
}

/** 現在の全データを openmilk-backup.json に書き出す（エージェントの読み取り用でもある） */
export async function backupNow(): Promise<'saved' | 'no-folder' | 'no-permission' | 'error'> {
  const handle = await loadHandle();
  if (!handle) return 'no-folder';
  try {
    if ((await queryPermission(handle)) !== 'granted') return 'no-permission';
    const data = JSON.stringify(await exportAll(), null, 2);
    const fileHandle = await handle.getFileHandle(BACKUP_FILE_NAME, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(data);
    await writable.close();
    return 'saved';
  } catch {
    return 'error';
  }
}

async function moveToImported(dir: FolderHandleLike, name: string, file: File): Promise<void> {
  const imported = await dir.getDirectoryHandle(IMPORTED_DIR, { create: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const target = await imported.getFileHandle(`${stamp}-${name}`, { create: true });
  const writable = await target.createWritable();
  await writable.write(file);
  await writable.close();
  await dir.removeEntry(name);
}

/**
 * バックアップフォルダの inbox.md / inbox.json を取り込む。
 * - inbox.md: 1 行をクイック追加として解析して INBOX へ。冪等化はファイルの移動で行う
 * - inbox.json: BackupData として importBackup する（id と updatedAt の冪等マージ）
 * 戻り値は登録できたタスク数。
 */
export async function importInboxFiles(): Promise<number> {
  const dir = await loadHandle();
  if (!dir) return 0;
  if ((await queryPermission(dir)) !== 'granted') return 0;

  let added = 0;

  const md = await dir
    .getFileHandle(INBOX_MD)
    .then((h) => h.getFile())
    .catch(() => null);
  if (md) {
    for (const line of parseInboxLines(await md.text()).slice(0, INBOX_LIMIT)) {
      const parsed = parseTaskInput(line);
      if (!parsed.title) continue;
      await createTask(parsed); // listId 未指定 = INBOX
      added += 1;
    }
    await moveToImported(dir, INBOX_MD, md);
  }

  const json = await dir
    .getFileHandle(INBOX_JSON)
    .then((h) => h.getFile())
    .catch(() => null);
  if (json) {
    try {
      added += await importBackup(JSON.parse(await json.text()));
    } catch {
      // 壊れた JSON は無視し、ファイルは imported/ に移さず残す
      return added;
    }
    await moveToImported(dir, INBOX_JSON, json);
  }

  return added;
}
