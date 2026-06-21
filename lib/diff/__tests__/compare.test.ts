import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parsePobCode } from "../../pob/parse";
import type { PobBuild } from "../../pob/types";
import { compareBuilds } from "../index";

const dir = dirname(fileURLToPath(import.meta.url));
const code = readFileSync(
  join(dir, "..", "..", "pob", "__fixtures__", "poe2-sample.code.txt"),
  "utf8",
);

describe("compareBuilds", () => {
  let source: PobBuild;
  let target: PobBuild;

  beforeAll(() => {
    source = parsePobCode(code);
    target = structuredClone(source);

    // Tree: refund last 5 nodes, allocate 3 brand-new ones.
    target.tree.nodes = source.tree.nodes.slice(0, -5).concat([999001, 999002, 999003]);

    // Gems: bump the first group's active gem level; drop a support from another.
    target.skills[0].gems[0].level = (source.skills[0].gems[0].level ?? 0) + 1;
    target.skills[2].gems.pop();

    // Equipment: change the Helmet (rename + add a mod).
    const helmetSlot = target.slots.find((s) => s.name === "Helmet")!;
    const helmet = target.items.find((i) => i.id === helmetSlot.itemId)!;
    helmet.name = "Brand New Helm";
    helmet.affixes = [...(helmet.affixes ?? []), "100% increased Armour"];
  });

  it("reports compatible when ascendancies match", () => {
    const r = compareBuilds(source, target);
    expect(r.compatible).toBe(true);
    expect(r.ascendancy.match).toBe(true);
  });

  it("computes tree allocate/refund sets", () => {
    const r = compareBuilds(source, target);
    expect(r.tree.toRefund).toHaveLength(5);
    expect(r.tree.toAllocate.map((n) => n.id)).toEqual([999001, 999002, 999003]);
    expect(r.tree.netChange).toBe(-2);
  });

  it("detects gem level changes and removed supports", () => {
    const r = compareBuilds(source, target);
    const skill0 = groupSkillName(source.skills[0]);
    const changed = r.gems.changedGroups.find((g) => g.skill === skill0);
    expect(changed).toBeDefined();
    expect(changed!.changed.length).toBeGreaterThan(0);

    const skill2 = groupSkillName(source.skills[2]);
    const changed2 = r.gems.changedGroups.find((g) => g.skill === skill2);
    expect(changed2?.removedGems.length).toBeGreaterThan(0);
  });

  it("diffs equipment at the mod level", () => {
    const r = compareBuilds(source, target);
    const helmet = r.items.slots.find((s) => s.slot === "Helmet");
    expect(helmet?.status).toBe("changed");
    expect(helmet?.target?.name).toBe("Brand New Helm");
    expect(helmet?.mods?.added).toContain("100% increased Armour");
  });

  it("produces an ordered checklist (tree first, then gear, then gems)", () => {
    const r = compareBuilds(source, target);
    expect(r.checklist.length).toBeGreaterThan(0);
    const categories = r.checklist.map((c) => c.category);
    expect(categories[0]).toBe("tree");
    // equipment appears before gems
    const firstEquip = categories.indexOf("equipment");
    const firstGem = categories.indexOf("gems");
    expect(firstEquip).toBeGreaterThanOrEqual(0);
    expect(firstGem).toBeGreaterThan(firstEquip);
  });

  it("flags incompatible builds with different ascendancies", () => {
    const other = structuredClone(source);
    other.ascendClassName = "Gemling Legionnaire";
    const r = compareBuilds(source, other);
    expect(r.compatible).toBe(false);
    expect(r.checklist.some((c) => c.category === "ascendancy")).toBe(true);
  });
});

// Mirror of the internal groupSkill heuristic for assertion convenience.
function groupSkillName(g: PobBuild["skills"][number]): string {
  const active = g.gems.find((x) => !x.isSupport);
  return active?.nameSpec ?? g.label ?? g.gems[0]?.nameSpec ?? "Unknown";
}
