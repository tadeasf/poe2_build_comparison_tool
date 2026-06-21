"use client";

import { Check, Link2, Loader2 } from "lucide-react";
import { useState, useTransition } from "react";
import { shareComparison } from "@/app/builds/actions";
import { Button } from "@/components/ui/button";

/**
 * Marks both builds public (via the server action) and copies a public
 * `/share/<source>/<target>` link to the clipboard.
 */
export function ShareButton({ sourceId, targetId }: { sourceId: string; targetId: string }) {
  const [pending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onClick = () => {
    setError(null);
    startTransition(async () => {
      const res = await shareComparison(sourceId, targetId);
      if (res.error) {
        setError(res.error);
        return;
      }
      const url = `${window.location.origin}/share/${sourceId}/${targetId}`;
      try {
        await navigator.clipboard.writeText(url);
      } catch {
        // Clipboard blocked (e.g. insecure context) — still mark shared.
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <Button variant="outline" size="sm" onClick={onClick} disabled={pending}>
        {pending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : copied ? (
          <Check className="h-4 w-4" />
        ) : (
          <Link2 className="h-4 w-4" />
        )}
        {copied ? "Link copied" : "Share"}
      </Button>
      {copied && (
        <span className="text-[11px] text-muted-foreground">Both builds are now public.</span>
      )}
      {error && <span className="text-[11px] text-red-400">{error}</span>}
    </div>
  );
}
