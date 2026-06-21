"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";

interface LayoutNode {
  x: number;
  y: number;
  k: string; // n | N | K | M | J
  name: string;
  /** GGG icon asset path; the lookup key into the skills atlases. */
  ic?: string;
}
interface SpriteRef {
  image: string;
  json: string;
}
interface SubLayout {
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
  nodes: Record<string, LayoutNode>;
  edges: [number, number][];
}
interface Layout extends SubLayout {
  sprites?: { skills: SpriteRef; skillsDisabled: SpriteRef; frame: SpriteRef };
  /** Per-ascendancy self-contained sub-layouts, keyed by ascendancyId. */
  ascendancies?: Record<string, SubLayout>;
}

type NodeState = "none" | "shared" | "allocate" | "refund";
type WSet = "common" | "set1" | "set2";
type Rect = { x: number; y: number; w: number; h: number };
// Filter by diff action (allocate/refund/keep) or by weapon set (set1/set2).
type Filter = "all" | "allocate" | "refund" | "keep" | "set1" | "set2";

const NODE_COLOR: Record<NodeState, string> = {
  none: "rgba(135,135,150,0.20)",
  shared: "#8b93a7",
  allocate: "#34d399",
  refund: "#f87171",
};
// Weapon-set colors follow PoE's in-game convention: Set I = red, Set II = green.
const SET_COLOR: Record<WSet, string> = { common: "", set1: "#ef4444", set2: "#22c55e" };
const MASTERY_COLOR = "#a78bfa";
// Cap how large node glyphs/edges grow; positions keep scaling, so very deep
// zoom spreads nodes apart instead of ballooning frames into a blurry mess.
// Set high enough that zooming in enlarges icons to a readable size first.
const MAX_GLYPH_SCALE = 0.32;
const EDGE_DIM = "rgba(135,135,150,0.10)";
const EDGE_SHARED = "rgba(139,147,167,0.55)";
const EDGE_GREEN = "rgba(52,211,153,0.65)";
const EDGE_RED = "rgba(248,113,113,0.55)";

// Node radii. Kept comfortably under the ~264-unit median edge length so frames
// don't overlap (a normal frame ≈ 2·r·FRAME_FACTOR ≈ 150 world units).
const WORLD_R: Record<string, number> = { K: 150, N: 105, M: 90, J: 85, n: 68 };
const FRAME_FACTOR = 1.1;
// Per-state opacity when no specific filter is active: changes (allocate/refund)
// pop at full strength, kept nodes recede, background barely shows.
const STATE_ALPHA: Record<NodeState, number> = { none: 0.12, shared: 0.42, allocate: 1, refund: 1 };

// Per node type: which atlas prefix (lit/dim) and frame name (alloc/unalloc) to use.
const ATLAS_PREFIX: Record<string, { lit: string; dim: string }> = {
  n: { lit: "normalActive", dim: "normalInactive" },
  N: { lit: "notableActive", dim: "notableInactive" },
  K: { lit: "keystoneActive", dim: "keystoneInactive" },
};
const FRAME_KEY: Record<string, { on: string; off: string }> = {
  n: { on: "frame:PSSkillFrameActive", off: "frame:PSSkillFrame" },
  N: { on: "frame:NotableFrameAllocated", off: "frame:NotableFrameUnallocated" },
  K: { on: "frame:KeystoneFrameAllocated", off: "frame:KeystoneFrameUnallocated" },
  J: { on: "frame:JewelFrameAllocated", off: "frame:JewelFrameUnallocated" },
};
// Ascendancy nodes reuse the skills icon atlas but their own ornate frames.
const ASC_FRAME_KEY: Record<string, { on: string; off: string }> = {
  n: { on: "frame:AscendancyFrameNormalAllocated", off: "frame:AscendancyFrameNormalUnallocated" },
  N: { on: "frame:AscendancyFrameNotableAllocated", off: "frame:AscendancyFrameNotableUnallocated" },
  K: { on: "frame:AscendancyFrameNotableAllocated", off: "frame:AscendancyFrameNotableUnallocated" },
  J: { on: "frame:AscendancyFrameNormalAllocated", off: "frame:AscendancyFrameNormalUnallocated" },
};

const inTarget = (s: NodeState) => s === "shared" || s === "allocate";
const inSource = (s: NodeState) => s === "shared" || s === "refund";

interface Sprites {
  ready: boolean;
  skills?: HTMLImageElement;
  skillsDisabled?: HTMLImageElement;
  frame?: HTMLImageElement;
  aSkills?: Map<string, Rect>;
  aDim?: Map<string, Rect>;
  aFrame?: Map<string, Rect>;
}

/** Draw a source rect from a sheet, centered at (cx,cy), width=side, height preserves aspect. */
function blit(ctx: CanvasRenderingContext2D, img: HTMLImageElement, r: Rect, cx: number, cy: number, side: number) {
  const h = side * (r.h / r.w);
  ctx.drawImage(img, r.x, r.y, r.w, r.h, cx - side / 2, cy - h / 2, side, h);
}

/** Small dark chip with a colored "I"/"II" marking a weapon-set-specific node. */
function drawSetBadge(
  ctx: CanvasRenderingContext2D,
  set: Exclude<WSet, "common">,
  x: number,
  y: number,
  frameSide: number,
  alpha: number,
) {
  const r = Math.max(5, frameSide * 0.19);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = "rgba(8,8,10,0.88)";
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = SET_COLOR[set];
  ctx.lineWidth = Math.max(0.75, r * 0.2);
  ctx.stroke();
  ctx.fillStyle = SET_COLOR[set];
  ctx.font = `bold ${Math.round(r * 1.25)}px ui-sans-serif, system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(set === "set1" ? "I" : "II", x, y + r * 0.08);
  ctx.restore();
}

export function PassiveTree({
  sourceNodes,
  targetNodes,
  sourceSet1 = [],
  sourceSet2 = [],
  targetSet1 = [],
  targetSet2 = [],
  ascendancy,
}: {
  sourceNodes: number[];
  targetNodes: number[];
  sourceSet1?: number[];
  sourceSet2?: number[];
  targetSet1?: number[];
  targetSet2?: number[];
  /** When set, render this ascendancy's sub-tree instead of the main tree. */
  ascendancy?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [layout, setLayout] = useState<Layout | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hover, setHover] = useState<{ left: number; top: number; name: string; state: NodeState; set: WSet } | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [spritesReady, setSpritesReady] = useState(false);

  const view = useRef({ scale: 1, offsetX: 0, offsetY: 0 });
  const drag = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const frameReq = useRef(0);
  const sprites = useRef<Sprites>({ ready: false });
  // Always points at the latest draw closure so the once-registered native wheel
  // listener never renders a stale model.
  const drawRef = useRef<() => void>(() => {});

  const sets = useMemo(
    () => ({
      srcSet: new Set(sourceNodes),
      tgtSet: new Set(targetNodes),
      s1: new Set([...sourceSet1, ...targetSet1]),
      s2: new Set([...sourceSet2, ...targetSet2]),
    }),
    [sourceNodes, targetNodes, sourceSet1, sourceSet2, targetSet1, targetSet2],
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

  // Preload sprite atlases once layout (with its manifest) is available.
  useEffect(() => {
    if (!layout?.sprites) return;
    let active = true;
    const man = layout.sprites;
    const loadImg = (src: string) =>
      new Promise<HTMLImageElement>((res, rej) => {
        const img = new Image();
        img.onload = () => res(img);
        img.onerror = rej;
        img.src = src;
      });
    const loadAtlas = (src: string) =>
      fetch(src)
        .then((r) => r.json())
        .then((j: { frames: Record<string, { frame: Rect }> }) => {
          const m = new Map<string, Rect>();
          for (const [k, v] of Object.entries(j.frames)) m.set(k, v.frame);
          return m;
        });
    Promise.all([
      loadImg(man.skills.image),
      loadImg(man.skillsDisabled.image),
      loadImg(man.frame.image),
      loadAtlas(man.skills.json),
      loadAtlas(man.skillsDisabled.json),
      loadAtlas(man.frame.json),
    ])
      .then(([s, sd, f, aS, aD, aF]) => {
        if (!active) return;
        sprites.current = { ready: true, skills: s, skillsDisabled: sd, frame: f, aSkills: aS, aDim: aD, aFrame: aF };
        setSpritesReady(true); // triggers the redraw effect below
      })
      .catch(() => {
        /* leave ready=false → dot fallback keeps the tree visible */
      });
    return () => {
      active = false;
    };
  }, [layout]);

  // Active sub-layout: the requested ascendancy when present, else the main tree.
  const isAsc = !!(ascendancy && layout?.ascendancies?.[ascendancy]);
  const active = useMemo<SubLayout | null>(() => {
    if (!layout) return null;
    const sub = ascendancy ? layout.ascendancies?.[ascendancy] : undefined;
    return sub ?? { bounds: layout.bounds, nodes: layout.nodes, edges: layout.edges };
  }, [layout, ascendancy]);

  // Precompute render model when the active layout or sets change.
  const model = useMemo(() => {
    if (!active) return null;
    const { srcSet, tgtSet, s1, s2 } = sets;
    const stateOf = (id: number): NodeState => {
      const s = srcSet.has(id);
      const t = tgtSet.has(id);
      if (s && t) return "shared";
      if (t) return "allocate";
      if (s) return "refund";
      return "none";
    };
    const setOf = (id: number): WSet => (s1.has(id) ? "set1" : s2.has(id) ? "set2" : "common");
    const nodes = Object.entries(active.nodes).map(([id, n]) => ({
      id: Number(id),
      n,
      st: stateOf(Number(id)),
      set: setOf(Number(id)),
    }));
    const stateMap = new Map(nodes.map((e) => [e.id, e.st]));
    const edges = active.edges.map(([a, b]) => {
      const sa = stateMap.get(a) ?? "none";
      const sb = stateMap.get(b) ?? "none";
      let color = EDGE_DIM;
      if (inTarget(sa) && inTarget(sb)) color = sa === "allocate" || sb === "allocate" ? EDGE_GREEN : EDGE_SHARED;
      else if (inSource(sa) && inSource(sb)) color = EDGE_RED;
      const na = active.nodes[String(a)];
      const nb = active.nodes[String(b)];
      return { ax: na.x, ay: na.y, bx: nb.x, by: nb.y, color, dim: color === EDGE_DIM };
    });
    return { nodes, edges };
  }, [active, sets]);

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas || !model) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingQuality = "high"; // crisper upscaled icons when zoomed in
    const { scale, offsetX, offsetY } = view.current;
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const cw = canvas.width / dpr;
    const ch = canvas.height / dpr;
    ctx.clearRect(0, 0, cw, ch);

    // Glyph size caps so deep zoom doesn't balloon/overlap frames; positions use
    // full scale. Ascendancy panels are small clusters, so they keep full scale.
    const glyphScale = isAsc ? scale : Math.min(scale, MAX_GLYPH_SCALE);
    const sx = (x: number) => x * scale + offsetX;
    const sy = (y: number) => y * scale + offsetY;
    const lw = Math.max(0.4, 16 * glyphScale);

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

    const sp = sprites.current;
    // Nodes: none -> shared -> allocate -> refund (important on top).
    const order: NodeState[] = ["none", "shared", "allocate", "refund"];
    for (const state of order) {
      for (const { n, st, set } of model.nodes) {
        if (st !== state) continue;
        const cx = sx(n.x);
        const cy = sy(n.y);
        if (cx < -48 || cy < -48 || cx > cw + 48 || cy > ch + 48) continue; // cull offscreen

        const meaningful = st !== "none";
        const matches =
          filter === "all" ||
          (filter === "allocate" && st === "allocate") ||
          (filter === "refund" && st === "refund") ||
          (filter === "keep" && st === "shared") ||
          (filter === "set1" && set === "set1") ||
          (filter === "set2" && set === "set2");
        // No filter → emphasise changes, recede kept nodes. Filter on → matching
        // nodes full, everything else barely visible.
        const alpha = !matches ? 0.06 : filter === "all" ? STATE_ALPHA[st] : meaningful ? 1 : 0.12;
        const dia = 2 * (WORLD_R[n.k] ?? 68) * glyphScale;
        const frameSide = dia * FRAME_FACTOR;
        // Icons only when big enough to read; always for meaningful (small) nodes, else when zoomed in.
        const wantSprite = sp.ready && (meaningful ? frameSide >= 6 : frameSide >= 18);

        if (wantSprite && drawSprite(ctx, sp, n, st, cx, cy, frameSide, alpha)) {
          // Glowing ring marks the actionable changes: allocate (green) / refund (red).
          if (st === "allocate" || st === "refund") {
            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.shadowColor = NODE_COLOR[st];
            ctx.shadowBlur = frameSide * 0.45;
            ctx.strokeStyle = NODE_COLOR[st];
            ctx.lineWidth = Math.max(1.5, frameSide * 0.1);
            ctx.beginPath();
            ctx.arc(cx, cy, frameSide * 0.5, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
          }
          // Weapon-set badge: a small "I"/"II" chip (a letter, not a colored dot,
          // so it never reads as an allocate/refund ring).
          if (set !== "common" && frameSide >= 16) {
            drawSetBadge(ctx, set, cx - frameSide * 0.33, cy - frameSide * 0.33, frameSide, alpha);
          }
        } else if (n.k === "M") {
          // Masteries have no atlas icon — draw a distinct diamond marker.
          const r = Math.max(meaningful ? 2 : 1, (WORLD_R.M ?? 120) * glyphScale * 0.6);
          const fill =
            state === "allocate"
              ? NODE_COLOR.allocate
              : state === "refund"
                ? NODE_COLOR.refund
                : state === "shared"
                  ? MASTERY_COLOR
                  : NODE_COLOR.none;
          ctx.globalAlpha = alpha;
          ctx.save();
          ctx.translate(cx, cy);
          ctx.rotate(Math.PI / 4);
          ctx.fillStyle = fill;
          ctx.fillRect(-r, -r, 2 * r, 2 * r);
          if (meaningful) {
            ctx.strokeStyle = "rgba(0,0,0,0.55)";
            ctx.lineWidth = Math.max(0.4, r * 0.2);
            ctx.strokeRect(-r, -r, 2 * r, 2 * r);
          }
          ctx.restore();
          ctx.globalAlpha = 1;
        } else {
          // Dot fallback (far zoom or loading).
          ctx.globalAlpha = alpha;
          ctx.fillStyle = set !== "common" && meaningful ? SET_COLOR[set] : NODE_COLOR[state];
          const r = Math.max(state === "none" ? 1 : 1.6, (WORLD_R[n.k] ?? 90) * glyphScale);
          ctx.beginPath();
          ctx.arc(cx, cy, r, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1;
        }
      }
    }
  };

  /** Draw icon (lit/dim) + frame for a node. Returns false if nothing to draw. */
  function drawSprite(
    ctx: CanvasRenderingContext2D,
    sp: Sprites,
    n: LayoutNode,
    st: NodeState,
    cx: number,
    cy: number,
    frameSide: number,
    alpha: number,
  ): boolean {
    const lit = st !== "none";
    const fk = (isAsc ? ASC_FRAME_KEY : FRAME_KEY)[n.k];
    const frameRect = fk ? sp.aFrame?.get(lit ? fk.on : fk.off) : undefined;
    const pref = ATLAS_PREFIX[n.k];
    let iconRect: Rect | undefined;
    let iconImg: HTMLImageElement | undefined;
    if (pref && n.ic) {
      iconImg = lit ? sp.skills : sp.skillsDisabled;
      const atlas = lit ? sp.aSkills : sp.aDim;
      iconRect = atlas?.get(`${lit ? pref.lit : pref.dim}:${n.ic}`);
    }
    if (!frameRect && !iconRect) return false;

    ctx.globalAlpha = alpha;
    if (iconRect && iconImg) {
      const iconSide = frameRect ? frameSide * (iconRect.w / frameRect.w) : frameSide * 0.66;
      blit(ctx, iconImg, iconRect, cx, cy, iconSide);
    }
    if (frameRect && sp.frame) blit(ctx, sp.frame, frameRect, cx, cy, frameSide);
    ctx.globalAlpha = 1;
    return true;
  }

  const scheduleDraw = () => {
    cancelAnimationFrame(frameReq.current);
    frameReq.current = requestAnimationFrame(draw);
  };

  // Keep the once-registered native wheel listener pointed at the latest draw.
  useEffect(() => {
    drawRef.current = draw;
  });

  const fit = () => {
    const c = containerRef.current;
    if (!c || !active) return;
    const w = c.clientWidth;
    const h = c.clientHeight;
    const { minX, minY, maxX, maxY } = active.bounds;
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

  // Zoom by a multiplier, keeping the canvas centre fixed (for the +/- buttons).
  const zoomBy = (mult: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const mx = canvas.width / dpr / 2;
    const my = canvas.height / dpr / 2;
    const v = view.current;
    const newScale = Math.min(2, Math.max(0.005, v.scale * mult));
    v.offsetX = mx - ((mx - v.offsetX) / v.scale) * newScale;
    v.offsetY = my - ((my - v.offsetY) / v.scale) * newScale;
    v.scale = newScale;
    setHover(null);
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

  // Redraw on filter change or once sprites finish loading.
  useEffect(() => {
    scheduleDraw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, spritesReady]);

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
    let best: { d: number; name: string; st: NodeState; set: WSet } | null = null;
    for (const { n, st, set } of model.nodes) {
      if (st === "none") continue; // only surface meaningful nodes
      const dx = n.x - wx;
      const dy = n.y - wy;
      const d = dx * dx + dy * dy;
      if (d < hitR * hitR && (!best || d < best.d)) best = { d, name: n.name, st, set };
    }
    setHover(best ? { left: mx, top: my, name: best.name, state: best.st, set: best.set } : null);
  };
  const endDrag = (e: React.PointerEvent) => {
    if (drag.current) (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    drag.current = null;
  };

  // Wheel = zoom. Registered natively with { passive: false } so preventDefault()
  // actually stops the page from scrolling while zooming over the canvas.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const factor = Math.exp(-e.deltaY * 0.0015);
      const v = view.current;
      const newScale = Math.min(2, Math.max(0.005, v.scale * factor));
      v.offsetX = mx - ((mx - v.offsetX) / v.scale) * newScale;
      v.offsetY = my - ((my - v.offsetY) / v.scale) * newScale;
      v.scale = newScale;
      setHover(null);
      cancelAnimationFrame(frameReq.current);
      frameReq.current = requestAnimationFrame(() => drawRef.current());
    };
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onWheel);
    // Dep on `layout` so this re-runs once the canvas mounts (before layout
    // loads the component renders a Skeleton, so canvasRef.current is null).
  }, [layout]);

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
      />

      {hover && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-[calc(100%+10px)] rounded-md border border-border/60 bg-popover px-2 py-1 text-xs shadow-md"
          style={{ left: hover.left, top: hover.top }}
        >
          <span className="font-medium">{hover.name || "Passive"}</span>
          <span className="ml-2" style={{ color: NODE_COLOR[hover.state] }}>
            {hover.state === "allocate" ? "Allocate" : hover.state === "refund" ? "Refund" : "Keep"}
          </span>
          {hover.set !== "common" && (
            <span className="ml-2" style={{ color: SET_COLOR[hover.set] }}>
              {hover.set === "set1" ? "Set I" : "Set II"}
            </span>
          )}
        </div>
      )}

      {/* Filter chips (main tree) — double as the colour legend. Click to isolate. */}
      {!isAsc && (
        <div className="absolute top-2 left-2 flex max-w-[calc(100%-5.5rem)] flex-wrap gap-1 text-[11px]">
          {(
            [
              ["all", "All", ""],
              ["allocate", "Allocate", NODE_COLOR.allocate],
              ["refund", "Refund", NODE_COLOR.refund],
              ["keep", "Keep", NODE_COLOR.shared],
              ["set1", "Set I", SET_COLOR.set1],
              ["set2", "Set II", SET_COLOR.set2],
            ] as [Filter, string, string][]
          ).map(([f, label, color]) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`flex items-center gap-1 rounded-md border border-border/60 px-2 py-1 backdrop-blur transition-colors ${
                filter === f ? "bg-foreground/25 font-medium" : "bg-background/70 hover:bg-foreground/10"
              }`}
            >
              {color && (
                <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
              )}
              {label}
            </button>
          ))}
        </div>
      )}

      {/* Ascendancy panel has no filter — show a small static legend instead. */}
      {isAsc && (
        <div className="pointer-events-none absolute bottom-2 left-2 flex flex-wrap gap-1.5 rounded-md bg-background/70 px-2 py-1 text-[11px] backdrop-blur sm:gap-3">
          <Legend color={NODE_COLOR.allocate} label="Allocate" />
          <Legend color={NODE_COLOR.refund} label="Refund" />
          <Legend color={NODE_COLOR.shared} label="Keep" />
        </div>
      )}

      <div className="absolute top-2 right-2 flex items-center gap-1">
        <button
          onClick={() => zoomBy(1 / 1.4)}
          aria-label="Zoom out"
          className="flex h-7 w-7 items-center justify-center rounded-md border border-border/60 bg-background/70 text-base leading-none backdrop-blur transition-colors hover:bg-background"
        >
          −
        </button>
        <button
          onClick={() => zoomBy(1.4)}
          aria-label="Zoom in"
          className="flex h-7 w-7 items-center justify-center rounded-md border border-border/60 bg-background/70 text-base leading-none backdrop-blur transition-colors hover:bg-background"
        >
          +
        </button>
        <button
          onClick={fit}
          className="rounded-md border border-border/60 bg-background/70 px-2 py-1 text-xs backdrop-blur transition-colors hover:bg-background"
        >
          Reset view
        </button>
      </div>
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
