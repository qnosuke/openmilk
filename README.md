# openmilk 🥛

Remember The Milk の代替を目指す、ブラウザで完結するタスク管理 Web アプリ（開発中）。

- サーバー不要・ランニングコスト 0 円（静的ホスティングだけで動く）
- データはブラウザ内（IndexedDB）。JSON でのバックアップ/復元を実装予定
- AI エージェント（OpenClaw など）からファイル経由で操作しやすい設計を計画

## 開発

```bash
npm install
npm run dev      # 開発サーバー http://localhost:5173
npm run check    # 型チェック
npm run test     # ユニットテスト
npm run build    # 本番ビルド (dist/)
```

## タスク追加の記法（クイック追加）

```
牛乳を買う 明日 !2 #買い物
```

- 期限: `今日` `明日` `明後日` `金曜` `来週月曜` `9/15` `9月15日` `2026-10-01`
- 優先度: `!1`（高）`!2` `!3`
- タグ: `#買い物`（複数可）

設計とロードマップは [DEVELOPMENT_FLOW.md](./DEVELOPMENT_FLOW.md)、
エージェント向けの指示は [AGENTS.md](./AGENTS.md) を参照。
