import Link from "next/link";
import { Button } from "@/components/ui/button";
import { getUser } from "@/lib/supabase/auth";

export default async function Home() {
  const user = await getUser();
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 px-4 py-20 text-center">
      <div className="max-w-2xl space-y-5">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          Close the gap between your build and the one you want.
        </h1>
        <p className="text-lg text-muted-foreground">
          Import two Path of Building 2 builds of the same ascendancy. Get an exact,
          actionable list of the passives to allocate, the gear to swap (down to each
          mod), and the gems to change.
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-3">
        <Button asChild size="lg">
          <Link href={user ? "/builds" : "/signup"}>
            {user ? "Go to your builds" : "Get started"}
          </Link>
        </Button>
        <Button asChild size="lg" variant="outline">
          <Link href="/compare">Compare builds</Link>
        </Button>
      </div>
    </main>
  );
}
