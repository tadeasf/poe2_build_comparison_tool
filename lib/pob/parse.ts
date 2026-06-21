import { XMLParser } from "fast-xml-parser";
import { decodePobCode, PobDecodeError } from "./decode";
import { parseItemText } from "./item-text";
import type {
  PobBuild,
  PobGem,
  PobItem,
  PobItemSlot,
  PobSkillGroup,
  PobTreeSpec,
} from "./types";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  parseAttributeValue: true,
  textNodeName: "#text",
  trimValues: false, // keep <Item> text blocks intact
});

/* eslint-disable @typescript-eslint/no-explicit-any */

function asArray<T>(v: T | T[] | undefined | null): T[] {
  if (v === undefined || v === null) return [];
  return Array.isArray(v) ? v : [v];
}

function toBool(v: unknown, dflt = false): boolean {
  if (typeof v === "boolean") return v;
  if (typeof v === "string") return v.toLowerCase() === "true";
  if (typeof v === "number") return v !== 0;
  return dflt;
}

function toNum(v: unknown): number | undefined {
  if (typeof v === "number") return Number.isFinite(v) ? v : undefined;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isNaN(n) ? undefined : n;
  }
  return undefined;
}

function toStr(v: unknown): string | undefined {
  if (v === undefined || v === null) return undefined;
  return String(v);
}

/** Read the text content of an element that fast-xml-parser may give us as a
 * string, a number, or an object carrying a "#text" node. */
function textOf(node: any): string | undefined {
  if (node === undefined || node === null) return undefined;
  if (typeof node === "object") {
    if ("#text" in node) return String(node["#text"]);
    return undefined;
  }
  return String(node);
}

/** Parse a comma-separated PoB node-id list (e.g. "58814,244,9745") to numbers. */
function idList(raw: unknown): number[] {
  return String(raw ?? "")
    .split(",")
    .map((s) => parseInt(s, 10))
    .filter((n) => Number.isFinite(n));
}

function parseSpec(specEl: any): PobTreeSpec {
  const nodes = idList(specEl["@_nodes"]);

  // PoB2 records weapon-set-specific passives as <WeaponSet1>/<WeaponSet2>
  // children of <Spec>, each a comma-separated subset of `nodes`.
  const weaponSet1Nodes = idList(asArray(specEl?.WeaponSet1)[0]?.["@_nodes"]);
  const weaponSet2Nodes = idList(asArray(specEl?.WeaponSet2)[0]?.["@_nodes"]);

  const sockets = asArray(specEl?.Sockets?.Socket).map((s: any) => ({
    nodeId: toNum(s["@_nodeId"]) ?? 0,
    itemId: toNum(s["@_itemId"]) ?? 0,
  }));

  return {
    treeVersion: toStr(specEl["@_treeVersion"]),
    classId: toNum(specEl["@_classId"]),
    ascendClassId: toNum(specEl["@_ascendClassId"]),
    nodes,
    weaponSet1Nodes,
    weaponSet2Nodes,
    sockets,
    url: textOf(specEl?.URL)?.trim() || undefined,
  };
}

function parseItems(itemsEl: any): { items: PobItem[]; slots: PobItemSlot[] } {
  if (!itemsEl) return { items: [], slots: [] };

  const items = asArray(itemsEl.Item).map((it: any): PobItem => {
    const id = toNum(it["@_id"]) ?? 0;
    const text = (textOf(it) ?? "").trim();
    return { id, text, ...parseItemText(text) };
  });

  const itemSets = asArray(itemsEl.ItemSet);
  const activeId = toNum(itemsEl["@_activeItemSet"]);
  const activeSet =
    itemSets.find((s: any) => toNum(s["@_id"]) === activeId) ?? itemSets[0];

  const slots = activeSet
    ? asArray(activeSet.Slot)
        .map((sl: any): PobItemSlot => ({
          name: toStr(sl["@_name"]) ?? "",
          itemId: toNum(sl["@_itemId"]) ?? 0,
        }))
        .filter((s) => s.itemId > 0)
    : [];

  return { items, slots };
}

function parseGem(g: any): PobGem {
  const skillId = toStr(g["@_skillId"]);
  const gemId = toStr(g["@_gemId"]);
  const nameSpec = toStr(g["@_nameSpec"]);
  // Heuristic support detection; refined once validated against a real export.
  const isSupport =
    toBool(g["@_isSupport"], false) ||
    /support/i.test(skillId ?? "") ||
    /support/i.test(gemId ?? "");

  return {
    nameSpec,
    skillId,
    gemId,
    level: toNum(g["@_level"]),
    quality: toNum(g["@_quality"]),
    enabled: toBool(g["@_enabled"], true),
    isSupport,
  };
}

function parseSkills(skillsEl: any): PobSkillGroup[] {
  if (!skillsEl) return [];

  const skillSets = asArray(skillsEl.SkillSet);
  let skillEls: any[];
  if (skillSets.length > 0) {
    const activeId = toNum(skillsEl["@_activeSkillSet"]);
    const activeSet =
      skillSets.find((s: any) => toNum(s["@_id"]) === activeId) ?? skillSets[0];
    skillEls = asArray(activeSet?.Skill);
  } else {
    skillEls = asArray(skillsEl.Skill);
  }

  return skillEls.map((sk: any): PobSkillGroup => ({
    label: toStr(sk["@_label"]) || undefined,
    slot: toStr(sk["@_slot"]) || undefined,
    enabled: toBool(sk["@_enabled"], true),
    mainActiveSkill: toNum(sk["@_mainActiveSkill"]),
    gems: asArray(sk.Gem).map(parseGem),
  }));
}

export function parsePobXml(xml: string): PobBuild {
  const doc = parser.parse(xml);
  // PoB2 uses <PathOfBuilding2>; PoB1 used <PathOfBuilding>. Accept both.
  const root = doc.PathOfBuilding2 ?? doc.PathOfBuilding ?? doc;
  if (!root || typeof root !== "object" || !root.Build) {
    throw new PobDecodeError(
      "Decoded XML is missing a <PathOfBuilding2> root. Is this a Path of Building 2 export?",
    );
  }

  const buildEl = root.Build ?? {};
  const treeEl = root.Tree ?? {};

  const specs = asArray(treeEl.Spec).map(parseSpec);
  const activeIdx = (toNum(treeEl["@_activeSpec"]) ?? 1) - 1;
  const tree =
    specs[activeIdx] ?? specs[0] ?? { nodes: [], sockets: [] };

  const { items, slots } = parseItems(root.Items);

  return {
    level: toNum(buildEl["@_level"]) ?? 1,
    className: toStr(buildEl["@_className"]) ?? "Unknown",
    ascendClassName: toStr(buildEl["@_ascendClassName"]) ?? "None",
    mainSocketGroup: toNum(buildEl["@_mainSocketGroup"]),
    tree,
    treeSpecs: specs,
    items,
    slots,
    skills: parseSkills(root.Skills),
    notes: textOf(root.Notes)?.trim() || undefined,
    raw: { xml },
  };
}

export function parsePobCode(code: string): PobBuild {
  return parsePobXml(decodePobCode(code));
}
