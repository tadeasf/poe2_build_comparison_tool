import { ArrowRight, TriangleAlert } from "lucide-react";
import { Checklist } from "@/components/checklist";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import type { ComparisonResult } from "@/lib/diff/types";

function SectionCount({ n }: { n: number }) {
  return (
    <Badge variant={n > 0 ? "secondary" : "outline"} className="ml-2">
      {n}
    </Badge>
  );
}

function NodeChips({ ids, tone }: { ids: number[]; tone: "add" | "remove" }) {
  const shown = ids.slice(0, 60);
  const color =
    tone === "add"
      ? "text-emerald-400 border-emerald-500/30"
      : "text-red-400 border-red-500/30";
  return (
    <div className="flex flex-wrap gap-1">
      {shown.map((id) => (
        <span
          key={id}
          className={`rounded border ${color} bg-background/40 px-1.5 py-0.5 font-mono text-[11px]`}
        >
          {id}
        </span>
      ))}
      {ids.length > shown.length && (
        <span className="px-1.5 py-0.5 text-[11px] text-muted-foreground">
          +{ids.length - shown.length} more
        </span>
      )}
    </div>
  );
}

export function ComparisonView({
  result,
  sourceName,
  targetName,
}: {
  result: ComparisonResult;
  sourceName: string;
  targetName: string;
}) {
  const { tree, items, gems } = result;
  const equipCount = items.slots.length;
  const gemCount =
    gems.addedGroups.length + gems.removedGroups.length + gems.changedGroups.length;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <div className="flex flex-wrap items-center gap-2 text-lg font-semibold">
          <span>{sourceName}</span>
          <ArrowRight className="h-4 w-4 text-muted-foreground" />
          <span>{targetName}</span>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {result.ascendancy.source} · level {result.meta.sourceLevel} →{" "}
          {result.meta.targetLevel}
        </p>
      </div>

      {!result.compatible && (
        <Alert variant="destructive">
          <TriangleAlert className="h-4 w-4" />
          <AlertTitle>Different ascendancies</AlertTitle>
          <AlertDescription>
            {result.ascendancy.source} vs. {result.ascendancy.target}. This tool is
            designed to compare builds of the same ascendancy; the diff below may not be
            meaningful.
          </AlertDescription>
        </Alert>
      )}

      {/* Checklist */}
      <Checklist items={result.checklist} />

      {/* Categorized detail */}
      <Accordion type="multiple" defaultValue={["tree", "equipment", "gems"]}>
        <AccordionItem value="tree">
          <AccordionTrigger>
            Passive tree
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              +{tree.toAllocate.length} / −{tree.toRefund.length} (net{" "}
              {tree.netChange >= 0 ? "+" : ""}
              {tree.netChange})
            </span>
          </AccordionTrigger>
          <AccordionContent className="space-y-4">
            {tree.toAllocate.length > 0 && (
              <div className="space-y-1">
                <p className="text-sm font-medium text-emerald-400">
                  Allocate ({tree.toAllocate.length})
                </p>
                <NodeChips ids={tree.toAllocate.map((n) => n.id)} tone="add" />
              </div>
            )}
            {tree.toRefund.length > 0 && (
              <div className="space-y-1">
                <p className="text-sm font-medium text-red-400">
                  Refund ({tree.toRefund.length})
                </p>
                <NodeChips ids={tree.toRefund.map((n) => n.id)} tone="remove" />
              </div>
            )}
            {tree.toAllocate.length === 0 && tree.toRefund.length === 0 && (
              <p className="text-sm text-muted-foreground">Passive trees are identical.</p>
            )}
            <p className="text-xs text-muted-foreground">
              Node names and the visual tree overlay are coming next; for now these are
              passive node IDs.
            </p>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="equipment">
          <AccordionTrigger>
            Equipment
            <SectionCount n={equipCount} />
          </AccordionTrigger>
          <AccordionContent className="space-y-4">
            {equipCount === 0 && (
              <p className="text-sm text-muted-foreground">Gear is identical.</p>
            )}
            {items.slots.map((s) => (
              <div key={s.slot} className="rounded-md border border-border/60 p-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <span>{s.slot}</span>
                  <Badge variant="outline" className="text-[10px] uppercase">
                    {s.status}
                  </Badge>
                </div>
                <div className="mt-1 text-sm text-muted-foreground">
                  {s.source && <span>{s.source.name || s.source.base}</span>}
                  {s.source && s.target && <ArrowRight className="mx-1 inline h-3 w-3" />}
                  {s.target && (
                    <span className="text-foreground">{s.target.name || s.target.base}</span>
                  )}
                </div>
                {s.mods && (s.mods.added.length > 0 || s.mods.removed.length > 0) && (
                  <ul className="mt-2 space-y-0.5 text-xs">
                    {s.mods.added.map((m, i) => (
                      <li key={`a${i}`} className="text-emerald-400">
                        + {m}
                      </li>
                    ))}
                    {s.mods.removed.map((m, i) => (
                      <li key={`r${i}`} className="text-red-400">
                        − {m}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="gems">
          <AccordionTrigger>
            Skill gems
            <SectionCount n={gemCount} />
          </AccordionTrigger>
          <AccordionContent className="space-y-3">
            {gemCount === 0 && (
              <p className="text-sm text-muted-foreground">Skill setup is identical.</p>
            )}
            {gems.addedGroups.map((g) => (
              <div key={`add-${g.skill}`} className="text-sm">
                <span className="font-medium text-emerald-400">+ Add {g.skill}</span>
                <span className="ml-2 text-xs text-muted-foreground">
                  {g.gems.join(", ")}
                </span>
              </div>
            ))}
            {gems.removedGroups.map((g) => (
              <div key={`rem-${g.skill}`} className="text-sm">
                <span className="font-medium text-red-400">− Remove {g.skill}</span>
              </div>
            ))}
            {gems.changedGroups.map((g) => (
              <div key={`chg-${g.skill}`} className="space-y-0.5 text-sm">
                <span className="font-medium">{g.skill}</span>
                {g.addedGems.length > 0 && (
                  <div className="text-xs text-emerald-400">+ {g.addedGems.join(", ")}</div>
                )}
                {g.removedGems.length > 0 && (
                  <div className="text-xs text-red-400">− {g.removedGems.join(", ")}</div>
                )}
                {g.changed.map((c) => (
                  <div key={c.name} className="text-xs text-muted-foreground">
                    {c.name}: {c.from} → {c.to}
                  </div>
                ))}
              </div>
            ))}
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
