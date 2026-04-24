"use client";

import { HASHTAGS, STUDY_TYPES, STUDY_TYPE_SHORT, STUDY_TYPE_COLORS } from "@/lib/constants";

interface FilterBarProps {
  activeHashtag: string | null;
  activeStudyType: string | null;
  total: number;
  filtered: number;
  onHashtagChange: (tag: string | null) => void;
  onStudyTypeChange: (type: string | null) => void;
}

export function FilterBar({
  activeHashtag,
  activeStudyType,
  total,
  filtered,
  onHashtagChange,
  onStudyTypeChange,
}: FilterBarProps) {
  const hasFilter = activeHashtag !== null || activeStudyType !== null;

  return (
    <div className="space-y-3 mb-8">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-gray-400 dark:text-gray-500 w-14 shrink-0">
          カテゴリ
        </span>
        {HASHTAGS.map((tag) => (
          <button
            key={tag}
            onClick={() => onHashtagChange(activeHashtag === tag ? null : tag)}
            className={`text-xs px-3 py-1 rounded-full border transition-colors ${
              activeHashtag === tag
                ? "bg-blue-600 text-white border-blue-600"
                : "border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-blue-400 dark:hover:border-blue-500"
            }`}
          >
            {tag}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-gray-400 dark:text-gray-500 w-14 shrink-0">
          研究種類
        </span>
        {STUDY_TYPES.map((type) => {
          const active = activeStudyType === type;
          const color = STUDY_TYPE_COLORS[type];
          return (
            <button
              key={type}
              onClick={() => onStudyTypeChange(active ? null : type)}
              className={`text-xs px-3 py-1 rounded-full border transition-colors font-medium ${
                active
                  ? `${color} text-white border-transparent`
                  : "border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-gray-400 dark:hover:border-gray-400"
              }`}
            >
              {STUDY_TYPE_SHORT[type]}
            </button>
          );
        })}
      </div>

      {hasFilter && (
        <div className="flex items-center gap-3 text-xs text-gray-400 dark:text-gray-500">
          <span>{filtered} / {total} 件</span>
          <button
            onClick={() => { onHashtagChange(null); onStudyTypeChange(null); }}
            className="text-blue-500 hover:underline"
          >
            フィルターをクリア
          </button>
        </div>
      )}
    </div>
  );
}
