import nodeData from "../../data/tree-nodes.json";

export interface TreeNodeInfo {
  name: string;
  notable?: boolean;
  keystone?: boolean;
  mastery?: boolean;
  ascendancy?: string;
}

// Distilled from the official GGG PoE2 passive tree export.
// Regenerate with `pnpm tsx scripts/fetch-data.ts`.
const nodes = nodeData as Record<string, TreeNodeInfo>;

export function resolveNode(id: number): TreeNodeInfo | undefined {
  return nodes[String(id)];
}

export function nodeName(id: number): string {
  return nodes[String(id)]?.name ?? `Node ${id}`;
}

/** True for the "interesting" nodes worth naming in a checklist (notables, keystones). */
export function isSignificant(id: number): boolean {
  const n = nodes[String(id)];
  return !!n && (n.notable || n.keystone || n.mastery || false);
}
