import Link from "next/link";
import { Swords } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UserMenu } from "@/components/user-menu";
import { getUser } from "@/lib/supabase/auth";

export async function SiteHeader() {
  const user = await getUser();
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4 sm:gap-6">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <Swords className="h-5 w-5 text-primary" />
          <span>PoE2 Build Diff</span>
        </Link>
        <nav className="flex items-center gap-3 text-sm text-muted-foreground sm:gap-4">
          <Link href="/builds" className="transition-colors hover:text-foreground">
            Builds
          </Link>
          <Link href="/compare" className="transition-colors hover:text-foreground">
            Compare
          </Link>
        </nav>
        <div className="ml-auto">
          {user ? (
            <UserMenu email={user.email ?? ""} />
          ) : (
            <Button asChild size="sm">
              <Link href="/login">Sign in</Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
