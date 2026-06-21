import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parsePobCode } from "../parse";

// Locks the parser against a real Path of Building 2 export (a Mercenary /
// Witchhunter build). If PoB2 changes its export schema, this is the canary.
const dir = dirname(fileURLToPath(import.meta.url));
const code = readFileSync(
  join(dir, "..", "__fixtures__", "poe2-sample.code.txt"),
  "utf8",
);

describe("real PoB2 export", () => {
  const build = parsePobCode(code);

  it("parses class, ascendancy, and level", () => {
    expect(build.className).toBe("Mercenary");
    expect(build.ascendClassName).toBe("Witchhunter");
    expect(build.level).toBe(93);
  });

  it("parses the passive tree", () => {
    expect(build.tree.treeVersion).toBe("0_5");
    expect(build.tree.nodes.length).toBe(142);
    expect(build.tree.classId).toBe(9);
    expect(build.tree.ascendClassId).toBe(2);
    // every node id is a finite number
    expect(build.tree.nodes.every((n) => Number.isFinite(n))).toBe(true);
    // jewel sockets captured
    expect(build.tree.sockets.length).toBeGreaterThan(0);
  });

  it("maps equipped item slots", () => {
    const slotNames = build.slots.map((s) => s.name);
    expect(slotNames).toEqual(
      expect.arrayContaining([
        "Weapon 1",
        "Helmet",
        "Body Armour",
        "Gloves",
        "Boots",
        "Amulet",
        "Ring 1",
        "Ring 2",
      ]),
    );
    // empty slots (itemId 0) are excluded
    expect(build.slots.every((s) => s.itemId > 0)).toBe(true);
  });

  it("parses skill groups and flags supports vs actives", () => {
    expect(build.skills.length).toBe(12);
    const allGems = build.skills.flatMap((g) => g.gems);
    const sorceryWard = allGems.find((g) => g.nameSpec === "Sorcery Ward");
    const coldMastery = allGems.find((g) => g.nameSpec === "Cold Mastery");
    expect(sorceryWard?.isSupport).toBe(false);
    expect(coldMastery?.isSupport).toBe(true);
  });

  it("parses a unique item with clean mod text", () => {
    const item = build.items.find((i) => i.name === "Heart of the Well");
    expect(item).toBeDefined();
    expect(item!.rarity).toBe("UNIQUE");
    expect(item!.base).toBe("Diamond");
    expect(item!.affixes).toContain(
      "Gain 12% of Damage as Extra Lightning Damage",
    );
  });

  it("strips all markup and XML artifacts from every parsed mod", () => {
    for (const item of build.items) {
      for (const mod of [...(item.implicits ?? []), ...(item.affixes ?? [])]) {
        expect(mod).not.toMatch(/[{}<>]/);
      }
    }
  });
});
