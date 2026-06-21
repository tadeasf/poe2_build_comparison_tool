// Result model for comparing a source build against a target build.
// Designed to power BOTH the categorized view and the ordered action checklist.

export interface AscendancyDiff {
  source: string;
  target: string;
  /** Builds must share an ascendancy for the comparison to be meaningful. */
  match: boolean;
}

export interface TreeNodeRef {
  id: number;
  /** Resolved name once the GGG tree data is wired (task: tree renderer). */
  name?: string;
  isNotable?: boolean;
  isAscendancy?: boolean;
}

export interface TreeDiff {
  /** In target but not source — the player must allocate these. */
  toAllocate: TreeNodeRef[];
  /** In source but not target — the player must refund these. */
  toRefund: TreeNodeRef[];
  sourceCount: number;
  targetCount: number;
  /** targetCount - sourceCount (net passive points spent). */
  netChange: number;
}

export interface GemChange {
  name: string;
  from: string;
  to: string;
}

export interface GemGroupRef {
  /** Active skill name that anchors the group. */
  skill: string;
  slot?: string;
  gems: string[];
}

export interface GemGroupChange {
  skill: string;
  slot?: string;
  addedGems: string[];
  removedGems: string[];
  changed: GemChange[];
}

export interface GemsDiff {
  addedGroups: GemGroupRef[];
  removedGroups: GemGroupRef[];
  changedGroups: GemGroupChange[];
}

export interface ItemRef {
  name?: string;
  base?: string;
  rarity?: string;
}

export interface ModDiff {
  added: string[];
  removed: string[];
}

export type ItemSlotStatus = "added" | "removed" | "changed";

export interface ItemSlotDiff {
  slot: string;
  status: ItemSlotStatus;
  source?: ItemRef;
  target?: ItemRef;
  /** Mod-level affix diff, present when status === "changed". */
  mods?: ModDiff;
}

export interface ItemsDiff {
  /** Slots that differ (unchanged slots are omitted). */
  slots: ItemSlotDiff[];
}

export type ChecklistCategory =
  | "ascendancy"
  | "tree"
  | "equipment"
  | "gems";

export interface ChecklistItem {
  id: string;
  category: ChecklistCategory;
  action: string;
  detail?: string;
}

export interface ComparisonResult {
  /** True only when ascendancies match. */
  compatible: boolean;
  ascendancy: AscendancyDiff;
  tree: TreeDiff;
  gems: GemsDiff;
  items: ItemsDiff;
  checklist: ChecklistItem[];
  meta: {
    sourceName: string;
    targetName: string;
    sourceLevel: number;
    targetLevel: number;
  };
}
