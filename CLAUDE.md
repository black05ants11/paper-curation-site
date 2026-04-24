# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## プロジェクト概要

抗エイジング研究の論文キュレーションサイト。論文（URL または PDF）を自動解析して構造化データを Supabase に保存し、Next.js 製 Web サイトで検索・閲覧できる。note 投稿用の解説記事（Markdown）も自動生成する。

## コマンド

### フロントエンド（Next.js）

```bash
npm run dev      # 開発サーバー起動 (http://localhost:3000)
npm run build    # 本番ビルド
npm run lint     # ESLint
```

### 論文解析スクリプト（Python）

```bash
# プロジェクトルートから実行する（scripts/ ディレクトリからは実行しない）
py -3.11 scripts/analyze_paper.py --url https://pubmed.ncbi.nlm.nih.gov/12345678/
py -3.11 scripts/analyze_paper.py --pdf pdfs/example.pdf
py -3.11 scripts/analyze_paper.py --pdf pdfs/example.pdf --preview  # DBに保存せず記事を表示

# 初回セットアップ
cd scripts && py -3.11 -m pip install -r requirements.txt
```

## アーキテクチャ

```
paper-curation/
├── src/
│   ├── app/
│   │   ├── page.tsx              # 論文一覧（サーバーコンポーネント）
│   │   └── papers/page.tsx       # 論文詳細（?doi= クエリパラメータ）
│   ├── components/
│   │   ├── PaperCard.tsx         # 一覧カード
│   │   ├── FilterBar.tsx         # ハッシュタグ・研究種類フィルター
│   │   ├── PapersClient.tsx      # フィルター状態管理（クライアント）
│   │   └── MarkdownRenderer.tsx  # react-markdown ラッパー（クライアント）
│   └── lib/
│       ├── supabase.ts           # Supabase クライアント & クエリ関数
│       ├── types.ts              # Paper 型定義（DB スキーマと 1:1）
│       └── constants.ts          # STUDY_TYPE_COLORS / LABELS / HASHTAGS
├── supabase/
│   └── migrations/
│       └── 001_initial_schema.sql
├── scripts/
│   ├── analyze_paper.py          # 論文解析パイプライン（CLI）
│   ├── requirements.txt
│   └── .env                      # ANTHROPIC_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
├── pdfs/                         # ペイウォール論文 PDF を手動配置
└── examples/
    ├── my_articles/              # やまだ note 記事サンプル（文体参考）
    └── nature_news/              # Nature News PDF サンプル（文体参考）
```

## データフロー

1. `analyze_paper.py` が URL（PubMed Entrez API）または PDF（pdfplumber）からテキスト抽出
2. 先頭 12,000 字 + 末尾 8,000 字を Claude API（claude-opus-4-7、max_tokens=8000）に渡す
3. JSON で構造化データを生成（`article_md` + `references` 配列を含む）
4. DOI で重複チェック → DOI 不明時はタイトル類似度（thefuzz、閾値 90%）でフォールバック
5. Supabase の `papers` テーブルに INSERT（サービスロールキー使用）
6. Next.js フロントエンドが Supabase JS クライアント（匿名キー）で読み取り表示

## article_md のフォーマット（現行）

Claude が生成する `article_md` は以下の構成で Markdown 出力する：

```
## [見出し]

[リード文]

## これまでの研究と未解決の問い
[先行研究 + [N] 番号引用]

## 今回の研究
[方法・結果・新規性・重要性を統合]

## 限界と今後の課題

## まとめ
✅ [実践アクション（任意）]

---
**【掲載情報】**
掲載誌：◯◯ | 発表年：◯◯◯◯ | 研究の種類：◯◯ | 著者：◯◯ et al.

#ハッシュタグ

### 参考文献
[1] 著者. タイトル. 誌名. 年;巻(号):ページ.
```

- 「おわりに〜スキしてくださいね」の定型文は含まない
- `### 参考文献` はフロントエンドで `article_md` の本文と分離して表示される

## references フィールド（--preview 専用）

Claude は `references` 構造化 JSON も出力する（DB には保存しない）。`--preview` 時に信頼度バッジを表示：
- `source: "pdf"` → ✅ PDF抽出：信頼度高
- `source: "knowledge"` → ⚠️ 知識補完：要確認

## DB スキーマの要点

- 主キー `doi`：実際の DOI または DOI 不明時の URL を格納
- `study_type`：`meta_analysis` / `rct` / `observational` / `basic` / `case_report` / `news`
- `evidence_level`：1（最強）〜 5（最弱）
- `article_md`：note 投稿用 Markdown 解説記事（`### 参考文献` セクションを末尾に含む）
- RLS 有効：SELECT は公開、INSERT/UPDATE はサービスロールキーのみ
- `references` カラムは存在しない（article_md に埋め込み）

## 論文詳細ページ（/papers?doi=...）

- DOI が `10.` で始まる場合は `https://doi.org/{doi}` を原文リンクとして生成
- `article_md` を `### 参考文献` で分割：本文は MarkdownRenderer で描画、参考文献は行ごとに `<li>` で表示
- 個別セクション（研究の背景・結果の要約・研究の限界）は表示しない（article_md に統合済み）

## 環境変数

| ファイル | 変数 | 用途 |
|---|---|---|
| `.env.local` | `NEXT_PUBLIC_SUPABASE_URL` | フロントエンド → Supabase |
| `.env.local` | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | フロントエンド → Supabase |
| `scripts/.env` | `SUPABASE_URL` | Python スクリプト |
| `scripts/.env` | `SUPABASE_SERVICE_ROLE_KEY` | Python スクリプト（書き込み権限） |
| `scripts/.env` | `ANTHROPIC_API_KEY` | Claude API 呼び出し |

## 論文入力ルール

- `pdfs/` に PDF を置いて `--pdf` オプションで指定（プロジェクトルートから実行）
- PubMed URL は Entrez API 経由で Abstract を取得、その他 URL はページ先頭 2 万字を使用
- 重複時はスキップしてログに記録（エラーにならない）
- `stop_reason=refusal` が返ることがある（稀）→ プロンプトの `◯◯` 等の記号を避けること

## 完成済み機能

- [x] 論文解析パイプライン（PDF / PubMed URL → Claude API → Supabase）
- [x] 重複チェック（DOI 完全一致 + タイトル類似度フォールバック）
- [x] note 投稿用解説記事の自動生成（新フォーマット）
- [x] --preview モード（DB 保存なし・信頼度バッジ付き参考文献表示）
- [x] 論文一覧ページ（ハッシュタグ・研究種類フィルター）
- [x] 論文詳細ページ（Markdown レンダリング・DOI リンク・参考文献リスト）

## 次のステップ：Vercel デプロイ

1. GitHub リポジトリを作成して push
2. Vercel でプロジェクトをインポート
3. 環境変数を Vercel に設定：
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. デプロイ実行（`npm run build` が通ることを事前確認）
