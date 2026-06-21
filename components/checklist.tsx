"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import type { ChecklistItem } from "@/lib/diff/types";

export function Checklist({ items }: { items: ChecklistItem[] }) {
  const [done, setDone] = useState<Record<string, boolean>>({});
  const completed = useMemo(() => items.filter((i) => done[i.id]).length, [items, done]);

  if (items.length === 0) {
    return (
      <p className="rounded-lg border border-border/60 bg-card p-6 text-center text-muted-foreground">
        These builds are identical — nothing to change. 🎉
      </p>
    );
  }

  return (
    <div className="rounded-lg border border-border/60 bg-card">
      <div className="flex items-center justify-between border-b border-border/60 p-4">
        <h2 className="font-semibold">Action checklist</h2>
        <Badge variant={completed === items.length ? "default" : "secondary"}>
          {completed}/{items.length} done
        </Badge>
      </div>
      <ul className="divide-y divide-border/60">
        {items.map((item) => {
          const checked = !!done[item.id];
          return (
            <li key={item.id} className="flex items-start gap-3 p-4">
              <Checkbox
                id={`chk-${item.id}`}
                checked={checked}
                onCheckedChange={(v) =>
                  setDone((s) => ({ ...s, [item.id]: v === true }))
                }
                className="mt-0.5"
              />
              <label
                htmlFor={`chk-${item.id}`}
                className={`cursor-pointer text-sm ${checked ? "text-muted-foreground line-through" : ""}`}
              >
                <span>{item.action}</span>
                {item.detail && (
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {item.detail}
                  </span>
                )}
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
