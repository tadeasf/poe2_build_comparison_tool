#!/usr/bin/env tsx
/**
 * Vendors the official GGG Path of Exile 2 passive tree export and distills it
 * into a compact node-id -> name map used to label tree diffs.
 *
 * Source: https://github.com/grindinggear/poe2-skilltree-export (data.json, ~5MB)
 * Output: data/tree-nodes.json       (committed; small)
 *         public/tree-layout.json    (committed; render model + sprite manifest)
 *         public/tree-sprites/*.webp  (committed; node icon + frame atlases, ~800KB)
 *         data/.cache/* (raw caches; gitignored)
 *
 * Usage: pnpm tsx scripts/fetch-data.ts
 *
 * GGG game data AND art assets are © Grinding Gear Games, vendored here for a
 * non-commercial fan tool under the same terms as the tree data. See README.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const CACHE_DIR = join(ROOT, "data", ".cache");
const CACHE_FILE = join(CACHE_DIR, "poe2-tree.json");
const ASSET_CACHE_DIR = join(CACHE_DIR, "assets");
const OUT_FILE = join(ROOT, "data", "tree-nodes.json");
const LAYOUT_FILE = join(ROOT, "public", "tree-layout.json");
const SPRITE_DIR = join(ROOT, "public", "tree-sprites");

const REPO_BASE =
  "https://raw.githubusercontent.com/grindinggear/poe2-skilltree-export/main";
const SOURCE_URL = `${REPO_BASE}/data.json`;

/**
 * Sprite atlases vendored from the GGG repo's assets/ dir into public/tree-sprites/.
 * Each .webp is a TexturePacker sheet; its .json maps "<prefix>:<iconPath>" (skills)
 * or frame-type names (frame) -> {frame:{x,y,w,h}}. Load-bearing JSONs (skills.json,
 * frame.json) must exist or the build can't render icons; webp 404s are tolerated.
 */
const SPRITE_ASSETS = [
  "skills.json",
  "skills.webp",
  "skills-disabled.json",
  "skills-disabled.webp",
  "frame.json",
  "frame.webp",
];
const REQUIRED_ASSETS = new Set(["skills.json", "frame.json"]);

// A few real node ids from our PoB2 fixture, used to validate the mapping.
const SAMPLE_IDS = [58814, 9745, 60735, 46882, 2491];

interface TreeNode {
  skill?: number;
  name?: string;
  icon?: string;
  isNotable?: boolean;
  isKeystone?: boolean;
  isMastery?: boolean;
  isJewelSocket?: boolean;
  ascendancyName?: string;
  ascendancyId?: string;
  x?: number;
  y?: number;
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

/** Download (with cache) each sprite atlas into public/tree-sprites/. */
async function downloadSprites(): Promise<void> {
  mkdirSync(ASSET_CACHE_DIR, { recursive: true });
  mkdirSync(SPRITE_DIR, { recursive: true });
  console.log("\nVendoring sprite atlases -> public/tree-sprites/");
  let bytes = 0;
  for (const name of SPRITE_ASSETS) {
    const cachePath = join(ASSET_CACHE_DIR, name);
    let buf: Buffer;
    if (existsSync(cachePath)) {
      buf = readFileSync(cachePath);
    } else {
      const res = await fetch(`${REPO_BASE}/assets/${name}`);
      if (!res.ok) {
        const msg = `  ${name}: ${res.status} ${res.statusText}`;
        if (REQUIRED_ASSETS.has(name)) throw new Error(`Required asset failed:${msg}`);
        console.warn(`${msg} (optional, skipping)`);
        continue;
      }
      buf = Buffer.from(await res.arrayBuffer());
      writeFileSync(cachePath, buf);
    }
    writeFileSync(join(SPRITE_DIR, name), buf);
    bytes += buf.length;
    console.log(`  ${name}: ${(buf.length / 1024).toFixed(0)} KB`);
  }
  console.log(`  total: ${(bytes / 1024).toFixed(0)} KB`);
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

  // ---- Client render layout (coords + edges) ----
  // Per node: x, y, k (type), name, and `ic` = the GGG icon asset path, which is
  // the lookup key into the skills/skills-disabled atlases. Frame + the lit/dim
  // atlas prefix are derived client-side from `k`:
  //   n -> normalActive  /normalInactive   /frame PSSkillFrame[Active]
  //   N -> notableActive /notableInactive  /frame NotableFrame{Unallocated,Allocated}
  //   K -> keystoneActive/keystoneInactive /frame KeystoneFrame{Unallocated,Allocated}
  //   J -> (no icon) jewel frame;  M -> (no icon) distinct marker
  // The main tree goes in `nodes`/`edges`; each ascendancy is its own far-flung
  // cluster, bucketed into `ascendancies[ascId]` so the client can render the
  // build's ascendancy in a separate panel (ascId = className + ascendClassId).
  type LayoutNode = { x: number; y: number; k: string; name: string; ic?: string };
  type Acc = {
    nodes: Record<string, LayoutNode>;
    minX: number; minY: number; maxX: number; maxY: number;
  };
  const mkAcc = (): Acc => ({ nodes: {}, minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity });
  const kindOf = (node: TreeNode) =>
    node.isKeystone ? "K" : node.isNotable ? "N" : node.isMastery ? "M" : node.isJewelSocket ? "J" : "n";
  const grow = (a: Acc, x: number, y: number) => {
    a.minX = Math.min(a.minX, x); a.minY = Math.min(a.minY, y);
    a.maxX = Math.max(a.maxX, x); a.maxY = Math.max(a.maxY, y);
  };

  const main = mkAcc();
  const asc: Record<string, Acc> = {};
  const ascOf: Record<number, string> = {};
  for (const node of Object.values(nodes)) {
    if (node.skill == null || node.x == null || node.y == null) continue;
    const ln: LayoutNode = { x: node.x, y: node.y, k: kindOf(node), name: node.name ?? "" };
    if (node.icon) ln.ic = node.icon;
    if (node.ascendancyId) {
      const a = (asc[node.ascendancyId] ??= mkAcc());
      a.nodes[String(node.skill)] = ln;
      grow(a, node.x, node.y);
      ascOf[node.skill] = node.ascendancyId;
    } else {
      main.nodes[String(node.skill)] = ln;
      grow(main, node.x, node.y);
    }
  }

  const edges: [number, number][] = [];
  const ascEdges: Record<string, [number, number][]> = {};
  for (const e of (data.edges ?? []) as { from: unknown; to: unknown }[]) {
    const f = Number(e.from);
    const t = Number(e.to);
    if (!Number.isFinite(f) || !Number.isFinite(t)) continue; // skip "root" pseudo-node
    if (main.nodes[String(f)] && main.nodes[String(t)]) {
      edges.push([f, t]);
    } else if (ascOf[f] && ascOf[f] === ascOf[t]) {
      (ascEdges[ascOf[f]] ??= []).push([f, t]);
    }
  }

  const { minX, minY, maxX, maxY } = main;
  const layoutNodes = main.nodes;
  const ascendancies: Record<
    string,
    { bounds: { minX: number; minY: number; maxX: number; maxY: number }; nodes: Record<string, LayoutNode>; edges: [number, number][] }
  > = {};
  for (const [id, a] of Object.entries(asc)) {
    ascendancies[id] = {
      bounds: { minX: a.minX, minY: a.minY, maxX: a.maxX, maxY: a.maxY },
      nodes: a.nodes,
      edges: ascEdges[id] ?? [],
    };
  }

  // Sprite manifest: where the client loads the atlases + their coordinate maps.
  const sprites = {
    skills: { image: "/tree-sprites/skills.webp", json: "/tree-sprites/skills.json" },
    skillsDisabled: {
      image: "/tree-sprites/skills-disabled.webp",
      json: "/tree-sprites/skills-disabled.json",
    },
    frame: { image: "/tree-sprites/frame.webp", json: "/tree-sprites/frame.json" },
  };

  const layout = { bounds: { minX, minY, maxX, maxY }, sprites, nodes: layoutNodes, edges, ascendancies };
  writeFileSync(LAYOUT_FILE, JSON.stringify(layout), "utf8");
  const ascNodeCount = Object.values(ascendancies).reduce((n, a) => n + Object.keys(a.nodes).length, 0);
  console.log(
    `Wrote ${Object.keys(layoutNodes).length} nodes + ${edges.length} edges + ${Object.keys(ascendancies).length} ascendancies (${ascNodeCount} nodes) -> ${LAYOUT_FILE} (${(JSON.stringify(layout).length / 1024).toFixed(0)} KB)`,
  );

  await downloadSprites();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
