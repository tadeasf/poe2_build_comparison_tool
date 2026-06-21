import Link from "next/link";
import { ComparePicker } from "@/components/compare-picker";
import { ImportBuildDialog } from "@/components/import-build-dialog";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

export default async function ComparePage() {
  const user = await requireUser();
  const supabase = await createClient();
  const { data } = await supabase
    .from("builds")
    .select("id, name, ascendancy, level")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const builds = data ?? [];

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
      <h1 className="text-2xl font-bold">Compare builds</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Choose your current build and a target build of the same ascendancy.
      </p>

      {builds.length < 2 ? (
        <div className="flex flex-col items-center gap-4 rounded-lg border border-dashed border-border/60 py-16 text-center">
          <p className="text-muted-foreground">
            You need at least two builds to compare. Import more first.
          </p>
          <div className="flex gap-2">
            <ImportBuildDialog />
            <Button asChild variant="outline">
              <Link href="/builds">Go to builds</Link>
            </Button>
          </div>
        </div>
      ) : (
        <ComparePicker builds={builds} />
      )}
    </main>
  );
}
