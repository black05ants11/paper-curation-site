"use client";

import { useState, useMemo } from "react";
import type { Paper } from "@/lib/types";
import { PaperCard } from "./PaperCard";
import { FilterBar } from "./FilterBar";

export function PapersClient({ papers }: { papers: Paper[] }) {
  const [activeHashtag, setActiveHashtag] = useState<string | null>(null);
  const [activeStudyType, setActiveStudyType] = useState<string | null>(null);

  const filtered = useMemo(
    () =>
      papers.filter((p) => {
        if (activeHashtag && !p.hashtags?.includes(activeHashtag)) return false;
        if (activeStudyType && p.study_type !== activeStudyType) return false;
        return true;
      }),
    [papers, activeHashtag, activeStudyType]
  );

  return (
    <>
      <FilterBar
        activeHashtag={activeHashtag}
        activeStudyType={activeStudyType}
        total={papers.length}
        filtered={filtered.length}
        onHashtagChange={setActiveHashtag}
        onStudyTypeChange={setActiveStudyType}
      />

      {filtered.length === 0 ? (
        <p className="text-center text-gray-400 dark:text-gray-500 py-20 text-sm">
          該当する論文が見つかりませんでした
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((paper) => (
            <PaperCard key={paper.doi} paper={paper} />
          ))}
        </div>
      )}
    </>
  );
}
