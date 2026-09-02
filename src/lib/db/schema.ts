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
  /** 見積もり（分） */
  estimateMinutes?: number;
  /** 所属リスト。undefined は INBOX */
  listId?: string;
  /** 繰り返しルール（将来拡張） */
  recurrence?: string;
  /** 完了日時 ISO 8601。未完了は undefined */
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
  /** 論理削除フラグ。IndexedDB は boolean を索引できないため 0/1 */
  deleted: 0 | 1;
}

export interface List {
  id: string; // crypto.randomUUID()
  name: string;
  /** 表示順（作成順） */
  order: number;
  createdAt: string;
  updatedAt: string;
  deleted: 0 | 1;
}

export const db = new Dexie('openmilk') as Dexie & {
  tasks: EntityTable<Task, 'id'>;
  lists: EntityTable<List, 'id'>;
};

// index: id（主キー）, その他は検索・ソートに使うものだけ
db.version(1).stores({
  tasks: 'id, deleted, completedAt, due, *tags',
});

// v2: リスト機能（tasks.listId, lists テーブル）
db.version(2).stores({
  tasks: 'id, deleted, completedAt, due, *tags, listId',
  lists: 'id, deleted, order',
});
