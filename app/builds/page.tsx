import Link from "next/link";
import { BuildCard } from "@/components/build-card";
import { ImportBuildDialog } from "@/components/import-build-dialog";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

export default async function BuildsPage() {
  const user = await requireUser();
  const supabase = await createClient();
  const { data } = await supabase
    .from("builds")
    .select("id, name, class, ascendancy, level, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const builds = data ?? [];

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Your builds</h1>
          <p className="text-sm text-muted-foreground">
            Import builds, then compare two of the same ascendancy.
          </p>
        </div>
        <div className="flex gap-2">
          {builds.length > 1 && (
            <Button asChild variant="outline">
              <Link href="/compare">Compare</Link>
            </Button>
          )}
          <ImportBuildDialog />
        </div>
      </div>

      {builds.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-lg border border-dashed border-border/60 py-20 text-center">
          <p className="text-muted-foreground">
            No builds yet. Import a Path of Building 2 export to get started.
          </p>
          <ImportBuildDialog triggerLabel="Import your first build" />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {builds.map((b) => (
            <BuildCard
              key={b.id}
              build={{
                id: b.id,
                name: b.name,
                class: b.class,
                ascendancy: b.ascendancy,
                level: b.level,
                createdAt: b.created_at,
              }}
            />
          ))}
        </div>
      )}
    </main>
  );
}
