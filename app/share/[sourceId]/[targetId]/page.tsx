import Link from "next/link";
import { notFound } from "next/navigation";
import { ComparisonView } from "@/components/comparison-view";
import { Button } from "@/components/ui/button";
import { compareBuilds } from "@/lib/diff";
import { ascendancyIdOf, hydrateBuild } from "@/lib/pob/hydrate";
import { createClient } from "@/lib/supabase/server";

// Public, no-login comparison view. RLS (builds_select_own_or_public) returns the
// builds only when their owner has marked them is_public via the Share button.
export default async function SharedComparisonPage({
  params,
}: {
  params: Promise<{ sourceId: string; targetId: string }>;
}) {
  const { sourceId, targetId } = await params;

  const supabase = await createClient();
  const { data } = await supabase
    .from("builds")
    .select("id, name, parsed, pob_string")
    .in("id", [sourceId, targetId]);

  const sourceRow = data?.find((b) => b.id === sourceId);
  const targetRow = data?.find((b) => b.id === targetId);
  if (!sourceRow || !targetRow) notFound();

  const source = hydrateBuild(sourceRow);
  const target = hydrateBuild(targetRow);
  const result = compareBuilds(source, target);

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
      <div className="mb-4 flex items-center justify-between">
        <span className="rounded-md border border-border/60 bg-muted/40 px-2 py-1 text-xs text-muted-foreground">
          Shared comparison · read-only
        </span>
        <Button asChild variant="ghost" size="sm">
          <Link href="/">Make your own →</Link>
        </Button>
      </div>
      <ComparisonView
        result={result}
        sourceName={sourceRow.name}
        targetName={targetRow.name}
        sourceNodes={source.tree.nodes}
        targetNodes={target.tree.nodes}
        sourceSet1={source.tree.weaponSet1Nodes ?? []}
        sourceSet2={source.tree.weaponSet2Nodes ?? []}
        targetSet1={target.tree.weaponSet1Nodes ?? []}
        targetSet2={target.tree.weaponSet2Nodes ?? []}
        ascendancyId={ascendancyIdOf(source)}
        ascendancyName={source.ascendClassName}
      />
    </main>
  );
}
