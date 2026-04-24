-- papers テーブル
-- doi カラムは実際の DOI (例: 10.1038/s41586-023-00001-x) か、
-- DOI 不明時は論文 URL をフォールバックとして格納する
CREATE TABLE IF NOT EXISTS papers (
  doi             TEXT        PRIMARY KEY,
  title_en        TEXT        NOT NULL,
  title_ja        TEXT,
  authors         TEXT[],
  journal         TEXT,
  published_date  DATE,
  study_type      TEXT        CHECK (study_type IN (
                                'meta_analysis',
                                'rct',
                                'observational',
                                'basic',
                                'case_report',
                                'news'
                              )),
  evidence_level  SMALLINT    CHECK (evidence_level BETWEEN 1 AND 5),
  summary_ja      TEXT,
  background_ja   TEXT,
  limitations_ja  TEXT,
  hashtags        TEXT[],
  article_md      TEXT,
  source_url      TEXT,
  pdf_path        TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- タイトル類似度チェック用（DOI フォールバック時に使用）
CREATE INDEX IF NOT EXISTS papers_title_en_idx ON papers USING gin(to_tsvector('english', title_en));

-- ハッシュタグ検索用
CREATE INDEX IF NOT EXISTS papers_hashtags_idx ON papers USING gin(hashtags);

-- 掲載日降順（一覧表示用）
CREATE INDEX IF NOT EXISTS papers_published_date_idx ON papers (published_date DESC);

-- Row Level Security（Supabase で公開読み取り、書き込みはサービスロールのみ）
ALTER TABLE papers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read" ON papers
  FOR SELECT USING (true);

-- 重複チェック用ビュー：DOI で既存レコードを素早く確認
CREATE OR REPLACE VIEW paper_dois AS
  SELECT doi, title_en, source_url FROM papers;
