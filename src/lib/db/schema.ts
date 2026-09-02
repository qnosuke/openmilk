import Dexie, { type EntityTable } from 'dexie';

/**
 * タスク。JSON バックアップと将来のデバイス間同期を前提とした設計。
 * すべての変更は updatedAt を更新すること（taskRepository 経由で自動）。
 */
export interface Task {
  id: string; // crypto.randomUUID()
  title: string;
  notes?: string;
  /** 期限。ローカル日付 'YYYY-MM-DD'（時刻は将来拡張） */
  due?: string;
  priority?: 1 | 2 | 3;
  tags: string[];
  /** 繰り返しルール（将来拡張） */
  recurrence?: string;
  /** 完了日時 ISO 8601。未完了は undefined */
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
  /** 論理削除フラグ。IndexedDB は boolean を索引できないため 0/1 */
  deleted: 0 | 1;
}

export const db = new Dexie('openmilk') as Dexie & {
  tasks: EntityTable<Task, 'id'>;
};

// index: id（主キー）, deleted, completedAt, due, tags（複数）
db.version(1).stores({
  tasks: 'id, deleted, completedAt, due, *tags',
});
