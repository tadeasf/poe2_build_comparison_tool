import type { PobItem } from "./types";

export type ParsedItemText = Pick<
  PobItem,
  "rarity" | "name" | "base" | "itemLevel" | "quality" | "sockets" | "implicits" | "affixes"
>;

/**
 * Metadata key lines in a PoB item block that are NOT mods and should be
 * skipped. Anything with a "Key:" shape not listed here is treated as a mod
 * (some real mods read like "Grants Skill: ..."), so this list stays
 * conservative.
 */
const META_KEYS = new Set([
  "Unique ID",
  "Item Level",
  "Quality",
  "Sockets",
  "LevelReq",
  "Requires Level",
  "Requires",
  "Selected Variant",
  "Variant",
  "Has Variant",
  "Has Alt Variant",
  "Limited to",
  "League",
  "Source",
  "Implicits",
  "Prefix",
  "Suffix",
  "Catalyst",
  "CatalystQuality",
  "Talisman Tier",
  "Crucible",
  "Rune",
  "Armour",
  "Evasion",
  "Energy Shield",
  "Ward",
]);

/**
 * Strip PoB's inline markup tokens so a mod line reads like the in-game text.
 * PoB2 wraps mods with markers such as {desecrated}, {crafted}, {fractured},
 * {range:0.5}, {variant:1,2}, {tags:...}. We strip every {...} token rather
 * than enumerate them, since the set keeps growing across leagues.
 */
export function cleanModLine(line: string): string {
  return line.replace(/\{[^}]*\}/g, "").trim();
}

/**
 * Parse a single PoB item text block (the raw text inside an <Item> element)
 * into structured fields. Tolerant by design: PoE2 item metadata differs from
 * PoE1, so unknown "Key: value" lines that aren't recognized metadata are
 * treated as mods rather than dropped.
 */
export function parseItemText(raw: string): ParsedItemText {
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const result: ParsedItemText = { implicits: [], affixes: [] };
  if (lines.length === 0) return result;

  let i = 0;

  const rarityMatch = lines[i]?.match(/^Rarity:\s*(.+)$/i);
  if (rarityMatch) {
    result.rarity = rarityMatch[1].trim().toUpperCase();
    i++;
  }

  const rarity = result.rarity ?? "NORMAL";
  if (rarity === "RARE" || rarity === "UNIQUE") {
    result.name = lines[i++];
    result.base = lines[i++];
  } else {
    result.base = lines[i++];
    result.name = result.base;
  }

  let implicitsRemaining = 0;
  let collectingImplicits = false;

  for (; i < lines.length; i++) {
    const line = lines[i];
    const kv = line.match(/^([A-Za-z][A-Za-z ]*?):\s*(.*)$/);
    if (kv) {
      const key = kv[1].trim();
      const val = kv[2].trim();

      if (key === "Item Level") {
        result.itemLevel = parseInt(val, 10) || undefined;
        continue;
      }
      if (key === "Quality") {
        result.quality = parseInt(val.replace(/[+%]/g, ""), 10) || undefined;
        continue;
      }
      if (key === "Sockets") {
        result.sockets = val;
        continue;
      }
      if (key === "Implicits") {
        implicitsRemaining = parseInt(val, 10) || 0;
        collectingImplicits = implicitsRemaining > 0;
        continue;
      }
      if (META_KEYS.has(key)) continue;
    }

    const cleaned = cleanModLine(line);
    if (!cleaned) continue;

    if (collectingImplicits && implicitsRemaining > 0) {
      result.implicits!.push(cleaned);
      implicitsRemaining--;
      if (implicitsRemaining === 0) collectingImplicits = false;
    } else {
      result.affixes!.push(cleaned);
    }
  }

  return result;
}
