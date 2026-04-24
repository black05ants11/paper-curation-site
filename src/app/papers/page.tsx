import Link from "next/link";
import { notFound } from "next/navigation";
import { fetchPaperByDoi } from "@/lib/supabase";
import { STUDY_TYPE_LABELS, STUDY_TYPE_COLORS } from "@/lib/constants";
import MarkdownRenderer from "@/components/MarkdownRenderer";

export default async function PaperPage({
  searchParams,
}: {
  searchParams: Promise<{ doi?: string }>;
}) {
  const { doi: rawDoi } = await searchParams;
  if (!rawDoi) notFound();

  const doi = decodeURIComponent(rawDoi);
  const paper = await fetchPaperByDoi(doi);
  if (!paper) notFound();

  const studyColor = paper.study_type ? STUDY_TYPE_COLORS[paper.study_type] : "bg-gray-400";
  const studyLabel = paper.study_type ? STUDY_TYPE_LABELS[paper.study_type] : null;
  const date = paper.published_date
    ? new Date(paper.published_date).toLocaleDateString("ja-JP", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  // DOIが実際のDOIならhttps://doi.orgリンクを生成、そうでなければsource_urlを使用
  const articleUrl = paper.doi.startsWith("10.")
    ? `https://doi.org/${paper.doi}`
    : paper.source_url;

  // article_mdから参考文献セクションを分離
  const refSectionMatch = paper.article_md?.match(/(### 参考文献[\s\S]*)$/);
  const articleBody = refSectionMatch
    ? paper.article_md!.slice(0, refSectionMatch.index)
    : paper.article_md;
  const refLines = refSectionMatch
    ? refSectionMatch[1]
        .replace(/^### 参考文献\n?/, "")
        .split("\n")
        .filter((l) => l.trim())
    : [];

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
        <Link
          href="/"
          className="inline-block text-sm text-blue-600 dark:text-blue-400 hover:underline mb-6"
        >
          ← 一覧に戻る
        </Link>

        <article className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 sm:p-8 shadow-sm">
          {/* 研究種類バッジ */}
          {studyLabel && (
            <div className="mb-4">
              <span className={`text-xs font-bold text-white px-2.5 py-1 rounded-full ${studyColor}`}>
                {studyLabel}
              </span>
            </div>
          )}

          {/* タイトル */}
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 leading-snug mb-1">
            {paper.title_ja || paper.title_en}
          </h1>
          {paper.title_ja && paper.title_en && (
            <p className="text-sm text-gray-400 dark:text-gray-500 mb-4 italic">
              {paper.title_en}
            </p>
          )}

          {/* メタ情報 */}
          <div className="text-sm text-gray-500 dark:text-gray-400 space-y-1 mb-5">
            {paper.authors && paper.authors.length > 0 && (
              <p>{paper.authors.join(", ")}</p>
            )}
            {(paper.journal || date) && (
              <p>{[paper.journal, date].filter(Boolean).join(" · ")}</p>
            )}
            {articleUrl && (
              <a
                href={articleUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 dark:text-blue-400 hover:underline inline-block"
              >
                原文を見る →
              </a>
            )}
          </div>

          {/* ハッシュタグ */}
          {paper.hashtags && paper.hashtags.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-7 pb-5 border-b border-gray-100 dark:border-gray-700">
              {paper.hashtags.map((tag) => (
                <span key={tag} className="text-sm text-blue-600 dark:text-blue-400">
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* 解説記事（Markdownレンダリング） */}
          {articleBody && (
            <div className="mt-2">
              <MarkdownRenderer content={articleBody} />
            </div>
          )}

          {/* 参考文献リスト */}
          {refLines.length > 0 && (
            <div className="mt-6 pt-6 border-t border-gray-100 dark:border-gray-700">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
                参考文献
              </h3>
              <ol className="space-y-2">
                {refLines.map((line, i) => (
                  <li
                    key={i}
                    className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed"
                  >
                    {line}
                  </li>
                ))}
              </ol>
            </div>
          )}
        </article>
      </div>
    </main>
  );
}
