"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";

interface LayoutNode {
  x: number;
  y: number;
  k: string; // n | N | K | M | J
  name: string;
}
interface Layout {
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
  nodes: Record<string, LayoutNode>;
  edges: [number, number][];
}

type NodeState = "none" | "shared" | "allocate" | "refund";

const NODE_COLOR: Record<NodeState, string> = {
  none: "rgba(135,135,150,0.20)",
  shared: "#8b93a7",
  allocate: "#34d399",
  refund: "#f87171",
};
const EDGE_DIM = "rgba(135,135,150,0.10)";
const EDGE_SHARED = "rgba(139,147,167,0.55)";
const EDGE_GREEN = "rgba(52,211,153,0.65)";
const EDGE_RED = "rgba(248,113,113,0.55)";

const WORLD_R: Record<string, number> = { K: 230, N: 150, M: 120, J: 110, n: 90 };

const inTarget = (s: NodeState) => s === "shared" || s === "allocate";
const inSource = (s: NodeState) => s === "shared" || s === "refund";

export function PassiveTree({
  sourceNodes,
  targetNodes,
}: {
  sourceNodes: number[];
  targetNodes: number[];
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [layout, setLayout] = useState<Layout | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hover, setHover] = useState<{ left: number; top: number; name: string; state: NodeState } | null>(null);

  const view = useRef({ scale: 1, offsetX: 0, offsetY: 0 });
  const drag = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const frame = useRef(0);

  const { srcSet, tgtSet } = useMemo(
    () => ({ srcSet: new Set(sourceNodes), tgtSet: new Set(targetNodes) }),
    [sourceNodes, targetNodes],
  );

  // Load layout once.
  useEffect(() => {
    let active = true;
    fetch("/tree-layout.json")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data: Layout) => active && setLayout(data))
      .catch((e) => active && setError(String(e)));
    return () => {
      active = false;
    };
  }, []);

  // Precompute render model when layout or sets change.
  const model = useMemo(() => {
    if (!layout) return null;
    const stateOf = (id: number): NodeState => {
      const s = srcSet.has(id);
      const t = tgtSet.has(id);
      if (s && t) return "shared";
      if (t) return "allocate";
      if (s) return "refund";
      return "none";
    };
    const nodes = Object.entries(layout.nodes).map(([id, n]) => ({
      id: Number(id),
      n,
      st: stateOf(Number(id)),
    }));
    const stateMap = new Map(nodes.map((e) => [e.id, e.st]));
    const edges = layout.edges.map(([a, b]) => {
      const sa = stateMap.get(a) ?? "none";
      const sb = stateMap.get(b) ?? "none";
      let color = EDGE_DIM;
      if (inTarget(sa) && inTarget(sb)) color = sa === "allocate" || sb === "allocate" ? EDGE_GREEN : EDGE_SHARED;
      else if (inSource(sa) && inSource(sb)) color = EDGE_RED;
      const na = layout.nodes[String(a)];
      const nb = layout.nodes[String(b)];
      return { ax: na.x, ay: na.y, bx: nb.x, by: nb.y, color, dim: color === EDGE_DIM };
    });
    return { nodes, edges };
  }, [layout, srcSet, tgtSet]);

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas || !model) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const { scale, offsetX, offsetY } = view.current;
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);

    const sx = (x: number) => x * scale + offsetX;
    const sy = (y: number) => y * scale + offsetY;
    const lw = Math.max(0.4, 16 * scale);

    // Edges: dim first, highlighted on top.
    ctx.lineWidth = lw;
    for (const pass of [true, false]) {
      for (const e of model.edges) {
        if (e.dim !== pass) continue;
        ctx.strokeStyle = e.color;
        ctx.beginPath();
        ctx.moveTo(sx(e.ax), sy(e.ay));
        ctx.lineTo(sx(e.bx), sy(e.by));
        ctx.stroke();
      }
    }

    // Nodes: none -> shared -> allocate -> refund (important on top).
    const order: NodeState[] = ["none", "shared", "allocate", "refund"];
    for (const state of order) {
      ctx.fillStyle = NODE_COLOR[state];
      for (const { n, st } of model.nodes) {
        if (st !== state) continue;
        const r = Math.max(st === "none" ? 1 : 1.6, (WORLD_R[n.k] ?? 90) * scale);
        ctx.beginPath();
        ctx.arc(sx(n.x), sy(n.y), r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  };

  const scheduleDraw = () => {
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(draw);
  };

  const fit = () => {
    const c = containerRef.current;
    if (!c || !layout) return;
    const w = c.clientWidth;
    const h = c.clientHeight;
    const { minX, minY, maxX, maxY } = layout.bounds;
    const worldW = maxX - minX || 1;
    const worldH = maxY - minY || 1;
    const scale = Math.min(w / worldW, h / worldH) * 0.92;
    view.current = {
      scale,
      offsetX: w / 2 - ((minX + maxX) / 2) * scale,
      offsetY: h / 2 - ((minY + maxY) / 2) * scale,
    };
    scheduleDraw();
  };

  // Size canvas to container, fit on first layout.
  useEffect(() => {
    const c = containerRef.current;
    const canvas = canvasRef.current;
    if (!c || !canvas) return;
    const ro = new ResizeObserver(() => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = c.clientWidth * dpr;
      canvas.height = c.clientHeight * dpr;
      canvas.style.width = `${c.clientWidth}px`;
      canvas.style.height = `${c.clientHeight}px`;
      if (view.current.scale === 1) fit();
      else scheduleDraw();
    });
    ro.observe(c);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout]);

  // Redraw when the render model changes.
  useEffect(() => {
    if (model) fit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model]);

  // Interaction handlers.
  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, moved: false };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (drag.current) {
      const dx = e.clientX - drag.current.x;
      const dy = e.clientY - drag.current.y;
      drag.current = { x: e.clientX, y: e.clientY, moved: true };
      view.current.offsetX += dx;
      view.current.offsetY += dy;
      setHover(null);
      scheduleDraw();
      return;
    }
    // Hover hit-test.
    if (!model) return;
    const rect = canvasRef.current!.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const { scale, offsetX, offsetY } = view.current;
    const wx = (mx - offsetX) / scale;
    const wy = (my - offsetY) / scale;
    const hitR = 16 / scale;
    let best: { d: number; name: string; st: NodeState } | null = null;
    for (const { n, st } of model.nodes) {
      if (st === "none") continue; // only surface meaningful nodes
      const dx = n.x - wx;
      const dy = n.y - wy;
      const d = dx * dx + dy * dy;
      if (d < hitR * hitR && (!best || d < best.d)) best = { d, name: n.name, st };
    }
    setHover(best ? { left: mx, top: my, name: best.name, state: best.st } : null);
  };
  const endDrag = (e: React.PointerEvent) => {
    if (drag.current) (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    drag.current = null;
  };
  const onWheel = (e: React.WheelEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const factor = Math.exp(-e.deltaY * 0.0015);
    const v = view.current;
    const newScale = Math.min(2, Math.max(0.005, v.scale * factor));
    // keep point under cursor fixed
    v.offsetX = mx - ((mx - v.offsetX) / v.scale) * newScale;
    v.offsetY = my - ((my - v.offsetY) / v.scale) * newScale;
    v.scale = newScale;
    setHover(null);
    scheduleDraw();
  };

  if (error) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Couldn&apos;t load the tree map ({error}).
      </div>
    );
  }
  if (!layout) {
    return <Skeleton className="h-full w-full" />;
  }

  return (
    <div ref={containerRef} className="relative h-full w-full overflow-hidden">
      <canvas
        ref={canvasRef}
        className="h-full w-full cursor-grab touch-none active:cursor-grabbing"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerLeave={(e) => {
          endDrag(e);
          setHover(null);
        }}
        onWheel={onWheel}
      />

      {hover && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-[calc(100%+10px)] rounded-md border border-border/60 bg-popover px-2 py-1 text-xs shadow-md"
          style={{ left: hover.left, top: hover.top }}
        >
          <span className="font-medium">{hover.name || "Passive"}</span>
          <span
            className="ml-2"
            style={{ color: NODE_COLOR[hover.state] }}
          >
            {hover.state === "allocate" ? "Allocate" : hover.state === "refund" ? "Refund" : "Keep"}
          </span>
        </div>
      )}

      <div className="pointer-events-none absolute bottom-2 left-2 flex flex-wrap gap-3 rounded-md bg-background/70 px-2 py-1 text-[11px] backdrop-blur">
        <Legend color={NODE_COLOR.allocate} label="Allocate" />
        <Legend color={NODE_COLOR.refund} label="Refund" />
        <Legend color={NODE_COLOR.shared} label="Keep" />
      </div>

      <button
        onClick={fit}
        className="absolute top-2 right-2 rounded-md border border-border/60 bg-background/70 px-2 py-1 text-xs backdrop-blur transition-colors hover:bg-background"
      >
        Reset view
      </button>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}
