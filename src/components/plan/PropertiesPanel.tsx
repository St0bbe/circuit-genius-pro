import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  CATALOG,
  CATALOG_BY_KIND,
  architectureLength,
  conduitLength,
  conduitPath,
  fmtM,
  nodePosition,
  roomArea,
  roomPerimeter,
  type ComponentKind,
  type ConduitType,
  type PlanDocument,
  type PlanSummary,
} from "@/lib/electrical";
import type { Selection } from "./PlanCanvas";

type Props = { doc: PlanDocument; selection: Selection; summary: PlanSummary; onChange: (updater: (doc: PlanDocument) => PlanDocument) => void; onSelect: (sel: Selection) => void };
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div className="space-y-1"><Label className="tech-label">{label}</Label>{children}</div>; }
function Row({ k, v }: { k: string; v: string }) { return <div className="flex items-baseline justify-between gap-2 border-b border-border/60 py-1.5 last:border-0"><span className="text-xs text-muted-foreground">{k}</span><span className="font-mono text-sm">{v}</span></div>; }

const OUTLET_KINDS = CATALOG.filter((item) => item.group === "Tomadas");
const outletLevel = (height: number) => height >= 1.8 ? "Alta" : height >= 0.8 ? "Média" : "Baixa";

export function PropertiesPanel({ doc, selection, summary, onChange, onSelect }: Props) {
  const remove = () => {
    if (!selection) return;
    const { type, id } = selection;
    onChange((d) => {
      if (type === "room") return { ...d, rooms: d.rooms.filter((r) => r.id !== id) };
      if (type === "architecture") return { ...d, architecture: d.architecture.filter((a) => a.id !== id) };
      if (type === "conduit") return { ...d, conduits: d.conduits.filter((c) => c.id !== id) };
      if (type === "panel") return { ...d, panels: d.panels.filter((p) => p.id !== id), conduits: d.conduits.filter((c) => c.from !== id && c.to !== id) };
      return { ...d, points: d.points.filter((p) => p.id !== id), conduits: d.conduits.filter((c) => c.from !== id && c.to !== id) };
    });
    onSelect(null);
  };

  const point = selection?.type === "point" ? doc.points.find((p) => p.id === selection.id) : undefined;
  const room = selection?.type === "room" ? doc.rooms.find((r) => r.id === selection.id) : undefined;
  const architecture = selection?.type === "architecture" ? doc.architecture.find((a) => a.id === selection.id) : undefined;
  const panel = selection?.type === "panel" ? doc.panels.find((p) => p.id === selection.id) : undefined;
  const conduit = selection?.type === "conduit" ? doc.conduits.find((c) => c.id === selection.id) : undefined;
  const isOutlet = point ? CATALOG_BY_KIND[point.kind]?.layer === "tomadas" : false;

  const patchPoint = (patch: Partial<NonNullable<typeof point>>) => {
    if (!point) return;
    onChange((d) => ({ ...d, points: d.points.map((p) => p.id === point.id ? { ...p, ...patch } : p) }));
  };

  const changePointKind = (kind: ComponentKind) => {
    const def = CATALOG_BY_KIND[kind];
    if (!def) return;
    patchPoint({ kind, power: def.power, voltage: def.voltage, height: def.height });
  };

  const addConduitBend = () => {
    if (!conduit) return;
    const path = conduitPath(doc, conduit);
    if (path.length < 2) return;
    const a = path[path.length - 2], b = path[path.length - 1];
    const bend = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    onChange((d) => ({ ...d, conduits: d.conduits.map((c) => c.id === conduit.id ? { ...c, route: [...(c.route ?? []), bend] } : c) }));
  };

  return <div className="flex h-full flex-col overflow-y-auto border-l border-border bg-sidebar p-3">
    <p className="tech-label mb-3">Propriedades</p>
    {!selection && <div className="rounded-md border border-dashed border-border p-3 text-sm text-muted-foreground">Selecione um ambiente, elemento arquitetônico, ponto, quadro ou eletroduto para editar.</div>}

    {point && <div className="space-y-3">
      <div><p className="font-mono text-base text-primary">{point.label}</p><p className="text-xs text-muted-foreground">{CATALOG_BY_KIND[point.kind]?.label}</p></div>
      <Field label="Identificação"><Input value={point.label} onChange={(e) => patchPoint({ label: e.target.value })} /></Field>

      {isOutlet && <>
        <Field label="Tipo de tomada">
          <select className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm" value={point.kind} onChange={(e) => changePointKind(e.target.value as ComponentKind)}>
            {OUTLET_KINDS.map((item) => <option key={item.kind} value={item.kind}>{item.label}</option>)}
          </select>
        </Field>
        <div className="space-y-1">
          <Label className="tech-label">Altura / símbolo</Label>
          <div className="grid grid-cols-3 gap-1.5">
            <Button size="sm" variant={point.height < 0.8 ? "default" : "secondary"} onClick={() => patchPoint({ height: 0.3 })}>Baixa 0,30 m</Button>
            <Button size="sm" variant={point.height >= 0.8 && point.height < 1.8 ? "default" : "secondary"} onClick={() => patchPoint({ height: 1.3 })}>Média 1,30 m</Button>
            <Button size="sm" variant={point.height >= 1.8 ? "default" : "secondary"} onClick={() => patchPoint({ height: 2 })}>Alta 2,00 m</Button>
          </div>
          <p className="text-[11px] text-muted-foreground">Convenção NBR 5444: baixa vazada, média meio preenchida e alta preenchida. Uma altura personalizada mantém a faixa visual correspondente.</p>
        </div>
      </>}

      <div className="grid grid-cols-2 gap-2">
        <Field label="Potência (W / VA)"><Input type="number" min="0" value={point.power} onChange={(e) => patchPoint({ power: Number(e.target.value) || 0 })} /></Field>
        <Field label="Tensão (V)"><Input type="number" value={point.voltage} onChange={(e) => patchPoint({ voltage: Number(e.target.value) || 0 })} /></Field>
        <Field label="Altura (m)"><Input type="number" step="0.05" value={point.height} onChange={(e) => patchPoint({ height: Math.max(0, Number(e.target.value) || 0) })} /></Field>
        <Field label="Circuito"><Input placeholder="C01" value={point.circuit} onChange={(e) => patchPoint({ circuit: e.target.value.toUpperCase() })} /></Field>
        <Field label="Rotação"><Input type="number" step="90" value={point.rotation ?? 0} onChange={(e) => patchPoint({ rotation: Number(e.target.value) || 0 })} /></Field>
      </div>
      {isOutlet && <Row k="Nível da tomada" v={outletLevel(point.height)} />}
      <Row k="Espelhado" v={point.mirrored ? "Sim" : "Não"} /><Row k="Corrente estimada" v={`${(point.power / (point.voltage || 127)).toFixed(2)} A`} /><Row k="Posição" v={`${point.x.toFixed(2)} ; ${point.y.toFixed(2)} m`} />
    </div>}

    {room && <div className="space-y-3">
      <Field label="Nome do ambiente"><Input value={room.name} onChange={(e) => onChange((d) => ({ ...d, rooms: d.rooms.map((r) => r.id === room.id ? { ...r, name: e.target.value } : r) }))} /></Field>
      {!room.points && <div className="grid grid-cols-2 gap-2">
        <Field label="Largura (m)"><Input type="number" step="0.25" value={room.w} onChange={(e) => onChange((d) => ({ ...d, rooms: d.rooms.map((r) => r.id === room.id ? { ...r, w: Math.max(0.5, Number(e.target.value) || 0) } : r) }))} /></Field>
        <Field label="Comprimento (m)"><Input type="number" step="0.25" value={room.h} onChange={(e) => onChange((d) => ({ ...d, rooms: d.rooms.map((r) => r.id === room.id ? { ...r, h: Math.max(0.5, Number(e.target.value) || 0) } : r) }))} /></Field>
      </div>}
      <Row k="Forma" v={room.points ? `Livre (${room.points.length} vértices)` : "Retangular"} />
      <Row k="Área" v={`${roomArea(room).toFixed(2)} m²`} />
      <Row k="Perímetro" v={fmtM(roomPerimeter(room))} />
      {room.points && <p className="text-xs text-muted-foreground">Ambientes livres permitem representar cozinha em L, corredor integrado, recuos e outras geometrias.</p>}
    </div>}

    {architecture && <div className="space-y-3">
      <div><p className="font-mono text-base text-primary">{architecture.kind === "wall" ? "Parede" : architecture.kind === "door" ? "Porta" : "Janela"}</p><p className="text-xs text-muted-foreground">Elemento arquitetônico</p></div>
      <Row k="Comprimento" v={fmtM(architectureLength(architecture))} />
      {architecture.kind === "wall" && <Field label="Espessura (m)"><Input type="number" step="0.05" min="0.05" value={architecture.thickness ?? 0.15} onChange={(e) => onChange((d) => ({ ...d, architecture: d.architecture.map((a) => a.id === architecture.id ? { ...a, thickness: Math.max(0.05, Number(e.target.value) || 0.15) } : a) }))} /></Field>}
      {architecture.kind === "door" && <Button size="sm" variant="secondary" onClick={() => onChange((d) => ({ ...d, architecture: d.architecture.map((a) => a.id === architecture.id ? { ...a, openingDirection: a.openingDirection === "left" ? "right" : "left" } : a) }))}>Inverter abertura</Button>}
      <Row k="Início" v={`${architecture.x1.toFixed(2)} ; ${architecture.y1.toFixed(2)} m`} /><Row k="Fim" v={`${architecture.x2.toFixed(2)} ; ${architecture.y2.toFixed(2)} m`} />
    </div>}

    {panel && <div className="space-y-3"><Field label="Nome do quadro"><Input value={panel.name} onChange={(e) => onChange((d) => ({ ...d, panels: d.panels.map((p) => p.id === panel.id ? { ...p, name: e.target.value } : p) }))} /></Field><Row k="Eletrodutos ligados" v={String(doc.conduits.filter((c) => c.from === panel.id || c.to === panel.id).length)} /></div>}

    {conduit && <div className="space-y-3">
      <Field label="Tipo de eletroduto">
        <select className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm" value={conduit.type ?? "normal"} onChange={(e) => onChange((d) => ({ ...d, conduits: d.conduits.map((c) => c.id === conduit.id ? { ...c, type: e.target.value as ConduitType } : c) }))}>
          <option value="normal">Normal / parede — linha contínua</option>
          <option value="ceiling">Teto — linha contínua</option>
          <option value="underground">Subterrâneo — pontilhado</option>
        </select>
      </Field>
      <Field label="Diâmetro (mm)"><Input type="number" value={conduit.diameter} onChange={(e) => onChange((d) => ({ ...d, conduits: d.conduits.map((c) => c.id === conduit.id ? { ...c, diameter: Number(e.target.value) || 0 } : c) }))} /></Field>
      <div className="grid grid-cols-2 gap-2">
        <Button size="sm" variant="secondary" onClick={addConduitBend}>Adicionar curva</Button>
        <Button size="sm" variant="secondary" disabled={!conduit.route?.length} onClick={() => onChange((d) => ({ ...d, conduits: d.conduits.map((c) => c.id === conduit.id ? { ...c, route: (c.route ?? []).slice(0, -1) } : c) }))}>Remover curva</Button>
      </div>
      <p className="text-xs text-muted-foreground">Rotas manuais ou automáticas continuam editáveis: arraste os pontos circulares do trecho para reposicionar as curvas.</p>
      <Row k="Comprimento" v={fmtM(conduitLength(doc, conduit))} /><Row k="Curvas" v={String(conduit.route?.length ?? 0)} /><Row k="Origem" v={nodeLabel(doc, conduit.from)} /><Row k="Destino" v={nodeLabel(doc, conduit.to)} />
    </div>}

    {selection && <Button variant="destructive" size="sm" className="mt-4" onClick={remove}>Excluir elemento</Button>}
    <div className="mt-6"><p className="tech-label mb-2">Resumo da planta</p><Row k="Ambientes" v={`${doc.rooms.length} · ${summary.area.toFixed(2)} m²`} /><Row k="Paredes/aberturas" v={String(doc.architecture.length)} /><Row k="Pontos de luz" v={String(summary.lighting)} /><Row k="Tomadas" v={String(summary.outlets)} /><Row k="Equipamentos" v={String(summary.equipment)} /><Row k="Quadros" v={String(doc.panels.length)} /><Row k="Eletroduto total" v={fmtM(summary.conduitLength)} /><Row k="Potência instalada" v={`${summary.installedPower.toLocaleString("pt-BR")} VA`} /></div>
  </div>;
}

function nodeLabel(doc: PlanDocument, id: string) { const panel = doc.panels.find((p) => p.id === id); if (panel) return panel.name; const point = doc.points.find((p) => p.id === id); if (point) return point.label; return nodePosition(doc, id) ? "—" : "removido"; }
