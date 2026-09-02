# AGENTS.md — openmilk

エージェント（ZCode / OpenClaw など）がこのリポジトリで作業する際の指示書。

## プロジェクト概要

Remember The Milk の代替となる個人向けタスク管理 Web アプリ。
サーバーなしの静的 PWA（Vite + Svelte 5 + TypeScript + Dexie.js）で、
データはすべてブラウザ内の IndexedDB に保存する。
設計方針とロードマップは `DEVELOPMENT_FLOW.md` を参照。

## コマンド

- `npm run dev` — 開発サーバー（http://localhost:5173）
- `npm run check` — svelte-check + tsc による型チェック（変更後は必ず通す）
- `npm run test` — vitest によるユニットテスト
- `npm run build` — 本番ビルド（dist/）

## 構成と慣習

- `src/lib/db/schema.ts` — Task 型と Dexie のスキーマ定義
- `src/lib/db/taskRepository.ts` — DB アクセスはこの層のみから行う。
  UI コンポーネントから Dexie を直接 import しない
- `src/lib/utils/` — 日付計算・クイック追加パーサー（テストあり）
- `src/lib/components/` — UI 部品

必須ルール:

1. タスクの削除は論理削除（`deleted: 1`）。物理削除しない
2. すべての変更は `updatedAt` を更新する（`taskRepository` の関数経由で自動）
3. 日付はローカルタイムゾーンの文字列 `'YYYY-MM-DD'`、日時は ISO 8601 で保存する
4. DB スキーマを変更する場合は `db.version(N).stores()` のバージョンを上げ、
   バックアップ JSON の `schemaVersion` も同時に上げる
5. UI は自動化しやすく保つ: 正しい HTML 要素、アイコンボタンに `aria-label`、
   キーボードだけで主要操作が完結すること

## 将来のエージェント連携（未実装）

`DEVELOPMENT_FLOW.md` Phase 6.5 参照。監視フォルダの `inbox.md` 取り込み、
`openmilk.schema.json` によるデータ形式の公開、`?add=` クイック追加 URL を計画中。
実装の際はこのファイルも更新すること。
