import { fetchPapers } from "@/lib/supabase";
import { PapersClient } from "@/components/PapersClient";

export const revalidate = 60;

export default async function Home() {
  const papers = await fetchPapers();

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
        <header className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">
            抗エイジング論文データベース
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            腸内細菌・運動・睡眠・食事・脳科学の最新エビデンスを収録
          </p>
        </header>

        <PapersClient papers={papers} />
      </div>
    </main>
  );
}
