#!/usr/bin/env tsx
/**
 * Vendors the official GGG Path of Exile 2 passive tree export and distills it
 * into a compact node-id -> name map used to label tree diffs.
 *
 * Source: https://github.com/grindinggear/poe2-skilltree-export (data.json, ~5MB)
 * Output: data/tree-nodes.json  (committed; small)
 *         data/.cache/poe2-tree.json (raw cache; gitignored)
 *
 * Usage: pnpm tsx scripts/fetch-data.ts
 *
 * GGG game data is © Grinding Gear Games and used here for a non-commercial fan
 * tool. See README.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const CACHE_DIR = join(ROOT, "data", ".cache");
const CACHE_FILE = join(CACHE_DIR, "poe2-tree.json");
const OUT_FILE = join(ROOT, "data", "tree-nodes.json");

const SOURCE_URL =
  "https://raw.githubusercontent.com/grindinggear/poe2-skilltree-export/main/data.json";

// A few real node ids from our PoB2 fixture, used to validate the mapping.
const SAMPLE_IDS = [58814, 9745, 60735, 46882, 2491];

interface TreeNode {
  skill?: number;
  name?: string;
  isNotable?: boolean;
  isKeystone?: boolean;
  isMastery?: boolean;
  isJewelSocket?: boolean;
  ascendancyName?: string;
}

interface CompactNode {
  name: string;
  notable?: true;
  keystone?: true;
  mastery?: true;
  ascendancy?: string;
}

async function loadRaw(): Promise<string> {
  if (existsSync(CACHE_FILE)) {
    console.log("Using cached tree data:", CACHE_FILE);
    return readFileSync(CACHE_FILE, "utf8");
  }
  console.log("Downloading tree data from", SOURCE_URL);
  const res = await fetch(SOURCE_URL);
  if (!res.ok) throw new Error(`Download failed: ${res.status} ${res.statusText}`);
  const text = await res.text();
  mkdirSync(CACHE_DIR, { recursive: true });
  writeFileSync(CACHE_FILE, text, "utf8");
  console.log(`Cached ${(text.length / 1e6).toFixed(1)} MB -> ${CACHE_FILE}`);
  return text;
}

async function main() {
  const raw = await loadRaw();
  const data = JSON.parse(raw);

  console.log("\nTop-level keys:", Object.keys(data).join(", "));
  const nodes: Record<string, TreeNode> = data.nodes ?? {};
  const nodeKeys = Object.keys(nodes);
  console.log("node count:", nodeKeys.length);

  // Show a sample node so we can eyeball the shape.
  const sampleKey = nodeKeys.find((k) => nodes[k]?.isNotable) ?? nodeKeys[1];
  console.log("sample node", sampleKey, "=>", JSON.stringify(nodes[sampleKey])?.slice(0, 240));

  const map: Record<string, CompactNode> = {};
  for (const node of Object.values(nodes)) {
    if (node.skill == null || !node.name) continue;
    const entry: CompactNode = { name: node.name };
    if (node.isNotable) entry.notable = true;
    if (node.isKeystone) entry.keystone = true;
    if (node.isMastery) entry.mastery = true;
    if (node.ascendancyName) entry.ascendancy = node.ascendancyName;
    map[String(node.skill)] = entry;
  }

  console.log("\nValidation against fixture node ids:");
  for (const id of SAMPLE_IDS) {
    const m = map[String(id)];
    console.log(`  ${id} ->`, m ? `${m.name}${m.notable ? " (notable)" : ""}` : "NOT FOUND");
  }

  const resolved = SAMPLE_IDS.filter((id) => map[String(id)]).length;
  if (resolved === 0) {
    throw new Error("None of the sample node ids resolved — schema mismatch, aborting.");
  }

  writeFileSync(OUT_FILE, JSON.stringify(map), "utf8");
  console.log(
    `\nWrote ${Object.keys(map).length} nodes -> ${OUT_FILE} (${(JSON.stringify(map).length / 1024).toFixed(0)} KB)`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
