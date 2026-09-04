import { useCallback, useEffect, useRef, useState } from "react";
import {
  CATALOG,
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

export type Tool = "navigate" | "select" | "room" | "room_free" | "wall" | "door" | "passage" | "window" | "point" | "panel" | "panel_supply" | "panel_distribution" | "conduit";
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

type SegmentKind = ArchitecturalKind | "passage";
type SegmentDraft = { kind: SegmentKind; x0: number; y0: number; x1: number; y1: number };
type DoorElement = PlanDocument["architecture"][number] & { openingAngle?: number; openingSide?: "up" | "down" };
type DragState =
  | { kind: "pan"; ox: number; oy: number }
  | { kind: "move"; id: string; type: string; ox: number; oy: number }
  | { kind: "room-label"; id: string; ox: number; oy: number }
  | { kind: "conduit-bend"; id: string; index: number };

export function PlanCanvas({ doc, onChange, tool, activeKind, visible, selection, onSelect, onToolDone }: Props) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [view, setView] = useState({ x: 80, y: 80, z: 1 });
  const [drawRect, setDrawRect] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  const [segment, setSegment] = useState<SegmentDraft | null>(null);
  const [roomPolygon, setRoomPolygon] = useState<PlanVertex[]>([]);
  const [conduitFrom, setConduitFrom] = useState<string | null>(null);
  const [editingPointId, setEditingPointId] = useState<string | null>(null);
  const dragRef = useRef<DragState | null>(null);

  const editingPoint = editingPointId ? doc.points.find((p) => p.id === editingPointId) : undefined;

  const patchEditingPoint = (patch: Partial<PlanDocument["points"][number]>) => {
    if (!editingPointId) return;
    onChange((d) => ({ ...d, points: d.points.map((p) => p.id === editingPointId ? { ...p, ...patch } : p) }));
  };

  const changeEditingKind = (kind: ComponentKind) => {
    const def = CATALOG_BY_KIND[kind];
    if (!def) return;
    patchEditingPoint({ kind, power: def.power, voltage: def.voltage, height: def.height });
  };

  const toWorld = useCallback((clientX: number, clientY: number) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return { x: (clientX - rect.left - view.x) / view.z / PX_PER_M, y: (clientY - rect.top - view.y) / view.z / PX_PER_M };
  }, [view]);

  useEffect(() => { if (tool !== "conduit") setConduitFrom(null); }, [tool]);
  useEffect(() => { if (!["wall", "door", "passage", "window"].includes(tool)) setSegment(null); }, [tool]);
  useEffect(() => { if (tool !== "room_free") setRoomPolygon([]); }, [tool]);

  const handleWheel = (e: React.WheelEvent) => {
    const rect = svgRef.current?.getBoundingClientRect(); if (!rect) return;
    const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
    const nz = Math.min(4, Math.max(0.25, view.z * factor));
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    setView({ z: nz, x: mx - ((mx - view.x) * nz) / view.z, y: my - ((my - view.y) * nz) / view.z });
  };

  const architectureKindForTool = (): SegmentKind | null => {
    if (tool === "wall") return "wall";
    if (tool === "door") return "door";
    if (tool === "passage") return "passage";
    if (tool === "window") return "window";
    return null;
  };

  const finishFreeRoom = (points: PlanVertex[]) => {
    if (points.length < 3) return;
    const bounds = roomBounds(points);
    if (roomArea({ id: "preview", name: "", ...bounds, points }) < 0.25) return;
    const id = uid();
    onChange((d) => ({ ...d, rooms: [...d.rooms, { id, name: `Ambiente ${d.rooms.length + 1}`, ...bounds, points }] }));
    setRoomPolygon([]); onSelect({ type: "room", id }); onToolDone();
  };

  const onBackgroundDown = (e: React.MouseEvent) => {
    const w = toWorld(e.clientX, e.clientY);
    if (e.button === 1 || e.altKey || tool === "select" || tool === "navigate") {
      if (tool === "select" && e.button === 0 && !e.altKey) onSelect(null);
      dragRef.current = { kind: "pan", ox: e.clientX - view.x, oy: e.clientY - view.y }; return;
    }
    if (tool === "room") { setDrawRect({ x0: snap(w.x), y0: snap(w.y), x1: snap(w.x), y1: snap(w.y) }); return; }
    if (tool === "room_free") {
      const next = { x: snap(w.x), y: snap(w.y) }, first = roomPolygon[0];
      if (first && roomPolygon.length >= 3 && Math.hypot(next.x - first.x, next.y - first.y) <= 0.35) finishFreeRoom(roomPolygon);
      else setRoomPolygon((pts) => [...pts, next]);
      return;
    }
    const architectureKind = architectureKindForTool();
    if (architectureKind) { setSegment({ kind: architectureKind, x0: snap(w.x), y0: snap(w.y), x1: snap(w.x), y1: snap(w.y) }); return; }
    if (tool === "point") {
      const def = CATALOG_BY_KIND[activeKind], id = uid();
      onChange((d) => ({ ...d, points: [...d.points, { id, kind: activeKind, x: snap(w.x), y: snap(w.y), label: nextLabel(d, activeKind), power: def.power, voltage: def.voltage, height: def.height, circuit: "", rotation: 0, mirrored: false }] }));
      onSelect({ type: "point", id }); return;
    }
    if (["panel", "panel_supply", "panel_distribution"].includes(tool)) {
      const id = uid();
      onChange((d) => {
        const kind = tool === "panel_supply" ? "supply" as const : tool === "panel_distribution" ? "distribution" as const : (d.panels.some((p) => (p.kind ?? "distribution") === "supply") ? "distribution" as const : "supply" as const);
        const count = d.panels.filter((p) => (p.kind ?? "distribution") === kind).length + 1;
        const prefix = kind === "supply" ? "QA" : "QD";
        const supply = kind === "distribution" ? d.panels.find((p) => (p.kind ?? "distribution") === "supply") : undefined;
        return { ...d, panels: [...d.panels, { id, name: `${prefix}-${String(count).padStart(2, "0")}`, x: snap(w.x), y: snap(w.y), rotation: 0, kind, upstreamPanelId: supply?.id ?? null }] };
      });
      onSelect({ type: "panel", id }); onToolDone();
    }
  };

  const onMouseMove = (e: React.MouseEvent) => {
    const drag = dragRef.current;
    if (drag?.kind === "pan") { setView((v) => ({ ...v, x: e.clientX - drag.ox, y: e.clientY - drag.oy })); return; }
    if (drag?.kind === "room-label") {
      const w = toWorld(e.clientX, e.clientY), labelX = w.x - drag.ox, labelY = w.y - drag.oy;
      onChange((d) => ({ ...d, rooms: d.rooms.map((room) => room.id === drag.id ? { ...room, labelX, labelY } : room) })); return;
    }
    if (drag?.kind === "conduit-bend") {
      const w = toWorld(e.clientX, e.clientY), next = { x: snap(w.x), y: snap(w.y) };
      onChange((d) => ({ ...d, conduits: d.conduits.map((c) => c.id === drag.id ? { ...c, route: (c.route ?? []).map((p, i) => i === drag.index ? next : p) } : c) })); return;
    }
    if (drag?.kind === "move") {
      const w = toWorld(e.clientX, e.clientY), nx = snap(w.x - drag.ox), ny = snap(w.y - drag.oy);
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
        return { ...d, rooms: d.rooms.map((r) => r.id === drag.id ? { ...r, x: nx, y: ny, labelX: r.labelX == null ? undefined : r.labelX + dx, labelY: r.labelY == null ? undefined : r.labelY + dy, points: r.points?.map((p) => ({ x: p.x + dx, y: p.y + dy })) } : r) };
      }); return;
    }
    const w = toWorld(e.clientX, e.clientY);
    if (drawRect) setDrawRect({ ...drawRect, x1: snap(w.x), y1: snap(w.y) });
    if (segment) setSegment({ ...segment, x1: snap(w.x), y1: snap(w.y) });
  };

  const endInteraction = () => {
    dragRef.current = null;
    if (drawRect) {
      const x = Math.min(drawRect.x0, drawRect.x1), y = Math.min(drawRect.y0, drawRect.y1), w = Math.abs(drawRect.x1 - drawRect.x0), h = Math.abs(drawRect.y1 - drawRect.y0);
      setDrawRect(null);
      if (w >= 0.5 && h >= 0.5) { const id = uid(); onChange((d) => ({ ...d, rooms: [...d.rooms, { id, name: `Ambiente ${d.rooms.length + 1}`, x, y, w, h }] })); onSelect({ type: "room", id }); onToolDone(); }
    }
    if (segment) {
      const draft = segment; setSegment(null);
      if (Math.hypot(draft.x1 - draft.x0, draft.y1 - draft.y0) >= 0.25) {
        const id = uid();
        const element = { id, kind: draft.kind, x1: draft.x0, y1: draft.y0, x2: draft.x1, y2: draft.y1, thickness: draft.kind === "wall" ? 0.15 : undefined, openingDirection: draft.kind === "door" ? "left" : undefined, ...(draft.kind === "door" ? { openingAngle: 90, openingSide: "down" as const } : {}) } as PlanDocument["architecture"][number];
        onChange((d) => ({ ...d, architecture: [...d.architecture, element] })); onSelect({ type: "architecture", id }); if (draft.kind !== "wall") onToolDone();
      }
    }
  };

  const startMove = (e: React.MouseEvent, type: string, id: string, px: number, py: number) => {
    if (tool !== "select") return; e.stopPropagation(); const w = toWorld(e.clientX, e.clientY);
    dragRef.current = { kind: "move", type, id, ox: w.x - px, oy: w.y - py }; onSelect({ type: type as NonNullable<Selection>["type"], id });
  };
  const startRoomLabelMove = (e: React.MouseEvent, id: string, px: number, py: number) => { if (tool !== "select") return; e.stopPropagation(); const w = toWorld(e.clientX, e.clientY); dragRef.current = { kind: "room-label", id, ox: w.x - px, oy: w.y - py }; onSelect({ type: "room", id }); };
  const startBendMove = (e: React.MouseEvent, id: string, index: number) => { if (tool !== "select") return; e.stopPropagation(); dragRef.current = { kind: "conduit-bend", id, index }; onSelect({ type: "conduit", id }); };
  const handleNodeClick = (e: React.MouseEvent, id: string) => {
    if (tool !== "conduit") return; e.stopPropagation();
    if (!conduitFrom) { setConduitFrom(id); return; }
    if (conduitFrom === id) { setConduitFrom(null); return; }
    const a = nodePosition(doc, conduitFrom), b = nodePosition(doc, id), route = a && b && Math.abs(a.x - b.x) > 0.01 && Math.abs(a.y - b.y) > 0.01 ? [{ x: b.x, y: a.y }] : [], cid = uid();
    onChange((d) => ({ ...d, conduits: [...d.conduits, { id: cid, from: conduitFrom, to: id, diameter: 25, type: "normal", route }] })); setConduitFrom(id); onSelect({ type: "conduit", id: cid });
  };

  const isSel = (type: string, id: string) => selection?.type === type && selection.id === id;
  const cursor = tool === "navigate" ? "grab" : tool === "select" ? "default" : ["room", "room_free", "wall", "door", "passage", "window"].includes(tool) ? "crosshair" : tool === "conduit" ? "cell" : "copy";
  const wireRuns = getWireRuns(doc);

  return <svg ref={svgRef} className="h-full w-full select-none blueprint-surface" style={{ cursor }} onWheel={handleWheel} onMouseDown={onBackgroundDown} onMouseMove={onMouseMove} onMouseUp={endInteraction} onMouseLeave={endInteraction} onContextMenu={(e) => e.preventDefault()}>
    <g transform={`translate(${view.x} ${view.y}) scale(${view.z})`}>
      {visible.arquitetura && doc.rooms.map((r) => {
        const selected = isSel("room", r.id), labelWorldX = r.labelX ?? (r.x + 10 / PX_PER_M), labelWorldY = r.labelY ?? (r.y + 22 / PX_PER_M), labelX = labelWorldX * PX_PER_M, labelY = labelWorldY * PX_PER_M, anchorWorldX = r.x + r.w / 2, anchorWorldY = r.y + r.h / 2, anchorX = anchorWorldX * PX_PER_M, anchorY = anchorWorldY * PX_PER_M;
        const roomShapeProps = { onMouseDown: (e: React.MouseEvent<SVGElement>) => startMove(e, "room", r.id, r.x, r.y) };
        return <g key={r.id}>{r.points && r.points.length >= 3 ? <polygon {...roomShapeProps} points={r.points.map((p) => `${p.x * PX_PER_M},${p.y * PX_PER_M}`).join(" ")} fill="var(--surface)" fillOpacity={0.55} stroke={selected ? "var(--primary)" : "var(--wall)"} strokeWidth={selected ? 4 : 3} /> : <rect {...roomShapeProps} x={r.x * PX_PER_M} y={r.y * PX_PER_M} width={r.w * PX_PER_M} height={r.h * PX_PER_M} fill="var(--surface)" fillOpacity={0.55} stroke={selected ? "var(--primary)" : "var(--wall)"} strokeWidth={selected ? 4 : 3} />}<line x1={anchorX} y1={anchorY} x2={labelX - 5} y2={labelY} stroke={selected ? "var(--primary)" : "var(--muted-foreground)"} strokeWidth={0.9} opacity={0.7} pointerEvents="none" /><circle cx={anchorX} cy={anchorY} r={2.2} fill={selected ? "var(--primary)" : "var(--muted-foreground)"} opacity={0.75} pointerEvents="none" /><g onMouseDown={(e) => startRoomLabelMove(e, r.id, labelWorldX, labelWorldY)}><text x={labelX} y={labelY} fill="var(--foreground)" fontSize={13}>{r.name}</text><text x={labelX} y={labelY + 16} fill="var(--muted-foreground)" fontSize={11}>{r.points ? `forma livre · ${roomArea(r).toFixed(2)} m²` : `${r.w.toFixed(2)} × ${r.h.toFixed(2)} m · ${roomArea(r).toFixed(2)} m²`}</text></g></g>;
      })}

      {visible.arquitetura && doc.architecture.map((a) => {
        const architecturalKind = String(a.kind), x1 = a.x1 * PX_PER_M, y1 = a.y1 * PX_PER_M, x2 = a.x2 * PX_PER_M, y2 = a.y2 * PX_PER_M, selected = isSel("architecture", a.id), dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1, nx = -dy / len, ny = dx / len, door = architecturalKind === "door" ? a as DoorElement : null, openingAngle = Math.min(180, Math.max(15, door?.openingAngle ?? 90));
        let hingeX = x1, hingeY = y1, freeX = x2, freeY = y2; if (door?.openingDirection === "right") { hingeX = x2; hingeY = y2; freeX = x1; freeY = y1; }
        const closedDx = freeX - hingeX, closedDy = freeY - hingeY, angleRad = openingAngle * Math.PI / 180, positiveX = hingeX + closedDx * Math.cos(angleRad) - closedDy * Math.sin(angleRad), positiveY = hingeY + closedDx * Math.sin(angleRad) + closedDy * Math.cos(angleRad), negativeX = hingeX + closedDx * Math.cos(-angleRad) - closedDy * Math.sin(-angleRad), negativeY = hingeY + closedDx * Math.sin(-angleRad) + closedDy * Math.cos(-angleRad), positiveSide = dx * (positiveY - hingeY) - dy * (positiveX - hingeX), negativeSide = dx * (negativeY - hingeY) - dy * (negativeX - hingeX), wantsOutside = (door?.openingSide ?? "down") === "up", usePositive = wantsOutside ? positiveSide < negativeSide : positiveSide >= negativeSide, openX = usePositive ? positiveX : negativeX, openY = usePositive ? positiveY : negativeY, sweep = usePositive ? 1 : 0;
        return <g key={a.id} onMouseDown={(e) => startMove(e, "architecture", a.id, a.x1, a.y1)}>{architecturalKind === "wall" && <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={selected ? "var(--primary)" : "var(--wall)"} strokeWidth={Math.max(4, (a.thickness ?? 0.15) * PX_PER_M)} />}{architecturalKind === "window" && <><line x1={x1 + nx * 3} y1={y1 + ny * 3} x2={x2 + nx * 3} y2={y2 + ny * 3} stroke="var(--foreground)" strokeWidth={2} /><line x1={x1 - nx * 3} y1={y1 - ny * 3} x2={x2 - nx * 3} y2={y2 - ny * 3} stroke="var(--foreground)" strokeWidth={2} /></>}{architecturalKind === "passage" && <><line x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--surface)" strokeWidth={10} /><line x1={x1 - nx * 5} y1={y1 - ny * 5} x2={x1 + nx * 5} y2={y1 + ny * 5} stroke="var(--foreground)" strokeWidth={1.8} /><line x1={x2 - nx * 5} y1={y2 - ny * 5} x2={x2 + nx * 5} y2={y2 + ny * 5} stroke="var(--foreground)" strokeWidth={1.8} /></>}{door && <><line x1={hingeX} y1={hingeY} x2={openX} y2={openY} stroke={selected ? "var(--primary)" : "var(--foreground)"} strokeWidth={2.5} /><path d={`M ${freeX} ${freeY} A ${len} ${len} 0 0 ${sweep} ${openX} ${openY}`} fill="none" stroke="var(--muted-foreground)" strokeWidth={1.2} strokeDasharray="4 3" /><circle cx={hingeX} cy={hingeY} r={2.5} fill="var(--foreground)" /></>}</g>;
      })}

      {visible.eletrodutos && doc.conduits.map((c) => { const path = conduitPath(doc, c); if (path.length < 2) return null; const selected = isSel("conduit", c.id), middle = path[Math.floor(path.length / 2)], stroke = selected ? "var(--primary)" : "var(--layer-conduit)", dash = c.type === "underground" ? "3 5" : undefined; return <g key={c.id} onMouseDown={(e) => { if (tool === "navigate") return; e.stopPropagation(); onSelect({ type: "conduit", id: c.id }); }}><polyline points={path.map((p) => `${p.x * PX_PER_M},${p.y * PX_PER_M}`).join(" ")} fill="none" stroke={stroke} strokeWidth={selected ? 3.5 : 2.5} strokeDasharray={dash} /><text x={middle.x * PX_PER_M} y={middle.y * PX_PER_M - 7} textAnchor="middle" fill="var(--layer-conduit)" fontSize={10}>{fmtM(conduitLength(doc, c))}</text>{selected && (c.route ?? []).map((p, index) => <circle key={index} cx={p.x * PX_PER_M} cy={p.y * PX_PER_M} r={5.5} fill="var(--surface)" stroke="var(--primary)" strokeWidth={2} onMouseDown={(e) => startBendMove(e, c.id, index)} />)}</g>; })}

      {visible.fiacao && wireRuns.flatMap((run) => run.conduitIds.map((conduitId, index) => { const conduit = doc.conduits.find((c) => c.id === conduitId); if (!conduit) return null; const path = conduitPath(doc, conduit); if (path.length < 2) return null; const middle = path[Math.floor(path.length / 2)]; return <g key={`${run.id}-${conduitId}`} pointerEvents="none"><polyline points={path.map((p) => `${p.x * PX_PER_M},${p.y * PX_PER_M}`).join(" ")} fill="none" stroke="var(--primary)" strokeWidth={1.1} strokeDasharray="1 3" />{index === 0 && <text x={middle.x * PX_PER_M} y={middle.y * PX_PER_M + 11} textAnchor="middle" fill="var(--primary)" fontSize={8.5}>{run.circuitId}: {run.roles.join("/")}</text>}</g>; }))}

      {visible.quadro && doc.panels.map((p) => { const isSupply = (p.kind ?? "distribution") === "supply", selected = isSel("panel", p.id) || conduitFrom === p.id, cx = p.x * PX_PER_M, cy = p.y * PX_PER_M; return <g key={p.id} transform={`rotate(${p.rotation ?? 0} ${cx} ${cy})`} onMouseDown={(e) => startMove(e, "panel", p.id, p.x, p.y)} onClick={(e) => handleNodeClick(e, p.id)}><rect x={cx - 22} y={cy - 17} width={44} height={34} rx={3} fill="var(--surface)" stroke={selected ? "var(--primary)" : "var(--layer-panel)"} strokeWidth={2.2} />{isSupply ? <><rect x={cx - 18} y={cy - 13} width={36} height={26} fill="none" stroke="var(--layer-panel)" /><path d={`M ${cx - 3} ${cy - 10} L ${cx + 3} ${cy - 2} L ${cx} ${cy - 2} L ${cx + 4} ${cy + 9} L ${cx - 5} ${cy + 1} L ${cx - 1} ${cy + 1} Z`} fill="var(--layer-panel)" /></> : <><line x1={cx - 15} y1={cy - 8} x2={cx + 15} y2={cy - 8} stroke="var(--layer-panel)" /><line x1={cx - 15} y1={cy} x2={cx + 15} y2={cy} stroke="var(--layer-panel)" /><line x1={cx - 15} y1={cy + 8} x2={cx + 15} y2={cy + 8} stroke="var(--layer-panel)" /></>}<text x={cx} y={cy + 4} textAnchor="middle" fill={selected ? "var(--primary)" : "var(--layer-panel)"} fontSize={10} fontWeight="700">{isSupply ? "QA" : "QD"}</text><text x={cx} y={cy + 29} textAnchor="middle" fill="var(--layer-panel)" fontSize={9.5}>{p.name}</text></g>; })}

      {doc.points.map((p) => { const def = CATALOG_BY_KIND[p.kind]; if (!def || !visible[def.layer]) return null; const active = isSel("point", p.id) || conduitFrom === p.id, mirror = p.mirrored ? -1 : 1; return <g key={p.id} transform={`translate(${p.x * PX_PER_M} ${p.y * PX_PER_M}) rotate(${p.rotation ?? 0}) scale(${mirror} 1)`} onMouseDown={(e) => startMove(e, "point", p.id, p.x, p.y)} onClick={(e) => handleNodeClick(e, p.id)} onDoubleClick={(e) => { e.stopPropagation(); onSelect({ type: "point", id: p.id }); setEditingPointId(p.id); }}>{active && <circle r={16} fill="var(--primary)" fillOpacity={0.18} stroke="var(--primary)" strokeWidth={1.5} />}<SymbolGlyph kind={p.kind} height={p.height} /><text y={22} textAnchor="middle" fill={kindColor(p.kind)} fontSize={9.5} transform={`scale(${mirror} 1)`}>{p.label}{p.circuit ? ` · ${p.circuit}` : ""}</text></g>; })}

      {drawRect && <rect x={Math.min(drawRect.x0, drawRect.x1) * PX_PER_M} y={Math.min(drawRect.y0, drawRect.y1) * PX_PER_M} width={Math.abs(drawRect.x1 - drawRect.x0) * PX_PER_M} height={Math.abs(drawRect.y1 - drawRect.y0) * PX_PER_M} fill="var(--primary)" fillOpacity={0.1} stroke="var(--primary)" strokeWidth={2} strokeDasharray="6 4" />}
      {roomPolygon.length > 0 && <g><polyline points={roomPolygon.map((p) => `${p.x * PX_PER_M},${p.y * PX_PER_M}`).join(" ")} fill="none" stroke="var(--primary)" strokeWidth={2.5} />{roomPolygon.map((p, i) => <circle key={i} cx={p.x * PX_PER_M} cy={p.y * PX_PER_M} r={i === 0 ? 6 : 4} fill="var(--surface)" stroke="var(--primary)" strokeWidth={2} />)}</g>}
      {segment && <line x1={segment.x0 * PX_PER_M} y1={segment.y0 * PX_PER_M} x2={segment.x1 * PX_PER_M} y2={segment.y1 * PX_PER_M} stroke="var(--primary)" strokeWidth={segment.kind === "wall" ? 7 : 3} strokeDasharray={segment.kind === "wall" ? undefined : "6 4"} />}
    </g>

    {editingPoint && <foreignObject x="18" y="48" width="390" height="520">
      <div xmlns="http://www.w3.org/1999/xhtml" className="rounded-xl border border-border bg-popover p-4 text-popover-foreground shadow-2xl" onMouseDown={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between gap-3">
          <div><p className="text-sm font-semibold">Editar ponto</p><p className="text-xs text-muted-foreground">Duplo clique abre esta edição rápida</p></div>
          <button type="button" className="rounded px-2 py-1 text-sm hover:bg-accent" onClick={() => setEditingPointId(null)}>✕</button>
        </div>
        <div className="grid gap-2 text-xs">
          <label className="grid gap-1">Sistema / tipo<select className="h-9 rounded-md border border-input bg-background px-2 text-sm" value={editingPoint.kind} onChange={(e) => changeEditingKind(e.target.value as ComponentKind)}>{CATALOG.map((item) => <option key={item.kind} value={item.kind}>{item.label}</option>)}</select></label>
          <label className="grid gap-1">Identificação<input className="h-9 rounded-md border border-input bg-background px-2 text-sm" value={editingPoint.label} onChange={(e) => patchEditingPoint({ label: e.target.value })} /></label>
          <div className="grid grid-cols-2 gap-2">
            <label className="grid gap-1">Potência (W/VA)<input className="h-9 rounded-md border border-input bg-background px-2 text-sm" type="number" min="0" value={editingPoint.power} onChange={(e) => patchEditingPoint({ power: Number(e.target.value) || 0 })} /></label>
            <label className="grid gap-1">Tensão (V)<select className="h-9 rounded-md border border-input bg-background px-2 text-sm" value={editingPoint.voltage} onChange={(e) => patchEditingPoint({ voltage: Number(e.target.value) })}><option value="127">127 V</option><option value="220">220 V</option></select></label>
            <label className="grid gap-1">Altura (m)<input className="h-9 rounded-md border border-input bg-background px-2 text-sm" type="number" min="0" step="0.05" value={editingPoint.height} onChange={(e) => patchEditingPoint({ height: Math.max(0, Number(e.target.value) || 0) })} /></label>
            <label className="grid gap-1">Circuito<input className="h-9 rounded-md border border-input bg-background px-2 text-sm" placeholder="C01" value={editingPoint.circuit} onChange={(e) => patchEditingPoint({ circuit: e.target.value.toUpperCase() })} /></label>
          </div>
          {CATALOG_BY_KIND[editingPoint.kind]?.layer === "tomadas" && <div className="grid grid-cols-3 gap-1.5 pt-1">
            <button type="button" className={`rounded-md border px-2 py-2 ${editingPoint.height < 0.8 ? "border-primary bg-primary text-primary-foreground" : "border-border bg-secondary"}`} onClick={() => patchEditingPoint({ height: 0.3 })}>Baixa</button>
            <button type="button" className={`rounded-md border px-2 py-2 ${editingPoint.height >= 0.8 && editingPoint.height < 1.8 ? "border-primary bg-primary text-primary-foreground" : "border-border bg-secondary"}`} onClick={() => patchEditingPoint({ height: 1.3 })}>Média</button>
            <button type="button" className={`rounded-md border px-2 py-2 ${editingPoint.height >= 1.8 ? "border-primary bg-primary text-primary-foreground" : "border-border bg-secondary"}`} onClick={() => patchEditingPoint({ height: 2 })}>Alta</button>
          </div>}
          <label className="grid gap-1">Observações<textarea className="min-h-16 rounded-md border border-input bg-background p-2 text-sm" value={editingPoint.notes ?? ""} onChange={(e) => patchEditingPoint({ notes: e.target.value })} /></label>
          <div className="flex justify-end pt-1"><button type="button" className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground" onClick={() => setEditingPointId(null)}>Concluir</button></div>
        </div>
      </div>
    </foreignObject>}

    <g><rect x={12} y={12} width={240} height={26} rx={4} fill="var(--surface)" fillOpacity={0.9} /><text x={22} y={29} fill="var(--muted-foreground)" fontSize={11}>zoom {(view.z * 100).toFixed(0)}% · grade {GRID_M * 100}cm</text></g>
  </svg>;
}