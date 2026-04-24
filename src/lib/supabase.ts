import { createClient } from "@supabase/supabase-js";
import type { Paper } from "./types";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function fetchPapers(options?: {
  hashtag?: string;
  studyType?: string;
  limit?: number;
  offset?: number;
}): Promise<Paper[]> {
  let query = supabase
    .from("papers")
    .select("*")
    .order("published_date", { ascending: false });

  if (options?.hashtag) {
    query = query.contains("hashtags", [options.hashtag]);
  }
  if (options?.studyType) {
    query = query.eq("study_type", options.studyType);
  }
  if (options?.limit) {
    query = query.limit(options.limit);
  }
  if (options?.offset) {
    query = query.range(options.offset, options.offset + (options.limit ?? 20) - 1);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data as Paper[];
}

export async function fetchPaperByDoi(doi: string): Promise<Paper | null> {
  const { data, error } = await supabase
    .from("papers")
    .select("*")
    .eq("doi", doi)
    .single();
  if (error) return null;
  return data as Paper;
}
