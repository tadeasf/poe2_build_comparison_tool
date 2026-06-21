import { describe, it, expect } from "vitest";
import pako from "pako";
import { decodePobCode } from "../decode";
import { parsePobXml } from "../parse";

function encode(xml: string): string {
  return Buffer.from(pako.deflate(xml)).toString("base64");
}

const SAMPLE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<PathOfBuilding>
  <Build level="92" className="Warrior" ascendClassName="Warbringer" mainSocketGroup="1"/>
  <Tree activeSpec="1">
    <Spec treeVersion="0_2" classId="1" ascendClassId="1" nodes="0,1234,5678,9012">
      <URL>https://www.pathofexile.com/passive-skill-tree/AAAA</URL>
      <Sockets><Socket nodeId="1234" itemId="3"/></Sockets>
    </Spec>
  </Tree>
  <Skills activeSkillSet="1">
    <SkillSet id="1">
      <Skill mainActiveSkill="1" slot="Weapon 1" enabled="true">
        <Gem nameSpec="Boneshatter" skillId="Boneshatter" level="20" quality="20" enabled="true"/>
        <Gem nameSpec="Melee Physical Damage" skillId="SupportMeleePhysical" level="20" quality="0" enabled="true"/>
      </Skill>
    </SkillSet>
  </Skills>
  <Items activeItemSet="1">
    <Item id="1">
Rarity: RARE
Doom Brand
Expert Greathelm
Item Level: 82
Quality: 20
Implicits: 1
+50 to maximum Life
+120 to maximum Life
40% increased Armour
</Item>
    <ItemSet id="1">
      <Slot name="Helmet" itemId="1"/>
    </ItemSet>
  </Items>
</PathOfBuilding>`;

describe("PoB decode + parse roundtrip", () => {
  it("decodes a deflated base64 payload back to XML", () => {
    const xml = decodePobCode(encode(SAMPLE_XML));
    expect(xml).toContain("<PathOfBuilding>");
  });

  it("accepts URL-safe base64", () => {
    const urlSafe = encode(SAMPLE_XML).replace(/\+/g, "-").replace(/\//g, "_");
    expect(() => decodePobCode(urlSafe)).not.toThrow();
  });

  it("parses build metadata", () => {
    const build = parsePobXml(SAMPLE_XML);
    expect(build.className).toBe("Warrior");
    expect(build.ascendClassName).toBe("Warbringer");
    expect(build.level).toBe(92);
  });

  it("parses allocated tree nodes", () => {
    const build = parsePobXml(SAMPLE_XML);
    expect(build.tree.nodes).toEqual([0, 1234, 5678, 9012]);
    expect(build.tree.treeVersion).toBe("0_2");
    expect(build.tree.url).toContain("passive-skill-tree");
    expect(build.tree.sockets).toEqual([{ nodeId: 1234, itemId: 3 }]);
  });

  it("parses skill groups and flags supports", () => {
    const grp = parsePobXml(SAMPLE_XML).skills[0];
    expect(grp.slot).toBe("Weapon 1");
    expect(grp.gems.map((g) => g.nameSpec)).toEqual([
      "Boneshatter",
      "Melee Physical Damage",
    ]);
    expect(grp.gems[0].isSupport).toBe(false);
    expect(grp.gems[1].isSupport).toBe(true);
  });

  it("parses items, mods, and slot mapping", () => {
    const build = parsePobXml(SAMPLE_XML);
    const item = build.items[0];
    expect(item.rarity).toBe("RARE");
    expect(item.name).toBe("Doom Brand");
    expect(item.base).toBe("Expert Greathelm");
    expect(item.itemLevel).toBe(82);
    expect(item.quality).toBe(20);
    expect(item.implicits).toEqual(["+50 to maximum Life"]);
    expect(item.affixes).toEqual([
      "+120 to maximum Life",
      "40% increased Armour",
    ]);
    expect(build.slots).toEqual([{ name: "Helmet", itemId: 1 }]);
  });
});
