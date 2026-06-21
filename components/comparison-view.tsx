import { ArrowRight, TriangleAlert } from "lucide-react";
import { Checklist } from "@/components/checklist";
import { ShareButton } from "@/components/share-button";
import { PassiveTree } from "@/components/tree/passive-tree";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import type { ComparisonResult, TreeNodeRef } from "@/lib/diff/types";

function SectionCount({ n }: { n: number }) {
  return (
    <Badge variant={n > 0 ? "secondary" : "outline"} className="ml-2">
      {n}
    </Badge>
  );
}

/** Small "I"/"II" pill marking a weapon-set-specific passive. */
function SetBadge({ set }: { set?: TreeNodeRef["set"] }) {
  if (set !== "set1" && set !== "set2") return null;
  const cls =
    set === "set1"
      ? "border-red-500/40 text-red-400"
      : "border-green-500/40 text-green-400";
  return (
    <span className={`ml-1 rounded-sm border ${cls} px-1 text-[9px] font-semibold leading-tight`}>
      {set === "set1" ? "I" : "II"}
    </span>
  );
}

function NodeList({ refs, tone }: { refs: TreeNodeRef[]; tone: "add" | "remove" }) {
  const notables = refs.filter((r) => r.isNotable);
  const minor = refs.length - notables.length;
  const color =
    tone === "add"
      ? "text-emerald-400 border-emerald-500/30"
      : "text-red-400 border-red-500/30";
  return (
    <div className="flex flex-wrap gap-1">
      {notables.map((r) => (
        <span
          key={r.id}
          className={`inline-flex items-center rounded border ${color} bg-background/40 px-1.5 py-0.5 text-[11px] font-medium`}
        >
          {r.name ?? `Node ${r.id}`}
          <SetBadge set={r.set} />
        </span>
      ))}
      {minor > 0 && (
        <span className="rounded border border-border/60 bg-background/40 px-1.5 py-0.5 text-[11px] text-muted-foreground">
          +{minor} minor {minor === 1 ? "passive" : "passives"}
        </span>
      )}
    </div>
  );
}

const SET_LABEL = { common: "Common", set1: "Set I", set2: "Set II" } as const;

/**
 * A tree change group (Allocate / Refund) that, when any nodes are weapon-set
 * specific, breaks them out under "Weapon Set I/II" so the per-set point cost is
 * obvious (weapon-set points are a separate pool in PoE2).
 */
function TreeChange({
  title,
  titleColor,
  refs,
  tone,
}: {
  title: string;
  titleColor: string;
  refs: TreeNodeRef[];
  tone: "add" | "remove";
}) {
  const common = refs.filter((r) => (r.set ?? "common") === "common");
  const set1 = refs.filter((r) => r.set === "set1");
  const set2 = refs.filter((r) => r.set === "set2");
  const hasSets = set1.length + set2.length > 0;
  return (
    <div className="space-y-1.5">
      <p className={`text-sm font-medium ${titleColor}`}>
        {title} ({refs.length})
        {hasSets && (
          <span className="ml-2 text-[11px] font-normal text-muted-foreground">
            Common {common.length} · <span className="text-red-400">Set I {set1.length}</span> ·{" "}
            <span className="text-green-400">Set II {set2.length}</span>
          </span>
        )}
      </p>
      {!hasSets && <NodeList refs={refs} tone={tone} />}
      {hasSets && (
        <div className="space-y-1.5">
          {common.length > 0 && <NodeList refs={common} tone={tone} />}
          {set1.length > 0 && (
            <div className="space-y-1">
              <p className="text-[11px] font-medium text-red-400">Weapon Set I ({set1.length})</p>
              <NodeList refs={set1} tone={tone} />
            </div>
          )}
          {set2.length > 0 && (
            <div className="space-y-1">
              <p className="text-[11px] font-medium text-green-400">Weapon Set II ({set2.length})</p>
              <NodeList refs={set2} tone={tone} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function ComparisonView({
  result,
  sourceName,
  targetName,
  sourceNodes,
  targetNodes,
  sourceSet1 = [],
  sourceSet2 = [],
  targetSet1 = [],
  targetSet2 = [],
  ascendancyId,
  ascendancyName,
  sourceId,
  targetId,
  shareable = false,
}: {
  result: ComparisonResult;
  sourceName: string;
  targetName: string;
  sourceNodes: number[];
  targetNodes: number[];
  sourceSet1?: number[];
  sourceSet2?: number[];
  targetSet1?: number[];
  targetSet2?: number[];
  /** ascendancyId (className+ascendClassId) to render its sub-tree panel. */
  ascendancyId?: string;
  ascendancyName?: string;
  /** Build ids, used by the share button. */
  sourceId?: string;
  targetId?: string;
  /** Show the "copy share link" control (authed compare page only). */
  shareable?: boolean;
}) {
  const { tree, items, gems } = result;
  const equipCount = items.slots.length;
  const gemCount =
    gems.addedGroups.length + gems.removedGroups.length + gems.changedGroups.length;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
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
        {shareable && sourceId && targetId && (
          <ShareButton sourceId={sourceId} targetId={targetId} />
        )}
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

      {/* Visual tree map */}
      <div className="space-y-2">
        <h2 className="font-semibold">Passive tree map</h2>
        <div className="h-[60vh] w-full overflow-hidden rounded-lg border border-border/60 bg-card sm:h-[520px]">
          <PassiveTree
            sourceNodes={sourceNodes}
            targetNodes={targetNodes}
            sourceSet1={sourceSet1}
            sourceSet2={sourceSet2}
            targetSet1={targetSet1}
            targetSet2={targetSet2}
          />
        </div>
      </div>

      {/* Ascendancy sub-tree (own panel — sits far from the main tree) */}
      {ascendancyId && (
        <div className="space-y-2">
          <h2 className="font-semibold">
            Ascendancy{ascendancyName ? ` — ${ascendancyName}` : ""}
          </h2>
          <div className="h-[300px] w-full overflow-hidden rounded-lg border border-border/60 bg-card sm:h-[340px]">
            <PassiveTree
              ascendancy={ascendancyId}
              sourceNodes={sourceNodes}
              targetNodes={targetNodes}
            />
          </div>
        </div>
      )}

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
              <TreeChange
                title="Allocate"
                titleColor="text-emerald-400"
                refs={tree.toAllocate}
                tone="add"
              />
            )}
            {tree.toRefund.length > 0 && (
              <TreeChange
                title="Refund"
                titleColor="text-red-400"
                refs={tree.toRefund}
                tone="remove"
              />
            )}
            {tree.movedBetweenSets.length > 0 && (
              <div className="space-y-1">
                <p className="text-sm font-medium text-amber-400">
                  Reassign between weapon sets ({tree.movedBetweenSets.length})
                </p>
                <ul className="space-y-0.5 text-[11px] text-muted-foreground">
                  {tree.movedBetweenSets.map((r) => (
                    <li key={r.id}>
                      <span className="text-foreground">{r.name ?? `Node ${r.id}`}</span>{" "}
                      {SET_LABEL[r.fromSet ?? "common"]} → {SET_LABEL[r.toSet ?? "common"]}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {tree.toAllocate.length === 0 &&
              tree.toRefund.length === 0 &&
              tree.movedBetweenSets.length === 0 && (
                <p className="text-sm text-muted-foreground">Passive trees are identical.</p>
              )}
            <p className="text-xs text-muted-foreground">
              Notables are named; minor passives are summarized.{" "}
              <span className="text-red-400">I</span> /{" "}
              <span className="text-green-400">II</span> mark Weapon Set I / II passives. The visual
              tree map above mirrors this diff.
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
