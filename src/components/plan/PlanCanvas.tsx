import { useCallback, useEffect, useRef, useState } from "react";
import {
  CATALOG_BY_KIND,
  GRID_M,
  PX_PER_M,
  architectureLength,
  conduitLength,
  conduitPath,
  fmtM,
  nextLabel,
  nodePosition,
  roomArea,
  roomBounds,
  snap,
  uid,
  type ArchitecturalKind,
  type ComponentKind,
  type LayerId,
  type PlanDocument,
  type PlanVertex,
} from "@/lib/electrical";
import { getWireRuns } from "@/lib/auto-routing";
import { SymbolGlyph, kindColor } from "./SymbolGlyph";

export type Tool = "select" | "room" | "room_free" | "wall" | "door" | "window" | "point" | "panel" | "conduit";
export type Selection = { type: "room" | "architecture" | "point" | "panel" | "conduit"; id: string } | null;

type Props = {
  doc: PlanDocument;
  onChange: (updater: (doc: PlanDocument) => PlanDocument) => void;
  tool: Tool;
  activeKind: ComponentKind;
  visible: Record<LayerId, boolean>;
  selection: Selection;
  onSelect: (sel: Selection) => void;
  onToolDone: () => void;
};

type SegmentDraft = { kind: ArchitecturalKind; x0: number; y0: number; x1: number; y1: number };
type DragState =
  | { kind: "pan"; ox: number; oy: number }
  | { kind: "move"; id: string; type: string; ox: number; oy: number }
  | { kind: "conduit-bend"; id: string; index: number };

export function PlanCanvas({ doc, onChange, tool, activeKind, visible, selection, onSelect, onToolDone }: Props) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [view, setView] = useState({ x: 80, y: 80, z: 1 });
  const [drawRect, setDrawRect] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  const [segment, setSegment] = useState<SegmentDraft | null>(null);
  const [roomPolygon, setRoomPolygon] = useState<PlanVertex[]>([]);
  const [conduitFrom, setConduitFrom] = useState<string | null>(null);
  const dragRef = useRef<DragState | null>(null);

  const toWorld = useCallback((clientX: number, clientY: number) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return { x: (clientX - rect.left - view.x) / view.z / PX_PER_M, y: (clientY - rect.top - view.y) / view.z / PX_PER_M };
  }, [view]);

  useEffect(() => { if (tool !== "conduit") setConduitFrom(null); }, [tool]);
  useEffect(() => { if (!["wall", "door", "window"].includes(tool)) setSegment(null); }, [tool]);
  useEffect(() => { if (tool !== "room_free") setRoomPolygon([]); }, [tool]);

  const handleWheel = (e: React.WheelEvent) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
    const nz = Math.min(4, Math.max(0.25, view.z * factor));
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    setView({ z: nz, x: mx - ((mx - view.x) * nz) / view.z, y: my - ((my - view.y) * nz) / view.z });
  };

  const architectureKindForTool = (): ArchitecturalKind | null => {
    if (tool === "wall") return "wall";
    if (tool === "door") return "door";
    if (tool === "window") return "window";
    return null;
  };

  const finishFreeRoom = (points: PlanVertex[]) => {
    if (points.length < 3) return;
    const bounds = roomBounds(points);
    if (roomArea({ id: "preview", name: "", ...bounds, points }) < 0.25) return;
    const id = uid();
    onChange((d) => ({ ...d, rooms: [...d.rooms, { id, name: `Ambiente ${d.rooms.length + 1}`, ...bounds, points }] }));
    setRoomPolygon([]);
    onSelect({ type: "room", id });
    onToolDone();
  };

  const onBackgroundDown = (e: React.MouseEvent) => {
    const w = toWorld(e.clientX, e.clientY);
    if (e.button === 1 || e.altKey || tool === "select") {
      if (tool === "select" && e.button === 0 && !e.altKey) onSelect(null);
      dragRef.current = { kind: "pan", ox: e.clientX - view.x, oy: e.clientY - view.y };
      return;
    }
    if (tool === "room") {
      setDrawRect({ x0: snap(w.x), y0: snap(w.y), x1: snap(w.x), y1: snap(w.y) });
      return;
    }
    if (tool === "room_free") {
      const next = { x: snap(w.x), y: snap(w.y) };
      const first = roomPolygon[0];
      if (first && roomPolygon.length >= 3 && Math.hypot(next.x - first.x, next.y - first.y) <= 0.35) finishFreeRoom(roomPolygon);
      else setRoomPolygon((pts) => [...pts, next]);
      return;
    }
    const architectureKind = architectureKindForTool();
    if (architectureKind) {
      setSegment({ kind: architectureKind, x0: snap(w.x), y0: snap(w.y), x1: snap(w.x), y1: snap(w.y) });
      return;
    }
    if (tool === "point") {
      const def = CATALOG_BY_KIND[activeKind];
      const id = uid();
      onChange((d) => ({ ...d, points: [...d.points, { id, kind: activeKind, x: snap(w.x), y: snap(w.y), label: nextLabel(d, activeKind), power: def.power, voltage: def.voltage, height: def.height, circuit: "", rotation: 0, mirrored: false }] }));
      onSelect({ type: "point", id });
      return;
    }
    if (tool === "panel") {
      const id = uid();
      onChange((d) => ({ ...d, panels: [...d.panels, { id, name: `QD-${String(d.panels.length + 1).padStart(2, "0")}`, x: snap(w.x), y: snap(w.y), rotation: 0 }] }));
      onSelect({ type: "panel", id });
      onToolDone();
    }
  };

  const onMouseMove = (e: React.MouseEvent) => {
    const drag = dragRef.current;
    if (drag?.kind === "pan") { setView((v) => ({ ...v, x: e.clientX - drag.ox, y: e.clientY - drag.oy })); return; }
    if (drag?.kind === "conduit-bend") {
      const w = toWorld(e.clientX, e.clientY);
      const next = { x: snap(w.x), y: snap(w.y) };
      onChange((d) => ({ ...d, conduits: d.conduits.map((c) => c.id === drag.id ? { ...c, route: (c.route ?? []).map((p, i) => i === drag.index ? next : p) } : c) }));
      return;
    }
    if (drag?.kind === "move") {
      const w = toWorld(e.clientX, e.clientY);
      const nx = snap(w.x - drag.ox), ny = snap(w.y - drag.oy);
      onChange((d) => {
        if (drag.type === "point") return { ...d, points: d.points.map((p) => p.id === drag.id ? { ...p, x: nx, y: ny } : p) };
        if (drag.type === "panel") return { ...d, panels: d.panels.map((p) => p.id === drag.id ? { ...p, x: nx, y: ny } : p) };
        if (drag.type === "architecture") {
          const current = d.architecture.find((a) => a.id === drag.id); if (!current) return d;
          const dx = nx - current.x1, dy = ny - current.y1;
          return { ...d, architecture: d.architecture.map((a) => a.id === drag.id ? { ...a, x1: a.x1 + dx, y1: a.y1 + dy, x2: a.x2 + dx, y2: a.y2 + dy } : a) };
        }
        const current = d.rooms.find((r) => r.id === drag.id); if (!current) return d;
        const dx = nx - current.x, dy = ny - current.y;
        return { ...d, rooms: d.rooms.map((r) => r.id === drag.id ? { ...r, x: nx, y: ny, points: r.points?.map((p) => ({ x: p.x + dx, y: p.y + dy })) } : r) };
      });
      return;
    }
    const w = toWorld(e.clientX, e.clientY);
    if (drawRect) setDrawRect({ ...drawRect, x1: snap(w.x), y1: snap(w.y) });
    if (segment) setSegment({ ...segment, x1: snap(w.x), y1: snap(w.y) });
  };

  const endInteraction = () => {
    dragRef.current = null;
    if (drawRect) {
      const x = Math.min(drawRect.x0, drawRect.x1), y = Math.min(drawRect.y0, drawRect.y1);
      const w = Math.abs(drawRect.x1 - drawRect.x0), h = Math.abs(drawRect.y1 - drawRect.y0);
      setDrawRect(null);
      if (w >= 0.5 && h >= 0.5) {
        const id = uid();
        onChange((d) => ({ ...d, rooms: [...d.rooms, { id, name: `Ambiente ${d.rooms.length + 1}`, x, y, w, h }] }));
        onSelect({ type: "room", id });
        onToolDone();
      }
    }
    if (segment) {
      const draft = segment; setSegment(null);
      if (Math.hypot(draft.x1 - draft.x0, draft.y1 - draft.y0) >= 0.25) {
        const id = uid();
        onChange((d) => ({ ...d, architecture: [...d.architecture, { id, kind: draft.kind, x1: draft.x0, y1: draft.y0, x2: draft.x1, y2: draft.y1, thickness: draft.kind === "wall" ? 0.15 : undefined, openingDirection: draft.kind === "door" ? "left" : undefined }] }));
        onSelect({ type: "architecture", id });
        if (draft.kind !== "wall") onToolDone();
      }
    }
  };

  const startMove = (e: React.MouseEvent, type: string, id: string, px: number, py: number) => {
    if (tool !== "select") return;
    e.stopPropagation();
    const w = toWorld(e.clientX, e.clientY);
    dragRef.current = { kind: "move", type, id, ox: w.x - px, oy: w.y - py };
    onSelect({ type: type as NonNullable<Selection>["type"], id });
  };

  const startBendMove = (e: React.MouseEvent, id: string, index: number) => {
    if (tool !== "select") return;
    e.stopPropagation();
    dragRef.current = { kind: "conduit-bend", id, index };
    onSelect({ type: "conduit", id });
  };

  const handleNodeClick = (e: React.MouseEvent, id: string) => {
    if (tool !== "conduit") return;
    e.stopPropagation();
    if (!conduitFrom) { setConduitFrom(id); return; }
    if (conduitFrom === id) { setConduitFrom(null); return; }
    const a = nodePosition(doc, conduitFrom), b = nodePosition(doc, id);
    const route = a && b && Math.abs(a.x - b.x) > 0.01 && Math.abs(a.y - b.y) > 0.01 ? [{ x: b.x, y: a.y }] : [];
    const cid = uid();
    onChange((d) => ({ ...d, conduits: [...d.conduits, { id: cid, from: conduitFrom, to: id, diameter: 25, type: "normal", route }] }));
    setConduitFrom(id);
    onSelect({ type: "conduit", id: cid });
  };

  const isSel = (type: string, id: string) => selection?.type === type && selection.id === id;
  const cursor = tool === "select" ? "default" : ["room", "room_free", "wall", "door", "window"].includes(tool) ? "crosshair" : tool === "conduit" ? "cell" : "copy";
  const wireRuns = getWireRuns(doc);

  return (
    <svg ref={svgRef} className="h-full w-full select-none blueprint-surface" style={{ cursor }} onWheel={handleWheel} onMouseDown={onBackgroundDown} onMouseMove={onMouseMove} onMouseUp={endInteraction} onMouseLeave={endInteraction} onContextMenu={(e) => e.preventDefault()}>
      <g transform={`translate(${view.x} ${view.y}) scale(${view.z})`}>
        {visible.arquitetura && doc.rooms.map((r) => {
          const selected = isSel("room", r.id);
          const labelX = r.x * PX_PER_M + 10, labelY = r.y * PX_PER_M + 22;
          return <g key={r.id} onMouseDown={(e) => startMove(e, "room", r.id, r.x, r.y)}>
            {r.points && r.points.length >= 3 ? <polygon points={r.points.map((p) => `${p.x * PX_PER_M},${p.y * PX_PER_M}`).join(" ")} fill="var(--surface)" fillOpacity={0.55} stroke={selected ? "var(--primary)" : "var(--wall)"} strokeWidth={selected ? 4 : 3} /> : <rect x={r.x * PX_PER_M} y={r.y * PX_PER_M} width={r.w * PX_PER_M} height={r.h * PX_PER_M} fill="var(--surface)" fillOpacity={0.55} stroke={selected ? "var(--primary)" : "var(--wall)"} strokeWidth={selected ? 4 : 3} />}
            <text x={labelX} y={labelY} fill="var(--foreground)" fontSize={13} fontFamily="var(--font-sans)">{r.name}</text>
            <text x={labelX} y={labelY + 16} fill="var(--muted-foreground)" fontSize={11} fontFamily="var(--font-mono)">{r.points ? `forma livre · ${roomArea(r).toFixed(2)} m²` : `${r.w.toFixed(2)} × ${r.h.toFixed(2)} m · ${roomArea(r).toFixed(2)} m²`}</text>
          </g>;
        })}

        {visible.arquitetura && doc.architecture.map((a) => {
          const x1 = a.x1 * PX_PER_M, y1 = a.y1 * PX_PER_M, x2 = a.x2 * PX_PER_M, y2 = a.y2 * PX_PER_M;
          const selected = isSel("architecture", a.id), dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1;
          const nx = -dy / len, ny = dx / len;
          return <g key={a.id} onMouseDown={(e) => startMove(e, "architecture", a.id, a.x1, a.y1)}>
            {a.kind === "wall" && <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={selected ? "var(--primary)" : "var(--wall)"} strokeWidth={Math.max(4, (a.thickness ?? 0.15) * PX_PER_M)} strokeLinecap="square" />}
            {a.kind === "window" && <><line x1={x1 + nx * 3} y1={y1 + ny * 3} x2={x2 + nx * 3} y2={y2 + ny * 3} stroke={selected ? "var(--primary)" : "var(--foreground)"} strokeWidth={2} /><line x1={x1 - nx * 3} y1={y1 - ny * 3} x2={x2 - nx * 3} y2={y2 - ny * 3} stroke={selected ? "var(--primary)" : "var(--foreground)"} strokeWidth={2} /></>}
            {a.kind === "door" && <><line x1={x1} y1={y1} x2={x2} y2={y2} stroke={selected ? "var(--primary)" : "var(--foreground)"} strokeWidth={2.5} /><path d={`M ${x1} ${y1} Q ${x1 + dx * 0.2 + nx * len * 0.45} ${y1 + dy * 0.2 + ny * len * 0.45} ${x2} ${y2}`} fill="none" stroke={selected ? "var(--primary)" : "var(--muted-foreground)"} strokeWidth={1.2} strokeDasharray="4 3" /></>}
            {selected && <text x={(x1 + x2) / 2} y={(y1 + y2) / 2 - 8} textAnchor="middle" fill="var(--primary)" fontSize={10} fontFamily="var(--font-mono)">{fmtM(architectureLength(a))}</text>}
          </g>;
        })}

        {visible.eletrodutos && doc.conduits.map((c) => {
          const path = conduitPath(doc, c); if (path.length < 2) return null;
          const selected = isSel("conduit", c.id), middle = path[Math.floor(path.length / 2)];
          const stroke = selected ? "var(--primary)" : "var(--layer-conduit)", dash = c.type === "underground" ? "3 5" : undefined;
          return <g key={c.id} onMouseDown={(e) => { e.stopPropagation(); onSelect({ type: "conduit", id: c.id }); }}>
            <polyline points={path.map((p) => `${p.x * PX_PER_M},${p.y * PX_PER_M}`).join(" ")} fill="none" stroke={stroke} strokeWidth={selected ? 3.5 : 2.5} strokeDasharray={dash} strokeLinecap="round" strokeLinejoin="round" opacity={c.type === "ceiling" ? 0.72 : 1} />
            <text x={middle.x * PX_PER_M} y={middle.y * PX_PER_M - 7} textAnchor="middle" fill="var(--layer-conduit)" fontSize={10} fontFamily="var(--font-mono)">{fmtM(conduitLength(doc, c))}</text>
            {selected && (c.route ?? []).map((p, index) => <circle key={index} cx={p.x * PX_PER_M} cy={p.y * PX_PER_M} r={5.5} fill="var(--surface)" stroke="var(--primary)" strokeWidth={2} onMouseDown={(e) => startBendMove(e, c.id, index)} />)}
          </g>;
        })}

        {visible.fiacao && wireRuns.flatMap((run) => run.conduitIds.map((conduitId, index) => {
          const conduit = doc.conduits.find((c) => c.id === conduitId); if (!conduit) return null;
          const path = conduitPath(doc, conduit); if (path.length < 2) return null;
          const middle = path[Math.floor(path.length / 2)];
          return <g key={`${run.id}-${conduitId}`} pointerEvents="none">
            <polyline points={path.map((p) => `${p.x * PX_PER_M},${p.y * PX_PER_M}`).join(" ")} fill="none" stroke="var(--primary)" strokeWidth={1.1} strokeDasharray="1 3" opacity={0.85} />
            {index === 0 && <text x={middle.x * PX_PER_M} y={middle.y * PX_PER_M + 11} textAnchor="middle" fill="var(--primary)" fontSize={8.5} fontFamily="var(--font-mono)">{run.circuitId}: {run.roles.join("/")}</text>}
          </g>;
        }))}

        {visible.quadro && doc.panels.map((p) => <g key={p.id} transform={`rotate(${p.rotation ?? 0} ${p.x * PX_PER_M} ${p.y * PX_PER_M})`} onMouseDown={(e) => startMove(e, "panel", p.id, p.x, p.y)} onClick={(e) => handleNodeClick(e, p.id)} style={{ cursor: tool === "conduit" ? "cell" : "move" }}>
          <rect x={p.x * PX_PER_M - 20} y={p.y * PX_PER_M - 14} width={40} height={28} rx={3} fill="var(--surface)" stroke={isSel("panel", p.id) || conduitFrom === p.id ? "var(--primary)" : "var(--layer-panel)"} strokeWidth={2} />
          <text x={p.x * PX_PER_M} y={p.y * PX_PER_M + 4} textAnchor="middle" fill="var(--layer-panel)" fontSize={11} fontFamily="var(--font-mono)">{p.name}</text>
        </g>)}

        {doc.points.map((p) => {
          const def = CATALOG_BY_KIND[p.kind]; if (!def || !visible[def.layer]) return null;
          const active = isSel("point", p.id) || conduitFrom === p.id, mirror = p.mirrored ? -1 : 1;
          return <g key={p.id} transform={`translate(${p.x * PX_PER_M} ${p.y * PX_PER_M}) rotate(${p.rotation ?? 0}) scale(${mirror} 1)`} onMouseDown={(e) => startMove(e, "point", p.id, p.x, p.y)} onClick={(e) => handleNodeClick(e, p.id)} style={{ cursor: tool === "conduit" ? "cell" : "move" }}>
            {active && <circle r={16} fill="var(--primary)" fillOpacity={0.18} stroke="var(--primary)" strokeWidth={1.5} />}
            <SymbolGlyph kind={p.kind} height={p.height} />
            <text y={22} textAnchor="middle" fill={kindColor(p.kind)} fontSize={9.5} fontFamily="var(--font-mono)" transform={`scale(${mirror} 1)`}>{p.label}{p.circuit ? ` · ${p.circuit}` : ""}</text>
          </g>;
        })}

        {drawRect && <rect x={Math.min(drawRect.x0, drawRect.x1) * PX_PER_M} y={Math.min(drawRect.y0, drawRect.y1) * PX_PER_M} width={Math.abs(drawRect.x1 - drawRect.x0) * PX_PER_M} height={Math.abs(drawRect.y1 - drawRect.y0) * PX_PER_M} fill="var(--primary)" fillOpacity={0.1} stroke="var(--primary)" strokeWidth={2} strokeDasharray="6 4" />}
        {roomPolygon.length > 0 && <g><polyline points={roomPolygon.map((p) => `${p.x * PX_PER_M},${p.y * PX_PER_M}`).join(" ")} fill="none" stroke="var(--primary)" strokeWidth={2.5} /><line x1={roomPolygon[roomPolygon.length - 1].x * PX_PER_M} y1={roomPolygon[roomPolygon.length - 1].y * PX_PER_M} x2={roomPolygon[0].x * PX_PER_M} y2={roomPolygon[0].y * PX_PER_M} stroke="var(--primary)" strokeWidth={1.2} strokeDasharray="4 4" />{roomPolygon.map((p, i) => <circle key={i} cx={p.x * PX_PER_M} cy={p.y * PX_PER_M} r={i === 0 ? 6 : 4} fill={i === 0 ? "var(--primary)" : "var(--surface)"} stroke="var(--primary)" strokeWidth={2} />)}</g>}
        {segment && <line x1={segment.x0 * PX_PER_M} y1={segment.y0 * PX_PER_M} x2={segment.x1 * PX_PER_M} y2={segment.y1 * PX_PER_M} stroke="var(--primary)" strokeWidth={segment.kind === "wall" ? 7 : 3} strokeDasharray={segment.kind === "wall" ? undefined : "6 4"} />}
      </g>
      <g><rect x={12} y={12} width={240} height={26} rx={4} fill="var(--surface)" fillOpacity={0.9} /><text x={22} y={29} fill="var(--muted-foreground)" fontSize={11} fontFamily="var(--font-mono)">zoom {(view.z * 100).toFixed(0)}% · grade {GRID_M * 100}cm{tool === "room_free" ? " · clique no início para fechar" : ""}</text></g>
    </svg>
  );
}
