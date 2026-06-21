#!/usr/bin/env tsx
/**
 * Decode a real PoB2 export code and snapshot it as a fixture.
 *
 * Usage:
 *   pnpm tsx scripts/pob-decode.ts <path-to-code.txt> [fixtureName]
 *
 * The input file should contain just the export code (the long base64 string).
 * Writes <fixtureName>.xml and <fixtureName>.json into lib/pob/__fixtures__/,
 * and prints a concise summary so we can eyeball-validate the parse.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { decodePobCode } from "../lib/pob/decode";
import { parsePobXml } from "../lib/pob/parse";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE_DIR = join(__dirname, "..", "lib", "pob", "__fixtures__");

function main() {
  const [inputPath, fixtureName] = process.argv.slice(2);
  if (!inputPath) {
    console.error("Usage: tsx scripts/pob-decode.ts <path-to-code.txt> [fixtureName]");
    process.exit(1);
  }

  const code = readFileSync(inputPath, "utf8").trim();
  const xml = decodePobCode(code);
  const build = parsePobXml(xml);

  console.log("=== PoB2 decode summary ===");
  console.log("class:        ", build.className);
  console.log("ascendancy:   ", build.ascendClassName);
  console.log("level:        ", build.level);
  console.log("tree version: ", build.tree.treeVersion);
  console.log("allocated:    ", build.tree.nodes.length, "nodes");
  console.log("tree specs:   ", build.treeSpecs.length);
  console.log("items:        ", build.items.length);
  console.log("equipped slots:", build.slots.map((s) => s.name).join(", ") || "(none)");
  console.log("skill groups: ", build.skills.length);
  for (const g of build.skills) {
    const gems = g.gems.map((x) => `${x.nameSpec}${x.isSupport ? "(s)" : ""}`).join(" + ");
    console.log("   -", g.slot ?? g.label ?? "?", ":", gems);
  }
  const firstItem = build.items[0];
  if (firstItem) {
    console.log("\nfirst item parse check:");
    console.log("   rarity:", firstItem.rarity, "| name:", firstItem.name, "| base:", firstItem.base);
    console.log("   implicits:", firstItem.implicits?.length, "| affixes:", firstItem.affixes?.length);
  }

  if (fixtureName) {
    mkdirSync(FIXTURE_DIR, { recursive: true });
    writeFileSync(join(FIXTURE_DIR, `${fixtureName}.code.txt`), code, "utf8");
    writeFileSync(join(FIXTURE_DIR, `${fixtureName}.xml`), xml, "utf8");
    writeFileSync(join(FIXTURE_DIR, `${fixtureName}.json`), JSON.stringify(build, null, 2), "utf8");
    console.log(`\nWrote fixtures: ${fixtureName}.{code.txt,xml,json} -> ${FIXTURE_DIR}`);
  }
}

main();
