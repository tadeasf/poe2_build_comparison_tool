import type { PobBuild, PobItem, PobSkillGroup, PobTreeSpec } from "../pob/types";
import { resolveNode } from "../tree/nodes";
import type {
  AscendancyDiff,
  ChecklistItem,
  ComparisonResult,
  GemsDiff,
  GemGroupRef,
  GemGroupChange,
  ItemsDiff,
  ItemRef,
  ItemSlotDiff,
  ModDiff,
  TreeDiff,
  TreeNodeRef,
  WeaponSet,
} from "./types";

export * from "./types";

/* -------------------------------------------------------------------------- */
/* Ascendancy                                                                 */
/* -------------------------------------------------------------------------- */

export function ascendancyDiff(source: PobBuild, target: PobBuild): AscendancyDiff {
  return {
    source: source.ascendClassName,
    target: target.ascendClassName,
    match: source.ascendClassName === target.ascendClassName,
  };
}

/* -------------------------------------------------------------------------- */
/* Passive tree                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Build a node-id -> weapon-set classifier for a tree spec. Nodes in neither
 * weapon-set list are "common". Builds parsed before weapon-set support have no
 * arrays, so everything classifies as "common" (preserves prior behavior).
 */
function weaponSetOf(spec: PobTreeSpec): (id: number) => WeaponSet {
  const w1 = new Set(spec.weaponSet1Nodes ?? []);
  const w2 = new Set(spec.weaponSet2Nodes ?? []);
  return (id) => (w1.has(id) ? "set1" : w2.has(id) ? "set2" : "common");
}

export function treeDiff(source: PobBuild, target: PobBuild): TreeDiff {
  const s = new Set(source.tree.nodes);
  const t = new Set(target.tree.nodes);
  const srcSetOf = weaponSetOf(source.tree);
  const tgtSetOf = weaponSetOf(target.tree);

  const ref = (id: number, set: WeaponSet): TreeNodeRef => {
    const info = resolveNode(id);
    return {
      id,
      name: info?.name,
      isNotable: info?.notable || info?.keystone || false,
      isAscendancy: info?.ascendancy != null,
      set,
    };
  };

  const toAllocate = [...t].filter((n) => !s.has(n)).map((n) => ref(n, tgtSetOf(n)));
  const toRefund = [...s].filter((n) => !t.has(n)).map((n) => ref(n, srcSetOf(n)));

  // Nodes allocated in both builds whose weapon-set assignment changed.
  const movedBetweenSets: TreeNodeRef[] = [];
  for (const id of s) {
    if (!t.has(id)) continue;
    const from = srcSetOf(id);
    const to = tgtSetOf(id);
    if (from === to) continue;
    const r = ref(id, to);
    movedBetweenSets.push({ ...r, movedSet: true, fromSet: from, toSet: to });
  }

  return {
    toAllocate,
    toRefund,
    movedBetweenSets,
    sourceCount: s.size,
    targetCount: t.size,
    netChange: t.size - s.size,
  };
}

/** Human label for a weapon set, used in the checklist + UI badges. */
export function weaponSetLabel(set: WeaponSet): string {
  return set === "set1" ? "Weapon Set I" : set === "set2" ? "Weapon Set II" : "Common";
}

/* -------------------------------------------------------------------------- */
/* Skill gems                                                                 */
/* -------------------------------------------------------------------------- */

/** Anchor a skill group on its first active (non-support) gem. */
function groupSkill(g: PobSkillGroup): string {
  const active = g.gems.find((x) => !x.isSupport);
  return active?.nameSpec ?? g.label ?? g.gems[0]?.nameSpec ?? "Unknown";
}

function gemNames(g: PobSkillGroup): string[] {
  return g.gems.map((x) => x.nameSpec ?? x.skillId ?? "?");
}

function gemLabel(level?: number, quality?: number): string {
  return `Lv${level ?? "?"}${quality ? ` / ${quality}% q` : ""}`;
}

function indexByKey(groups: PobSkillGroup[]): Map<string, PobSkillGroup[]> {
  const map = new Map<string, PobSkillGroup[]>();
  for (const g of groups) {
    const key = groupSkill(g);
    (map.get(key) ?? map.set(key, []).get(key)!).push(g);
  }
  return map;
}

export function gemsDiff(source: PobBuild, target: PobBuild): GemsDiff {
  const srcByKey = indexByKey(source.skills);
  const tgtByKey = indexByKey(target.skills);
  const keys = new Set([...srcByKey.keys(), ...tgtByKey.keys()]);

  const addedGroups: GemGroupRef[] = [];
  const removedGroups: GemGroupRef[] = [];
  const changedGroups: GemGroupChange[] = [];

  for (const key of keys) {
    const srcGroups = srcByKey.get(key) ?? [];
    const tgtGroups = tgtByKey.get(key) ?? [];
    const paired = Math.min(srcGroups.length, tgtGroups.length);

    for (let i = 0; i < paired; i++) {
      const s = srcGroups[i];
      const t = tgtGroups[i];
      const sNames = new Set(gemNames(s));
      const tNames = new Set(gemNames(t));
      const addedGems = [...tNames].filter((n) => !sNames.has(n));
      const removedGems = [...sNames].filter((n) => !tNames.has(n));

      const changed: GemGroupChange["changed"] = [];
      for (const sg of s.gems) {
        const tg = t.gems.find((x) => x.nameSpec === sg.nameSpec);
        if (!tg) continue;
        if (sg.level !== tg.level || sg.quality !== tg.quality) {
          changed.push({
            name: sg.nameSpec ?? "?",
            from: gemLabel(sg.level, sg.quality),
            to: gemLabel(tg.level, tg.quality),
          });
        }
      }

      if (addedGems.length || removedGems.length || changed.length) {
        changedGroups.push({ skill: key, slot: t.slot ?? s.slot, addedGems, removedGems, changed });
      }
    }

    for (let i = paired; i < tgtGroups.length; i++) {
      addedGroups.push({ skill: key, slot: tgtGroups[i].slot, gems: gemNames(tgtGroups[i]) });
    }
    for (let i = paired; i < srcGroups.length; i++) {
      removedGroups.push({ skill: key, slot: srcGroups[i].slot, gems: gemNames(srcGroups[i]) });
    }
  }

  return { addedGroups, removedGroups, changedGroups };
}

/* -------------------------------------------------------------------------- */
/* Equipment                                                                  */
/* -------------------------------------------------------------------------- */

function slotItems(build: PobBuild): Map<string, PobItem> {
  const byId = new Map(build.items.map((it) => [it.id, it]));
  const map = new Map<string, PobItem>();
  for (const slot of build.slots) {
    const item = byId.get(slot.itemId);
    if (item) map.set(slot.name, item);
  }
  return map;
}

function itemRef(it: PobItem): ItemRef {
  return { name: it.name, base: it.base, rarity: it.rarity };
}

const norm = (s: string) => s.replace(/\s+/g, " ").trim();

function itemMods(it: PobItem): string[] {
  return [...(it.implicits ?? []), ...(it.affixes ?? [])].map(norm);
}

function multisetDiff(source: string[], target: string[]): ModDiff {
  const count = (xs: string[]) => {
    const m = new Map<string, number>();
    for (const x of xs) m.set(x, (m.get(x) ?? 0) + 1);
    return m;
  };
  const s = count(source);
  const t = count(target);
  const added: string[] = [];
  const removed: string[] = [];
  for (const k of new Set([...s.keys(), ...t.keys()])) {
    const d = (t.get(k) ?? 0) - (s.get(k) ?? 0);
    for (let i = 0; i < d; i++) added.push(k);
    for (let i = 0; i < -d; i++) removed.push(k);
  }
  return { added, removed };
}

function sameItem(a: PobItem, b: PobItem): boolean {
  if (a.name !== b.name || a.base !== b.base) return false;
  const am = itemMods(a).slice().sort();
  const bm = itemMods(b).slice().sort();
  return am.length === bm.length && am.every((m, i) => m === bm[i]);
}

export function itemsDiff(source: PobBuild, target: PobBuild): ItemsDiff {
  const s = slotItems(source);
  const t = slotItems(target);
  const slots: ItemSlotDiff[] = [];

  for (const slot of new Set([...s.keys(), ...t.keys()])) {
    const si = s.get(slot);
    const ti = t.get(slot);

    if (si && !ti) {
      slots.push({ slot, status: "removed", source: itemRef(si) });
    } else if (!si && ti) {
      slots.push({ slot, status: "added", target: itemRef(ti) });
    } else if (si && ti && !sameItem(si, ti)) {
      slots.push({
        slot,
        status: "changed",
        source: itemRef(si),
        target: itemRef(ti),
        mods: multisetDiff(itemMods(si), itemMods(ti)),
      });
    }
  }

  // Stable, readable ordering.
  slots.sort((a, b) => a.slot.localeCompare(b.slot));
  return { slots };
}

/* -------------------------------------------------------------------------- */
/* Checklist (ordered, actionable)                                            */
/* -------------------------------------------------------------------------- */

function itemLabel(ref?: ItemRef): string {
  if (!ref) return "item";
  if (ref.name && ref.name !== ref.base) return `${ref.name} (${ref.base})`;
  return ref.base ?? ref.name ?? "item";
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

function buildChecklist(
  ascendancy: AscendancyDiff,
  tree: TreeDiff,
  gems: GemsDiff,
  items: ItemsDiff,
): ChecklistItem[] {
  const list: ChecklistItem[] = [];

  // 1. Refund, 2. Allocate
  const notableNames = (refs: TreeNodeRef[]) =>
    refs.filter((n) => n.isNotable && n.name).map((n) => n.name as string);
  const summarize = (names: string[]) =>
    `${names.slice(0, 6).join(", ")}${names.length > 6 ? `, +${names.length - 6} more` : ""}`;

  if (tree.toRefund.length) {
    const names = notableNames(tree.toRefund);
    list.push({
      id: "tree-refund",
      category: "tree",
      action: `Refund ${tree.toRefund.length} passive ${tree.toRefund.length === 1 ? "point" : "points"}`,
      detail: names.length ? `Notables: ${summarize(names)}` : undefined,
    });
  }
  if (tree.toAllocate.length) {
    const names = notableNames(tree.toAllocate);
    list.push({
      id: "tree-allocate",
      category: "tree",
      action: `Allocate ${tree.toAllocate.length} passive ${tree.toAllocate.length === 1 ? "point" : "points"}`,
      detail: names.length
        ? `Notables: ${summarize(names)}`
        : `Net ${tree.netChange >= 0 ? "+" : ""}${tree.netChange} points`,
    });
  }
  if (tree.movedBetweenSets.length) {
    const moves = tree.movedBetweenSets
      .map((n) => `${n.name ?? `Node ${n.id}`} (${weaponSetLabel(n.fromSet ?? "common")} → ${weaponSetLabel(n.toSet ?? "common")})`)
      .slice(0, 6);
    list.push({
      id: "tree-moved-sets",
      category: "tree",
      action: `Reassign ${tree.movedBetweenSets.length} ${tree.movedBetweenSets.length === 1 ? "passive" : "passives"} between weapon sets`,
      detail: moves.join(", ") + (tree.movedBetweenSets.length > 6 ? `, +${tree.movedBetweenSets.length - 6} more` : ""),
    });
  }

  // 3. Ascendancy
  if (!ascendancy.match) {
    list.push({
      id: "ascendancy",
      category: "ascendancy",
      action: `Ascendancy mismatch: yours is ${ascendancy.source}, target is ${ascendancy.target}`,
      detail: "These builds are not directly compatible.",
    });
  }

  // 4. Equipment
  for (const s of items.slots) {
    if (s.status === "changed") {
      list.push({
        id: `equip-${slug(s.slot)}`,
        category: "equipment",
        action: `${s.slot}: replace ${itemLabel(s.source)} → ${itemLabel(s.target)}`,
        detail: `+${s.mods?.added.length ?? 0} / -${s.mods?.removed.length ?? 0} mods`,
      });
    } else if (s.status === "added") {
      list.push({
        id: `equip-${slug(s.slot)}`,
        category: "equipment",
        action: `${s.slot}: equip ${itemLabel(s.target)}`,
      });
    } else {
      list.push({
        id: `equip-${slug(s.slot)}`,
        category: "equipment",
        action: `${s.slot}: remove ${itemLabel(s.source)}`,
      });
    }
  }

  // 5. Gems
  for (const g of gems.addedGroups) {
    list.push({
      id: `gem-add-${slug(g.skill)}`,
      category: "gems",
      action: `Add skill ${g.skill}`,
      detail: g.gems.join(", "),
    });
  }
  for (const g of gems.removedGroups) {
    list.push({
      id: `gem-remove-${slug(g.skill)}`,
      category: "gems",
      action: `Remove skill ${g.skill}`,
    });
  }
  for (const g of gems.changedGroups) {
    const parts: string[] = [];
    if (g.addedGems.length) parts.push(`add ${g.addedGems.join(", ")}`);
    if (g.removedGems.length) parts.push(`remove ${g.removedGems.join(", ")}`);
    if (g.changed.length) parts.push(g.changed.map((c) => `${c.name} ${c.from}→${c.to}`).join(", "));
    list.push({
      id: `gem-change-${slug(g.skill)}`,
      category: "gems",
      action: `Update ${g.skill}`,
      detail: parts.join("; "),
    });
  }

  return list;
}

/* -------------------------------------------------------------------------- */
/* Orchestrator                                                               */
/* -------------------------------------------------------------------------- */

export function compareBuilds(source: PobBuild, target: PobBuild): ComparisonResult {
  const ascendancy = ascendancyDiff(source, target);
  const tree = treeDiff(source, target);
  const gems = gemsDiff(source, target);
  const items = itemsDiff(source, target);
  const checklist = buildChecklist(ascendancy, tree, gems, items);

  return {
    compatible: ascendancy.match,
    ascendancy,
    tree,
    gems,
    items,
    checklist,
    meta: {
      sourceName: source.className,
      targetName: target.className,
      sourceLevel: source.level,
      targetLevel: target.level,
    },
  };
}
