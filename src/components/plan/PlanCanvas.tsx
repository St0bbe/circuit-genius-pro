import { useCallback, useEffect, useRef, useState } from "react";
import {
  CATALOG_BY_KIND,
  GRID_M,
  PX_PER_M,
  conduitLength,
  fmtM,
  nextLabel,
  nodePosition,
  snap,
  uid,
  type ComponentKind,
  type LayerId,
  type PlanDocument,
} from "@/lib/electrical";
import { SymbolGlyph, kindColor } from "./SymbolGlyph";

export type Tool = "select" | "room" | "point" | "panel" | "conduit";
export type Selection = { type: "room" | "point" | "panel" | "conduit"; id: string } | null;

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

export function PlanCanvas({
  doc,
  onChange,
  tool,
  activeKind,
  visible,
  selection,
  onSelect,
  onToolDone,
}: Props) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [view, setView] = useState({ x: 80, y: 80, z: 1 });
  const [drawRect, setDrawRect] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  const [conduitFrom, setConduitFrom] = useState<string | null>(null);
  const dragRef = useRef<{ kind: "pan" | "move"; id?: string; type?: string; ox: number; oy: number } | null>(null);

  const toWorld = useCallback(
    (clientX: number, clientY: number) => {
      const rect = svgRef.current?.getBoundingClientRect();
      if (!rect) return { x: 0, y: 0 };
      return {
        x: (clientX - rect.left - view.x) / view.z / PX_PER_M,
        y: (clientY - rect.top - view.y) / view.z / PX_PER_M,
      };
    },
    [view],
  );

  useEffect(() => {
    if (tool !== "conduit") setConduitFrom(null);
  }, [tool]);

  const handleWheel = (e: React.WheelEvent) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
    const nz = Math.min(4, Math.max(0.25, view.z * factor));
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    setView({
      z: nz,
      x: mx - ((mx - view.x) * nz) / view.z,
      y: my - ((my - view.y) * nz) / view.z,
    });
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
    if (tool === "point") {
      const def = CATALOG_BY_KIND[activeKind];
      const id = uid();
      onChange((d) => ({
        ...d,
        points: [
          ...d.points,
          {
            id,
            kind: activeKind,
            x: snap(w.x),
            y: snap(w.y),
            label: nextLabel(d, activeKind),
            power: def.power,
            voltage: def.voltage,
            height: def.height,
            circuit: "",
          },
        ],
      }));
      onSelect({ type: "point", id });
      return;
    }
    if (tool === "panel") {
      const id = uid();
      onChange((d) => ({
        ...d,
        panels: [
          ...d.panels,
          { id, name: `QD-${String(d.panels.length + 1).padStart(2, "0")}`, x: snap(w.x), y: snap(w.y) },
        ],
      }));
      onSelect({ type: "panel", id });
      onToolDone();
    }
  };

  const onMouseMove = (e: React.MouseEvent) => {
    const drag = dragRef.current;
    if (drag?.kind === "pan") {
      setView((v) => ({ ...v, x: e.clientX - drag.ox, y: e.clientY - drag.oy }));
      return;
    }
    if (drag?.kind === "move" && drag.id) {
      const w = toWorld(e.clientX, e.clientY);
      const nx = snap(w.x - drag.ox);
      const ny = snap(w.y - drag.oy);
      onChange((d) => {
        if (drag.type === "point")
          return { ...d, points: d.points.map((p) => (p.id === drag.id ? { ...p, x: nx, y: ny } : p)) };
        if (drag.type === "panel")
          return { ...d, panels: d.panels.map((p) => (p.id === drag.id ? { ...p, x: nx, y: ny } : p)) };
        return { ...d, rooms: d.rooms.map((r) => (r.id === drag.id ? { ...r, x: nx, y: ny } : r)) };
      });
      return;
    }
    if (drawRect) {
      const w = toWorld(e.clientX, e.clientY);
      setDrawRect({ ...drawRect, x1: snap(w.x), y1: snap(w.y) });
    }
  };

  const endInteraction = () => {
    dragRef.current = null;
    if (drawRect) {
      const x = Math.min(drawRect.x0, drawRect.x1);
      const y = Math.min(drawRect.y0, drawRect.y1);
      const w = Math.abs(drawRect.x1 - drawRect.x0);
      const h = Math.abs(drawRect.y1 - drawRect.y0);
      setDrawRect(null);
      if (w >= 0.5 && h >= 0.5) {
        const id = uid();
        onChange((d) => ({
          ...d,
          rooms: [...d.rooms, { id, name: `Ambiente ${d.rooms.length + 1}`, x, y, w, h }],
        }));
        onSelect({ type: "room", id });
        onToolDone();
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

  const handleNodeClick = (e: React.MouseEvent, id: string) => {
    if (tool !== "conduit") return;
    e.stopPropagation();
    if (!conduitFrom) {
      setConduitFrom(id);
      return;
    }
    if (conduitFrom === id) {
      setConduitFrom(null);
      return;
    }
    const cid = uid();
    onChange((d) => ({
      ...d,
      conduits: [...d.conduits, { id: cid, from: conduitFrom, to: id, diameter: 25 }],
    }));
    setConduitFrom(id);
    onSelect({ type: "conduit", id: cid });
  };

  const isSel = (type: string, id: string) => selection?.type === type && selection.id === id;
  const cursor =
    tool === "select" ? "default" : tool === "room" ? "crosshair" : tool === "conduit" ? "cell" : "copy";

  return (
    <svg
      ref={svgRef}
      className="h-full w-full select-none blueprint-surface"
      style={{ cursor }}
      onWheel={handleWheel}
      onMouseDown={onBackgroundDown}
      onMouseMove={onMouseMove}
      onMouseUp={endInteraction}
      onMouseLeave={endInteraction}
      onContextMenu={(e) => e.preventDefault()}
    >
      <g transform={`translate(${view.x} ${view.y}) scale(${view.z})`}>
        {/* ambientes */}
        {visible.arquitetura &&
          doc.rooms.map((r) => (
            <g key={r.id} onMouseDown={(e) => startMove(e, "room", r.id, r.x, r.y)}>
              <rect
                x={r.x * PX_PER_M}
                y={r.y * PX_PER_M}
                width={r.w * PX_PER_M}
                height={r.h * PX_PER_M}
                fill="var(--surface)"
                fillOpacity={0.55}
                stroke={isSel("room", r.id) ? "var(--primary)" : "var(--wall)"}
                strokeWidth={isSel("room", r.id) ? 4 : 3}
              />
              <text
                x={r.x * PX_PER_M + 10}
                y={r.y * PX_PER_M + 22}
                fill="var(--foreground)"
                fontSize={13}
                fontFamily="var(--font-sans)"
              >
                {r.name}
              </text>
              <text
                x={r.x * PX_PER_M + 10}
                y={r.y * PX_PER_M + 38}
                fill="var(--muted-foreground)"
                fontSize={11}
                fontFamily="var(--font-mono)"
              >
                {r.w.toFixed(2)} × {r.h.toFixed(2)} m · {(r.w * r.h).toFixed(2)} m²
              </text>
            </g>
          ))}

        {/* eletrodutos */}
        {visible.eletrodutos &&
          doc.conduits.map((c) => {
            const a = nodePosition(doc, c.from);
            const b = nodePosition(doc, c.to);
            if (!a || !b) return null;
            const mid = { x: ((a.x + b.x) / 2) * PX_PER_M, y: ((a.y + b.y) / 2) * PX_PER_M };
            return (
              <g key={c.id} onMouseDown={(e) => { e.stopPropagation(); onSelect({ type: "conduit", id: c.id }); }}>
                <line
                  x1={a.x * PX_PER_M}
                  y1={a.y * PX_PER_M}
                  x2={b.x * PX_PER_M}
                  y2={b.y * PX_PER_M}
                  stroke={isSel("conduit", c.id) ? "var(--primary)" : "var(--layer-conduit)"}
                  strokeWidth={isSel("conduit", c.id) ? 3.5 : 2.5}
                  strokeDasharray="8 5"
                />
                <text
                  x={mid.x}
                  y={mid.y - 6}
                  textAnchor="middle"
                  fill="var(--layer-conduit)"
                  fontSize={10}
                  fontFamily="var(--font-mono)"
                >
                  {fmtM(conduitLength(doc, c))}
                </text>
              </g>
            );
          })}

        {/* quadros */}
        {visible.quadro &&
          doc.panels.map((p) => (
            <g
              key={p.id}
              onMouseDown={(e) => startMove(e, "panel", p.id, p.x, p.y)}
              onClick={(e) => handleNodeClick(e, p.id)}
              style={{ cursor: tool === "conduit" ? "cell" : "move" }}
            >
              <rect
                x={p.x * PX_PER_M - 20}
                y={p.y * PX_PER_M - 14}
                width={40}
                height={28}
                rx={3}
                fill="var(--surface)"
                stroke={isSel("panel", p.id) || conduitFrom === p.id ? "var(--primary)" : "var(--layer-panel)"}
                strokeWidth={2}
              />
              <text
                x={p.x * PX_PER_M}
                y={p.y * PX_PER_M + 4}
                textAnchor="middle"
                fill="var(--layer-panel)"
                fontSize={11}
                fontFamily="var(--font-mono)"
              >
                {p.name}
              </text>
            </g>
          ))}

        {/* pontos */}
        {doc.points.map((p) => {
          const def = CATALOG_BY_KIND[p.kind];
          if (!def || !visible[def.layer]) return null;
          const active = isSel("point", p.id) || conduitFrom === p.id;
          return (
            <g
              key={p.id}
              transform={`translate(${p.x * PX_PER_M} ${p.y * PX_PER_M})`}
              onMouseDown={(e) => startMove(e, "point", p.id, p.x, p.y)}
              onClick={(e) => handleNodeClick(e, p.id)}
              style={{ cursor: tool === "conduit" ? "cell" : "move" }}
            >
              {active && <circle r={16} fill="var(--primary)" fillOpacity={0.18} stroke="var(--primary)" strokeWidth={1.5} />}
              <SymbolGlyph kind={p.kind} />
              <text
                y={22}
                textAnchor="middle"
                fill={kindColor(p.kind)}
                fontSize={9.5}
                fontFamily="var(--font-mono)"
              >
                {p.label}
                {p.circuit ? ` · ${p.circuit}` : ""}
              </text>
            </g>
          );
        })}

        {/* retângulo em desenho */}
        {drawRect && (
          <rect
            x={Math.min(drawRect.x0, drawRect.x1) * PX_PER_M}
            y={Math.min(drawRect.y0, drawRect.y1) * PX_PER_M}
            width={Math.abs(drawRect.x1 - drawRect.x0) * PX_PER_M}
            height={Math.abs(drawRect.y1 - drawRect.y0) * PX_PER_M}
            fill="var(--primary)"
            fillOpacity={0.1}
            stroke="var(--primary)"
            strokeWidth={2}
            strokeDasharray="6 4"
          />
        )}
      </g>

      <g>
        <rect x={12} y={12} width={190} height={26} rx={4} fill="var(--surface)" fillOpacity={0.9} />
        <text x={22} y={29} fill="var(--muted-foreground)" fontSize={11} fontFamily="var(--font-mono)">
          zoom {(view.z * 100).toFixed(0)}% · grade {GRID_M * 100}cm
        </text>
      </g>
    </svg>
  );
}
