import Link from "next/link";
import { notFound } from "next/navigation";
import { ComparisonView } from "@/components/comparison-view";
import { Button } from "@/components/ui/button";
import { compareBuilds } from "@/lib/diff";
import type { PobBuild } from "@/lib/pob/types";
import { requireUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

export default async function ComparisonPage({
  params,
}: {
  params: Promise<{ sourceId: string; targetId: string }>;
}) {
  const { sourceId, targetId } = await params;
  await requireUser();

  const supabase = await createClient();
  const { data } = await supabase
    .from("builds")
    .select("id, name, parsed")
    .in("id", [sourceId, targetId]);

  const sourceRow = data?.find((b) => b.id === sourceId);
  const targetRow = data?.find((b) => b.id === targetId);
  if (!sourceRow || !targetRow) notFound();

  const source = sourceRow.parsed as unknown as PobBuild;
  const target = targetRow.parsed as unknown as PobBuild;
  const result = compareBuilds(source, target);

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
      <Button asChild variant="ghost" size="sm" className="mb-4 -ml-2">
        <Link href="/compare">← New comparison</Link>
      </Button>
      <ComparisonView
        result={result}
        sourceName={sourceRow.name}
        targetName={targetRow.name}
        sourceNodes={source.tree.nodes}
        targetNodes={target.tree.nodes}
      />
    </main>
  );
}
