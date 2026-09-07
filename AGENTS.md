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

## 現在の実装メモ（2026-09-07 時点）

- 実装済みの主な機能: タスクCRUD、クイック追加（日/英/中の自然言語解析。
  期限・時刻・見積もり・優先度・タグを1行から解析）、リスト（INBOX + GTD 固定リスト
  next action/waiting/someday + 一般リスト）、タグ（クラウド表示/絞り込み/ミュート）、
  期間タイル（期限切れ/今日/明日/1週間）、全文検索＋検索ワードのハイライト、ソート、
  計測タイマー＋ポモドーロ（集中/休憩/長休憩を ⚙ で設定可）、リマインダー、
  INBOX 仕分けモード（next action/waiting/someday へワンクリック移動）、
  キーボードショートカット（仕分けモード限定の最小セット）、
  複数行の一括追加（クイック追加欄への貼り付け・テキストファイルのドロップ。
  1行=1タスク、上限100行）、タグの一括追加/削除（一括バー）、サブタスク
  （`parentId`。編集ダイアログで分割、子は親の下にインデント表示）、
  統計ビュー（日/週/月/年の完了数・見積もり計・実績計・予定通り率）、
  自動バックアップ（File System Access・Chrome/Edge。inbox.md/inbox.json 取り込みつき）、
  完了ビュー分離、ゴミ箱（30日保管）、JSON 書き出し/読み込み、
  `?add=` URL、PWA、3 言語 UI
- **INBOX の並び順は追加順（古いものが先）で固定**。ソート切り替えは INBOX 以外の
  ビューでのみ有効
- キーボードショートカットは最小セット: 全体で `a`（追加入力欄へ）と `/`（検索へ）。
  仕分けモード（INBOX のアクティブビュー）でのみ `j/k`（行移動）`1/2/3`（仕分け移動）
  `x`（完了）`e`（編集）`Space`（選択）`Esc`（解除）。入力欄・ダイアログ中は無効
- サブタスクは `Task.parentId`（DB v3・バックアップ schemaVersion 4）。
  子は親と同じリストに作り、親がビューに見えている間は子を行に直接出さず
  親の下にインデントして表示する（`src/lib/utils/subtasks.ts` の `splitOneLevel`）。
  **サブタスクは 1 階層限定**: 編集ダイアログでは子タスク（`parentId` 持ち）の
  分割欄を非表示にして作成を防ぎ、万一データに孫が混ざっても `splitOneLevel` が
  通常行として扱う
- ポモドーロの周期計算は `src/lib/utils/pomodoro.ts`（純粋関数・テストあり）。
  計測タイマーに重ねて動き、フェーズ切り替えで通知する（権限が無ければ
  データステータス欄で代用）。設定は localStorage `openmilk.pomodoro`
- 自動バックアップは `src/lib/backupFolder.ts`（File System Access API・Chrome/Edge のみ）。
  フォルダハンドルは DB v4 の `settings` テーブルに保存。データ変更 3 秒後に
  `openmilk-backup.json` をフォルダへ書き出し、起動時・フォーカス時に
  `inbox.md`（1行=1タスク）/ `inbox.json`（BackupData）を取り込んで `imported/` へ移動する
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
- 実装済み（2026-09-07）:
  - 監視フォルダ連携: ユーザーが ⚙ で自動バックアップフォルダを設定している場合、
    フォルダに `inbox.md`（1 行 = 1 タスク、クイック追加の記法・`- ` 箇条書き可）を
    置くと起動時・フォーカス時に INBOX へ取り込まれ、処理済みファイルは `imported/`
    へ移動する。`inbox.json`（BackupData 形式）も可。ファイル置き方式なので
    追加は冪等（処理済みは移動済みで残らない）
  - `openmilk.schema.json` の公開: https://qnosuke.github.io/openmilk/openmilk.schema.json
    （リポジトリの `public/openmilk.schema.json`。バックアップ形式の正本。生成ツールや
    エージェントはこれを読んで正確な JSON を作れる）
  - `openmilk-backup.json`: 自動バックアップ有効時はフォルダに常に最新の全データが
    ある。エージェントが現状の一覧を知りたいときは、ユーザーに書き出しボタンを押させ
    なくてもこのファイルを読めばよい
