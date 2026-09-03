import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  CATALOG_BY_KIND,
  conduitLength,
  fmtM,
  nodePosition,
  type PlanDocument,
  type PlanSummary,
} from "@/lib/electrical";
import type { Selection } from "./PlanCanvas";

type Props = {
  doc: PlanDocument;
  selection: Selection;
  summary: PlanSummary;
  onChange: (updater: (doc: PlanDocument) => PlanDocument) => void;
  onSelect: (sel: Selection) => void;
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="tech-label">{label}</Label>
      {children}
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2 border-b border-border/60 py-1.5 last:border-0">
      <span className="text-xs text-muted-foreground">{k}</span>
      <span className="font-mono text-sm">{v}</span>
    </div>
  );
}

export function PropertiesPanel({ doc, selection, summary, onChange, onSelect }: Props) {
  const remove = () => {
    if (!selection) return;
    const { type, id } = selection;
    onChange((d) => {
      if (type === "room") return { ...d, rooms: d.rooms.filter((r) => r.id !== id) };
      if (type === "conduit") return { ...d, conduits: d.conduits.filter((c) => c.id !== id) };
      if (type === "panel")
        return {
          ...d,
          panels: d.panels.filter((p) => p.id !== id),
          conduits: d.conduits.filter((c) => c.from !== id && c.to !== id),
        };
      return {
        ...d,
        points: d.points.filter((p) => p.id !== id),
        conduits: d.conduits.filter((c) => c.from !== id && c.to !== id),
      };
    });
    onSelect(null);
  };

  const point = selection?.type === "point" ? doc.points.find((p) => p.id === selection.id) : undefined;
  const room = selection?.type === "room" ? doc.rooms.find((r) => r.id === selection.id) : undefined;
  const panel = selection?.type === "panel" ? doc.panels.find((p) => p.id === selection.id) : undefined;
  const conduit = selection?.type === "conduit" ? doc.conduits.find((c) => c.id === selection.id) : undefined;

  return (
    <div className="flex h-full flex-col overflow-y-auto border-l border-border bg-sidebar p-3">
      <p className="tech-label mb-3">Propriedades</p>

      {!selection && (
        <div className="rounded-md border border-dashed border-border p-3 text-sm text-muted-foreground">
          Selecione um ambiente, ponto, quadro ou eletroduto na planta para editar suas propriedades.
        </div>
      )}

      {point && (
        <div className="space-y-3">
          <div>
            <p className="font-mono text-base text-primary">{point.label}</p>
            <p className="text-xs text-muted-foreground">{CATALOG_BY_KIND[point.kind]?.label}</p>
          </div>
          <Field label="Identificação">
            <Input
              value={point.label}
              onChange={(e) =>
                onChange((d) => ({
                  ...d,
                  points: d.points.map((p) => (p.id === point.id ? { ...p, label: e.target.value } : p)),
                }))
              }
            />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Potência (VA)">
              <Input
                type="number"
                value={point.power}
                onChange={(e) =>
                  onChange((d) => ({
                    ...d,
                    points: d.points.map((p) =>
                      p.id === point.id ? { ...p, power: Number(e.target.value) || 0 } : p,
                    ),
                  }))
                }
              />
            </Field>
            <Field label="Tensão (V)">
              <Input
                type="number"
                value={point.voltage}
                onChange={(e) =>
                  onChange((d) => ({
                    ...d,
                    points: d.points.map((p) =>
                      p.id === point.id ? { ...p, voltage: Number(e.target.value) || 0 } : p,
                    ),
                  }))
                }
              />
            </Field>
            <Field label="Altura (m)">
              <Input
                type="number"
                step="0.05"
                value={point.height}
                onChange={(e) =>
                  onChange((d) => ({
                    ...d,
                    points: d.points.map((p) =>
                      p.id === point.id ? { ...p, height: Number(e.target.value) || 0 } : p,
                    ),
                  }))
                }
              />
            </Field>
            <Field label="Circuito">
              <Input
                placeholder="C01"
                value={point.circuit}
                onChange={(e) =>
                  onChange((d) => ({
                    ...d,
                    points: d.points.map((p) =>
                      p.id === point.id ? { ...p, circuit: e.target.value.toUpperCase() } : p,
                    ),
                  }))
                }
              />
            </Field>
          </div>
          <Row k="Corrente estimada" v={`${(point.power / (point.voltage || 127)).toFixed(2)} A`} />
          <Row k="Posição" v={`${point.x.toFixed(2)} ; ${point.y.toFixed(2)} m`} />
        </div>
      )}

      {room && (
        <div className="space-y-3">
          <Field label="Nome do ambiente">
            <Input
              value={room.name}
              onChange={(e) =>
                onChange((d) => ({
                  ...d,
                  rooms: d.rooms.map((r) => (r.id === room.id ? { ...r, name: e.target.value } : r)),
                }))
              }
            />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Largura (m)">
              <Input
                type="number"
                step="0.25"
                value={room.w}
                onChange={(e) =>
                  onChange((d) => ({
                    ...d,
                    rooms: d.rooms.map((r) =>
                      r.id === room.id ? { ...r, w: Math.max(0.5, Number(e.target.value) || 0) } : r,
                    ),
                  }))
                }
              />
            </Field>
            <Field label="Comprimento (m)">
              <Input
                type="number"
                step="0.25"
                value={room.h}
                onChange={(e) =>
                  onChange((d) => ({
                    ...d,
                    rooms: d.rooms.map((r) =>
                      r.id === room.id ? { ...r, h: Math.max(0.5, Number(e.target.value) || 0) } : r,
                    ),
                  }))
                }
              />
            </Field>
          </div>
          <Row k="Área" v={`${(room.w * room.h).toFixed(2)} m²`} />
          <Row k="Perímetro" v={fmtM(2 * (room.w + room.h))} />
        </div>
      )}

      {panel && (
        <div className="space-y-3">
          <Field label="Nome do quadro">
            <Input
              value={panel.name}
              onChange={(e) =>
                onChange((d) => ({
                  ...d,
                  panels: d.panels.map((p) => (p.id === panel.id ? { ...p, name: e.target.value } : p)),
                }))
              }
            />
          </Field>
          <Row
            k="Eletrodutos ligados"
            v={String(doc.conduits.filter((c) => c.from === panel.id || c.to === panel.id).length)}
          />
        </div>
      )}

      {conduit && (
        <div className="space-y-3">
          <Field label="Diâmetro (mm)">
            <Input
              type="number"
              value={conduit.diameter}
              onChange={(e) =>
                onChange((d) => ({
                  ...d,
                  conduits: d.conduits.map((c) =>
                    c.id === conduit.id ? { ...c, diameter: Number(e.target.value) || 0 } : c,
                  ),
                }))
              }
            />
          </Field>
          <Row k="Comprimento" v={fmtM(conduitLength(doc, conduit))} />
          <Row k="Origem" v={nodeLabel(doc, conduit.from)} />
          <Row k="Destino" v={nodeLabel(doc, conduit.to)} />
        </div>
      )}

      {selection && (
        <Button variant="destructive" size="sm" className="mt-4" onClick={remove}>
          Excluir elemento
        </Button>
      )}

      <div className="mt-6">
        <p className="tech-label mb-2">Resumo da planta</p>
        <Row k="Ambientes" v={`${doc.rooms.length} · ${summary.area.toFixed(2)} m²`} />
        <Row k="Pontos de luz" v={String(summary.lighting)} />
        <Row k="Tomadas" v={String(summary.outlets)} />
        <Row k="Equipamentos" v={String(summary.equipment)} />
        <Row k="Quadros" v={String(doc.panels.length)} />
        <Row k="Eletroduto total" v={fmtM(summary.conduitLength)} />
        <Row k="Potência instalada" v={`${summary.installedPower.toLocaleString("pt-BR")} VA`} />
      </div>
    </div>
  );
}

function nodeLabel(doc: PlanDocument, id: string) {
  const panel = doc.panels.find((p) => p.id === id);
  if (panel) return panel.name;
  const point = doc.points.find((p) => p.id === id);
  if (point) return point.label;
  return nodePosition(doc, id) ? "—" : "removido";
}
