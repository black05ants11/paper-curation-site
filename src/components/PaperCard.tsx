import Link from "next/link";
import type { Paper } from "@/lib/types";
import { STUDY_TYPE_SHORT, STUDY_TYPE_COLORS } from "@/lib/constants";

export function PaperCard({ paper }: { paper: Paper }) {
  const studyColor = paper.study_type ? STUDY_TYPE_COLORS[paper.study_type] : "bg-gray-400";
  const studyLabel = paper.study_type ? STUDY_TYPE_SHORT[paper.study_type] : null;
  const date = paper.published_date
    ? new Date(paper.published_date).toLocaleDateString("ja-JP", {
        year: "numeric",
        month: "long",
      })
    : null;

  return (
    <Link
      href={`/papers?doi=${encodeURIComponent(paper.doi)}`}
      className="flex flex-col rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 shadow-sm hover:shadow-md hover:border-blue-400 dark:hover:border-blue-500 transition-all duration-200 group"
    >
      {studyLabel && (
        <div className="mb-3">
          <span className={`text-xs font-bold text-white px-2.5 py-0.5 rounded-full ${studyColor}`}>
            {studyLabel}
          </span>
        </div>
      )}

      <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 leading-snug mb-2 line-clamp-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
        {paper.title_ja || paper.title_en}
      </h2>

      {(paper.journal || date) && (
        <p className="text-xs text-gray-400 dark:text-gray-500 mb-3">
          {[paper.journal, date].filter(Boolean).join(" · ")}
        </p>
      )}

      {paper.summary_ja && (
        <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed line-clamp-3 mb-3 flex-1">
          {paper.summary_ja}
        </p>
      )}

      {paper.hashtags && paper.hashtags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-auto pt-2 border-t border-gray-100 dark:border-gray-700">
          {paper.hashtags.map((tag) => (
            <span key={tag} className="text-xs text-blue-600 dark:text-blue-400">
              {tag}
            </span>
          ))}
        </div>
      )}
    </Link>
  );
}
