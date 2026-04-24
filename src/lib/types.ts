export type StudyType =
  | "meta_analysis"
  | "rct"
  | "observational"
  | "basic"
  | "case_report"
  | "news";

export type EvidenceLevel = 1 | 2 | 3 | 4 | 5;

export interface Paper {
  doi: string;
  title_en: string;
  title_ja: string | null;
  authors: string[] | null;
  journal: string | null;
  published_date: string | null; // ISO date string
  study_type: StudyType | null;
  evidence_level: EvidenceLevel | null;
  summary_ja: string | null;
  background_ja: string | null;
  limitations_ja: string | null;
  hashtags: string[] | null;
  article_md: string | null;
  source_url: string | null;
  pdf_path: string | null;
  created_at: string;
}

export type PaperInsert = Omit<Paper, "created_at">;
