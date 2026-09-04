import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createCircuit, getCircuits, removeCircuit, withCircuits, type Circuit, type CircuitPhase, type CircuitType } from "@/lib/circuits";
import type { PlanDocument } from "@/lib/electrical";

const TYPE_LABEL: Record<CircuitType, string> = {
  lighting: "Iluminação",
  outlets: "Tomadas",
  equipment: "Equipamentos",
  mixed: "Misto",
};

const PHASES: CircuitPhase[] = ["auto", "A", "B", "C", "AB", "BC", "CA"];

type Props = {
  doc: PlanDocument;
  onChange: (updater: (doc: PlanDocument) => PlanDocument) => void;
};

function patchCircuit(doc: PlanDocument, id: string, patch: Partial<Circuit>) {
  return withCircuits(doc, getCircuits(doc).map((circuit) => circuit.id === id ? { ...circuit, ...patch } : circuit));
}

export function CircuitManager({ doc, onChange }: Props) {
  const circuits = getCircuits(doc);

  const addCircuit = () => {
    onChange((current) => {
      const circuit = createCircuit(current);
      return withCircuits(current, [...getCircuits(current), circuit]);
    });
  };

  return (
    <div className="border-t border-border bg-sidebar p-3">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <p className="tech-label">Gerenciar circuitos</p>
          <p className="text-[11px] text-muted-foreground">Circuitos persistentes do projeto</p>
        </div>
        <Button size="sm" variant="secondary" onClick={addCircuit}>+ Circuito</Button>
      </div>

      {circuits.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nenhum circuito cadastrado.</p>
      ) : (
        <div className="max-h-72 space-y-3 overflow-y-auto pr-1">
          {circuits.map((circuit) => {
            const loads = doc.points.filter((point) => point.circuit.toUpperCase() === circuit.id);
            const power = loads.reduce((sum, point) => sum + Math.max(0, point.power || 0), 0);
            return (
              <div key={circuit.id} className="space-y-2 rounded-md border border-border bg-card/45 p-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs font-semibold text-primary">{circuit.id}</span>
                  <span className="font-mono text-[11px] text-muted-foreground">{loads.length} carga(s) · {power.toLocaleString("pt-BR")} VA</span>
                </div>

                <div className="space-y-1">
                  <Label className="tech-label">Descrição</Label>
                  <Input value={circuit.description} onChange={(e) => onChange((d) => patchCircuit(d, circuit.id, { description: e.target.value }))} />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="tech-label">Tensão</Label>
                    <select
                      className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                      value={circuit.voltage}
                      onChange={(e) => onChange((d) => patchCircuit(d, circuit.id, { voltage: Number(e.target.value) as 127 | 220 }))}
                    >
                      <option value={127}>127 V</option>
                      <option value={220}>220 V</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <Label className="tech-label">Fase</Label>
                    <select
                      className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                      value={circuit.phase}
                      onChange={(e) => onChange((d) => patchCircuit(d, circuit.id, { phase: e.target.value as CircuitPhase }))}
                    >
                      {PHASES.map((phase) => <option key={phase} value={phase}>{phase === "auto" ? "Automática" : phase}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <Label className="tech-label">Tipo</Label>
                    <select
                      className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                      value={circuit.type}
                      onChange={(e) => onChange((d) => patchCircuit(d, circuit.id, { type: e.target.value as CircuitType }))}
                    >
                      {(Object.keys(TYPE_LABEL) as CircuitType[]).map((type) => <option key={type} value={type}>{TYPE_LABEL[type]}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <Label className="tech-label">Demanda</Label>
                    <Input
                      type="number"
                      min="0"
                      max="1"
                      step="0.05"
                      value={circuit.demandFactor}
                      onChange={(e) => onChange((d) => patchCircuit(d, circuit.id, { demandFactor: Math.min(1, Math.max(0, Number(e.target.value) || 0)) }))}
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="tech-label">Quadro</Label>
                  <select
                    className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                    value={circuit.panelId ?? ""}
                    onChange={(e) => onChange((d) => patchCircuit(d, circuit.id, { panelId: e.target.value || null }))}
                  >
                    <option value="">Não definido</option>
                    {doc.panels.map((panel) => <option key={panel.id} value={panel.id}>{panel.name}</option>)}
                  </select>
                </div>

                <div className="flex justify-end">
                  <Button size="sm" variant="destructive" onClick={() => onChange((d) => removeCircuit(d, circuit.id))}>Excluir</Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
