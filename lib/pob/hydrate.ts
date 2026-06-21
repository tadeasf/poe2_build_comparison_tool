import { parsePobCode } from "./parse";
import type { PobBuild } from "./types";

/**
 * Builds stored before weapon-set support lack `tree.weaponSet1Nodes`. Since the
 * original export string is retained, re-parse it on read to recover weapon-set
 * data without a manual re-import; fall back to the stored parse if that fails.
 */
export function hydrateBuild(row: { parsed: unknown; pob_string: string | null }): PobBuild {
  const parsed = row.parsed as PobBuild;
  if (parsed?.tree?.weaponSet1Nodes !== undefined || !row.pob_string) return parsed;
  try {
    return parsePobCode(row.pob_string);
  } catch {
    return parsed;
  }
}

/** The tree-layout ascendancy key for a build, e.g. "Mercenary" + 2 = "Mercenary2". */
export function ascendancyIdOf(build: PobBuild): string | undefined {
  const id = build.tree.ascendClassId;
  if (!id || !build.className) return undefined;
  return `${build.className}${id}`;
}
