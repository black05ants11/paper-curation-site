export const HASHTAGS = [
  "#腸内細菌",
  "#運動",
  "#睡眠",
  "#食事",
  "#脳科学",
  "#アンチエイジング",
] as const;

export const STUDY_TYPES = [
  "meta_analysis",
  "rct",
  "observational",
  "basic",
  "case_report",
  "news",
] as const;

export type StudyTypeKey = (typeof STUDY_TYPES)[number];

// カードバッジ・フィルターボタン用（短め）
export const STUDY_TYPE_SHORT: Record<string, string> = {
  meta_analysis: "メタ解析",
  rct: "RCT",
  observational: "観察研究",
  basic: "基礎研究",
  case_report: "症例報告",
  news: "ニュース・解説",
};

// 詳細ページ用（フル表記）
export const STUDY_TYPE_LABELS: Record<string, string> = {
  meta_analysis: "メタ解析",
  rct: "RCT（ランダム化比較試験）",
  observational: "観察研究",
  basic: "基礎研究",
  case_report: "症例報告",
  news: "ニュース・解説",
};

export const STUDY_TYPE_COLORS: Record<string, string> = {
  meta_analysis: "bg-emerald-500",
  rct:           "bg-blue-500",
  observational: "bg-amber-500",
  basic:         "bg-orange-500",
  case_report:   "bg-gray-500",
  news:          "bg-purple-500",
};
