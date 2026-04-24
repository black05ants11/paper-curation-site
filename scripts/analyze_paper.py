"""
論文解析スクリプト
使用方法:
  python analyze_paper.py --url https://pubmed.ncbi.nlm.nih.gov/12345678/
  python analyze_paper.py --pdf ../pdfs/example.pdf
  python analyze_paper.py --url <URL> --preview   # DBに保存せず記事をターミナルに表示
"""

import argparse
import json
import logging
import os
import re
import sys
from pathlib import Path

import anthropic
import pdfplumber
import requests
from dotenv import load_dotenv
from supabase import create_client, Client
from thefuzz import fuzz

load_dotenv()

# Windows での日本語出力のため UTF-8 に統一
sys.stdout.reconfigure(encoding="utf-8")
sys.stderr.reconfigure(encoding="utf-8")

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
log = logging.getLogger(__name__)

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
ANTHROPIC_API_KEY = os.environ["ANTHROPIC_API_KEY"]

TITLE_SIMILARITY_THRESHOLD = 90  # % — この値以上なら重複とみなす

# ---------------------------------------------------------------------------
# 解析プロンプト
# ---------------------------------------------------------------------------

ANALYSIS_PROMPT = """\
以下の論文テキストを分析して、**JSONオブジェクトのみ**を出力してください。
前置き・コードブロック記法（```json）・後書きは不要です。JSONのみ出力してください。

=== 抽出フィールド ===

- doi: DOI文字列（例: "10.1038/s41586-023-00001-x"）。不明なら null
- title_en: 論文タイトル（英語原文）
- title_ja: 論文タイトル（日本語訳）
- authors: 著者リスト（["姓 名", ...]）
- journal: 掲載誌名
- published_date: 掲載日（YYYY-MM-DD。日不明ならYYYY-MM-01、月も不明ならYYYY-01-01）
- study_type: 研究種類。以下から1つ選択:
    "meta_analysis" | "rct" | "observational" | "basic" | "case_report" | "news"
- evidence_level: エビデンスレベル（整数1〜5）
    1=メタ解析/SR, 2=RCT, 3=観察研究, 4=基礎研究/症例報告, 5=専門家意見/ニュース
- summary_ja: 研究の結果と結論（300〜500字）
- background_ja: これまでの研究の流れと今回の新規性（200〜400字）
- limitations_ja: 研究の限界（100〜300字）
- hashtags: 関連ハッシュタグ。以下から複数選択:
    ["#腸内細菌", "#運動", "#睡眠", "#食事", "#脳科学", "#アンチエイジング"]
- article_md: 下記ルールで執筆したnote投稿用の解説記事（Markdown形式）
- references: 参考文献の構造化リスト（article_md 内の [N] 引用と1対1対応）
    形式：配列。各要素は以下のキーを持つオブジェクト
    {{
      "number": N（整数、引用番号）,
      "source": "pdf" または "knowledge",
      "authors": "著者名",
      "title": "論文タイトル（英語）",
      "journal": "掲載誌名",
      "year": "出版年（4桁）",
      "citation": "[N] 著者名. タイトル. 誌名. 年;巻(号):ページ."
    }}
    source の判定基準（厳守）：
      "pdf"       → 論文テキスト末尾の参考文献セクション（References / Bibliography）に
                    実際に記載されていた文献
      "knowledge" → 上記セクションに見当たらず Claude の学習データから補完した文献

=== article_md の執筆ルール ===

【文体・スタイル】
「やまだ＠腸活×アンチエイジング」のnote記事スタイルで書く。
- Nature Newsの特集記事のように、具体的なシーンや問いかけで書き出す
  （例: 「ある研究者が〜を発見した日〜」「あなたは〜を感じたことはありますか？」）
- 読者への語りかけ（「あなた」「みなさん」）を適宜使う
- 専門用語は初出で括弧補足する（例: 糸球体過剰ろ過（ハイパーフィルトレーション））
- エビデンスレベルに応じた表現を使い分ける
  - メタ解析/SR → 「〜が明らかになっています」「〜が示されています」
  - RCT → 「〜が確認されました」「〜が示されました」
  - 観察研究 → 「〜の傾向が見られます」「〜と報告されています」
  - 動物実験/基礎研究 → 「マウスでは〜が示されています」「まだヒトへの直接適用には注意が必要ですが」
- 具体的な数値・割合・効果量を積極的に記載する
- 実践的なアクション提案には ✅ を使う

【参考文献と引用】
- 論文テキスト末尾の参考文献リスト（References / Bibliography）から文献を抽出する
- 記事本文で先行研究に言及する箇所に [1]、[2] の番号引用を挿入する
  （特に「これまでの研究と未解決の問い」セクションを中心に、3〜8件が目安）
- 記事末尾のハッシュタグの後に、以下の形式で参考文献リストを追加する：

  ### 参考文献
  [1] 著者名. タイトル. 雑誌名. 年;巻(号):ページ.
  [2] ...

- 論文テキストに参考文献リストが含まれていない場合はこのセクションを省略する

【構成】（本文1200〜1800字 + 掲載情報 + 参考文献、Markdown形式）

## [キャッチーな見出し（30字以内・体言止めまたは問いかけ形式）]

[リード文: 150〜200字。Nature News風の書き出しから入り、「今回の研究が何をどう変えるか」を予告する。]

## これまでの研究と未解決の問い

[この分野でこれまでわかっていたこと（先行研究名・年号・番号引用を含めて時系列で）と、
 残されていた未解決問題、今回の研究が生まれた必然性を語る。300〜400字。]

## 今回の研究

[方法（対象・手法・デザイン・n数）、主な結果（具体的な数値・効果量を含む）、新規性・重要性を統合して説明。
 一般読者にわかるよう噛み砕く。400〜600字。]

## 限界と今後の課題

[研究の限界（サンプルサイズ・対象集団・実験系）をエビデンスレベルとともに正直に伝える。
 今後検証すべき問いも示す。100〜200字。]

## まとめ

[この研究の意義を3〜4行で総括する。]

✅ [実践的なアクション提案を1〜3項目（研究から直接引き出せる場合のみ）]

---
**【掲載情報】**
論文の掲載誌名・発表年・研究の種類（日本語）・著者名（第一著者〜3名＋et al.）を
以下の1行形式で末尾に小さく記載する：
掲載誌：Nature | 発表年：2026 | 研究の種類：基礎研究 | 著者：Smith J, et al.

[#アンチエイジング #関連ハッシュタグを3〜5個]

### 参考文献
[1] ...
[2] ...

=== 論文テキスト ===

{paper_text}
"""


# ---------------------------------------------------------------------------
# テキスト抽出
# ---------------------------------------------------------------------------

def extract_text_from_pdf(pdf_path: str) -> str:
    text_parts = []
    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            t = page.extract_text()
            if t:
                text_parts.append(t)
    return "\n".join(text_parts)


def fetch_text_from_url(url: str) -> str:
    """URL から論文テキストを取得する。PubMed の場合は Entrez API を使用。"""
    pubmed_match = re.search(r"pubmed\.ncbi\.nlm\.nih\.gov/(\d+)", url)
    if pubmed_match:
        pmid = pubmed_match.group(1)
        return _fetch_pubmed_abstract(pmid)

    resp = requests.get(url, timeout=30, headers={"User-Agent": "paper-curation/1.0"})
    resp.raise_for_status()
    return resp.text[:20000]


def _fetch_pubmed_abstract(pmid: str) -> str:
    base = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils"
    resp = requests.get(
        f"{base}/efetch.fcgi",
        params={"db": "pubmed", "id": pmid, "rettype": "abstract", "retmode": "text"},
        timeout=30,
    )
    resp.raise_for_status()
    return resp.text


# ---------------------------------------------------------------------------
# Claude API で解析
# ---------------------------------------------------------------------------

def _build_paper_excerpt(paper_text: str, front: int = 12000, back: int = 8000) -> str:
    """先頭と末尾を組み合わせる。末尾に参考文献セクションが含まれることが多いため。"""
    if len(paper_text) <= front + back:
        return paper_text
    return (
        paper_text[:front]
        + "\n\n...[中略]...\n\n"
        + paper_text[-back:]
    )


def analyze_with_claude(paper_text: str) -> dict:
    client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
    excerpt = _build_paper_excerpt(paper_text)
    prompt = ANALYSIS_PROMPT.format(paper_text=excerpt)

    message = client.messages.create(
        model="claude-opus-4-7",
        max_tokens=8000,
        messages=[{"role": "user", "content": prompt}],
    )

    text_blocks = [b for b in message.content if b.type == "text"]
    if not text_blocks:
        raise ValueError(
            f"Claude が空レスポンスを返しました。stop_reason={message.stop_reason}"
        )
    raw = text_blocks[0].text.strip()

    # コードブロック除去（念のため）
    raw = re.sub(r"^```(?:json)?\s*", "", raw)
    raw = re.sub(r"\s*```$", "", raw)

    json_match = re.search(r"\{[\s\S]+\}", raw)
    if not json_match:
        raise ValueError(f"JSON が見つかりませんでした。レスポンス: {raw[:500]}")
    return json.loads(json_match.group())


# ---------------------------------------------------------------------------
# 重複チェック
# ---------------------------------------------------------------------------

def check_duplicate(supabase: Client, doi: str | None, title_en: str) -> bool:
    """True なら重複（スキップ）。"""
    if doi:
        result = supabase.table("papers").select("doi").eq("doi", doi).execute()
        if result.data:
            log.info("重複スキップ（DOI 一致）: %s", doi)
            return True

    rows = supabase.table("papers").select("doi, title_en").execute().data
    for row in rows:
        score = fuzz.ratio(title_en.lower(), row["title_en"].lower())
        if score >= TITLE_SIMILARITY_THRESHOLD:
            log.info("重複スキップ（タイトル類似度 %d%%）: %s", score, row["doi"])
            return True
    return False


# ---------------------------------------------------------------------------
# DB 保存
# ---------------------------------------------------------------------------

def save_to_db(supabase: Client, record: dict, source_url: str | None, pdf_path: str | None) -> None:
    doi = record.get("doi") or source_url
    if not doi:
        raise ValueError("DOI も URL も取得できませんでした。スキップします。")

    row = {
        "doi":            doi,
        "title_en":       record["title_en"],
        "title_ja":       record.get("title_ja"),
        "authors":        record.get("authors"),
        "journal":        record.get("journal"),
        "published_date": record.get("published_date"),
        "study_type":     record.get("study_type"),
        "evidence_level": record.get("evidence_level"),
        "summary_ja":     record.get("summary_ja"),
        "background_ja":  record.get("background_ja"),
        "limitations_ja": record.get("limitations_ja"),
        "hashtags":       record.get("hashtags"),
        "article_md":     record.get("article_md"),
        "source_url":     source_url,
        "pdf_path":       str(pdf_path) if pdf_path else None,
    }

    supabase.table("papers").insert(row).execute()
    log.info("保存完了: %s", doi)


# ---------------------------------------------------------------------------
# プレビュー表示
# ---------------------------------------------------------------------------

def _print_preview(record: dict) -> None:
    """--preview モード用: 記事と参考文献信頼度レポートを表示。"""
    article = record.get("article_md", "")
    separator = "=" * 70
    print(f"\n{separator}")
    print("【生成された解説記事】")
    print(separator)
    print(article)
    print(separator + "\n")

    references = record.get("references", [])
    if not references:
        return

    print(f"\n{separator}")
    print("【参考文献の信頼度チェック】")
    print(separator)
    for ref in references:
        num = ref.get("number", "?")
        src = ref.get("source", "")
        citation = ref.get("citation", f"{ref.get('authors', '')}. {ref.get('title', '')}")

        if src == "pdf":
            badge = "✅ PDF抽出：信頼度高"
        else:
            badge = "⚠️  知識補完：要確認"

        print(f"[{num}] {badge}")
        print(f"     {citation}")
        print()
    print(separator + "\n")


# ---------------------------------------------------------------------------
# メインフロー
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(description="論文を解析して DB に保存します")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--url", help="論文の URL (PubMed など)")
    group.add_argument("--pdf", help="PDF ファイルのパス")
    parser.add_argument(
        "--preview",
        action="store_true",
        help="解析結果をターミナルに表示するのみ（DB には保存しない）",
    )
    args = parser.parse_args()

    # 1. テキスト抽出
    if args.pdf:
        pdf_path = Path(args.pdf).resolve()
        log.info("PDF を読み込み中: %s", pdf_path)
        paper_text = extract_text_from_pdf(str(pdf_path))
        source_url = None
    else:
        log.info("URL を取得中: %s", args.url)
        paper_text = fetch_text_from_url(args.url)
        source_url = args.url
        pdf_path = None

    if not paper_text.strip():
        log.error("テキストを取得できませんでした。")
        sys.exit(1)

    # 2. Claude で解析
    log.info("Claude API で解析中…")
    record = analyze_with_claude(paper_text)
    log.info("解析完了: %s", record.get("title_en", "(タイトル不明)"))

    # --preview: 記事と信頼度レポートを表示して終了（DB 操作なし）
    if args.preview:
        _print_preview(record)
        sys.exit(0)

    # 3. 重複チェック
    supabase_client: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
    if check_duplicate(supabase_client, record.get("doi"), record.get("title_en", "")):
        sys.exit(0)

    # 4. DB 保存
    save_to_db(supabase_client, record, source_url, pdf_path)


if __name__ == "__main__":
    main()
