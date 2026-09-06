# AGENTS.md — openmilk

エージェント（ZCode / OpenClaw など）がこのリポジトリで作業する際の指示書。

## プロジェクト概要

Remember The Milk の代替となる個人向けタスク管理 Web アプリ。
サーバーなしの静的 PWA（Vite + Svelte 5 + TypeScript + Dexie.js）で、
データはすべてブラウザ内の IndexedDB に保存する。
UI は日本語 / English / 中文の 3 言語（`src/lib/i18n.svelte.ts` の辞書で管理）。
設計方針とロードマップは `DEVELOPMENT_FLOW.md` を参照。

## コマンド

- `npm run dev` — 開発サーバー（http://localhost:5173）
- `npm run check` — svelte-check + tsc による型チェック（変更後は必ず通す）
- `npm run test` — vitest によるユニットテスト
- `npm run build` — 本番ビルド（dist/）

## 構成と慣習

- `src/lib/db/schema.ts` — Task / List 型と Dexie のスキーマ定義
- `src/lib/db/taskRepository.ts` — DB アクセスはこの層のみから行う。
  UI コンポーネントから Dexie を直接 import しない
- `src/lib/utils/` — 日付計算・クイック追加パーサー（日/英/中対応）・ソート（いずれもテストあり）
- `src/lib/components/` — UI 部品。表示文字列は `t()` 経由で辞書から取得する
- `src/lib/i18n.svelte.ts` — UI 多言語辞書。キーを追加するときは 3 言語すべてに足す

必須ルール:

1. タスクの削除は論理削除（`deleted: 1`）。物理削除しない
2. すべての変更は `updatedAt` を更新する（`taskRepository` の関数経由で自動）
3. 日付はローカルタイムゾーンの文字列 `'YYYY-MM-DD'`、日時は ISO 8601 で保存する
4. DB スキーマを変更する場合は `db.version(N).stores()` のバージョンを上げ、
   バックアップ JSON の `schemaVersion` も同時に上げる
5. UI は自動化しやすく保つ: 正しい HTML 要素、アイコンボタンに `aria-label`、
   キーボードだけで主要操作が完結すること

## 現在の実装メモ（2026-09-03 時点）

- 実装済みの主な機能: タスクCRUD、クイック追加（日/英/中の自然言語解析。
  期限・時刻・見積もり・優先度・タグを1行から解析）、リスト（INBOX + GTD 固定リスト
  next action/waiting/someday + 一般リスト）、タグ（クラウド表示/絞り込み/ミュート）、
  期間タイル（期限切れ/今日/明日/1週間）、全文検索、ソート、計測タイマー、
  リマインダー、完了ビュー分離、ゴミ箱（30日保管）、JSON 書き出し/読み込み、
  `?add=` URL、PWA、3 言語 UI
- **`tasks` 状態には削除済み（deleted: 1）と完了済みも含まれる**。表示の絞り込みは
  UI 側（`App.svelte` の view タブとフィルタ）で行う。件数の集計や検索など
  データを数える処理には必ず `!task.deleted` と完了状態のガードを入れること
- 計測タイマーは同時に 1 タスクのみ。`startTaskTimer` で他の計測を自動停止、
  完了時も自動停止する。経過は `trackedMinutes` + `timerStartedAt` で管理
- リマインダーは 30 秒間隔の `checkReminders` で発火する。push サーバーは無し
  （ブラウザ/PWA 起動中のみ通知）。同一タスクの再発火は `openmilk.notified`
  （localStorage）で防止
- ゴミ箱は 30 日保管。起動時の `purgeExpiredTrash` で 30 日超を物理削除する
- タグのミュート状態は `openmilk.mutedTags`（localStorage）に保存

## 開発環境

- リポジトリ: https://github.com/qnosuke/openmilk（main が最新）
- 公開 URL: https://qnosuke.github.io/openmilk/（main への push で自動デプロイ。
  GitHub Actions の `.github/workflows/deploy.yml` が担当）
- 別の環境での初回セットアップ: `git clone` → `npm install` → `npm run dev`
  （http://localhost:5173）
- タスクデータはブラウザの IndexedDB にあり、リポジトリには含まれない。
  持ち運ぶはアプリの ⚙ → 書き出し/読み込み（JSON、冪等マージ）を使う

## エージェント連携

このアプリは「エージェント（OpenClaw など）が整理し、人間はビューワー/微調整担当」
という使い方を想定して設計する。

- 実装済み:
  - `?add=<クイック追加1行>` URL でブラウザを1回開くだけでタスク登録（`App.svelte` の handleAddParam）。同一内容の再実行は 10 分以内ならスキップされる（リトライ安全）
  - 「書き出し/読み込み」ボタンによる JSON バックアップ（`taskRepository` の
    `exportAll` / `importBackup`。同一 id は updatedAt 新しい方を採用の冪等マージ。
    同時刻なら取り込み側を優先）
  - OpenClaw 用スキル: `skills/openmilk/SKILL.md`（OpenClaw の skills ディレクトリに
    コピーして使う。機能を変えたらこの SKILL.md も更新する）
- 未実装（計画）: 監視フォルダの `inbox.md` 取り込み、`openmilk.schema.json` の公開
  （DEVELOPMENT_FLOW.md Phase 6.5 参照）。実装の際はこのファイルと SKILL.md も更新すること
