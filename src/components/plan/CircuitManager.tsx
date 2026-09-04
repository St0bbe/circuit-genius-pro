import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createCircuit, getCircuits, removeCircuit, withCircuits, type Circuit, type CircuitPhase, type CircuitType, type ConductorMaterial } from "@/lib/circuits";
import type { PlanDocument } from "@/lib/electrical";

const TYPE_LABEL: Record<CircuitType, string> = { lighting: "Iluminação", outlets: "Tomadas", equipment: "Equipamentos", mixed: "Misto" };
const PHASES: CircuitPhase[] = ["auto", "A", "B", "C", "AB", "BC", "CA"];
const METHODS = ["configurar", "eletroduto embutido", "eletroduto aparente", "bandeja/eletrocalha", "subterrâneo", "outro"];

type Props = { doc: PlanDocument; onChange: (updater: (doc: PlanDocument) => PlanDocument) => void };

function patchCircuit(doc: PlanDocument, id: string, patch: Partial<Circuit>) {
  return withCircuits(doc, getCircuits(doc).map((circuit) => circuit.id === id ? { ...circuit, ...patch } : circuit));
}

export function CircuitManager({ doc, onChange }: Props) {
  const circuits = getCircuits(doc);
  const addCircuit = () => onChange((current) => { const circuit = createCircuit(current); return withCircuits(current, [...getCircuits(current), circuit]); });

  return (
    <div className="border-t border-border bg-sidebar p-3">
      <div className="mb-3 flex items-center justify-between gap-2"><div><p className="tech-label">Gerenciar circuitos</p><p className="text-[11px] text-muted-foreground">Carga, instalação e parâmetros do motor de engenharia</p></div><Button size="sm" variant="secondary" onClick={addCircuit}>+ Circuito</Button></div>
      {circuits.length === 0 ? <p className="text-xs text-muted-foreground">Nenhum circuito cadastrado.</p> : (
        <div className="max-h-[620px] space-y-3 overflow-y-auto pr-1">
          {circuits.map((circuit) => {
            const loads = doc.points.filter((point) => point.circuit.toUpperCase() === circuit.id);
            const power = loads.reduce((sum, point) => sum + Math.max(0, point.power || 0), 0);
            return <div key={circuit.id} className="space-y-2 rounded-md border border-border bg-card/45 p-2">
              <div className="flex items-center justify-between gap-2"><span className="font-mono text-xs font-semibold text-primary">{circuit.id}</span><span className="font-mono text-[11px] text-muted-foreground">{loads.length} carga(s) · {power.toLocaleString("pt-BR")} VA</span></div>
              <Field label="Descrição"><Input value={circuit.description} onChange={(e) => onChange((d) => patchCircuit(d, circuit.id, { description: e.target.value }))} /></Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Tensão"><select className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" value={circuit.voltage} onChange={(e) => onChange((d) => patchCircuit(d, circuit.id, { voltage: Number(e.target.value) as 127 | 220 }))}><option value={127}>127 V</option><option value={220}>220 V</option></select></Field>
                <Field label="Fase"><select className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" value={circuit.phase} onChange={(e) => onChange((d) => patchCircuit(d, circuit.id, { phase: e.target.value as CircuitPhase }))}>{PHASES.map((phase) => <option key={phase} value={phase}>{phase === "auto" ? "Automática" : phase}</option>)}</select></Field>
                <Field label="Tipo"><select className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" value={circuit.type} onChange={(e) => onChange((d) => patchCircuit(d, circuit.id, { type: e.target.value as CircuitType }))}>{(Object.keys(TYPE_LABEL) as CircuitType[]).map((type) => <option key={type} value={type}>{TYPE_LABEL[type]}</option>)}</select></Field>
                <Field label="Demanda"><Input type="number" min="0" max="1" step="0.05" value={circuit.demandFactor} onChange={(e) => onChange((d) => patchCircuit(d, circuit.id, { demandFactor: Math.min(1, Math.max(0, Number(e.target.value) || 0)) }))} /></Field>
                <Field label="Fator de potência"><Input type="number" min="0.01" max="1" step="0.01" value={circuit.powerFactor} onChange={(e) => onChange((d) => patchCircuit(d, circuit.id, { powerFactor: Math.min(1, Math.max(0.01, Number(e.target.value) || 1)) }))} /></Field>
                <Field label="Material"><select className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" value={circuit.conductorMaterial} onChange={(e) => onChange((d) => patchCircuit(d, circuit.id, { conductorMaterial: e.target.value as ConductorMaterial }))}><option value="copper">Cobre</option><option value="aluminum">Alumínio</option></select></Field>
                <Field label="Correção temperatura"><Input type="number" min="0.1" max="1" step="0.01" value={circuit.ambientCorrection} onChange={(e) => onChange((d) => patchCircuit(d, circuit.id, { ambientCorrection: Math.min(1, Math.max(0.1, Number(e.target.value) || 1)) }))} /></Field>
                <Field label="Correção agrupamento"><Input type="number" min="0.1" max="1" step="0.01" value={circuit.groupingCorrection} onChange={(e) => onChange((d) => patchCircuit(d, circuit.id, { groupingCorrection: Math.min(1, Math.max(0.1, Number(e.target.value) || 1)) }))} /></Field>
              </div>
              <Field label="Método de instalação"><select className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" value={circuit.installationMethod} onChange={(e) => onChange((d) => patchCircuit(d, circuit.id, { installationMethod: e.target.value }))}>{METHODS.map((method) => <option key={method} value={method}>{method}</option>)}</select></Field>
              <div className="grid grid-cols-2 gap-2"><Field label="Comprimento manual (m)"><Input type="number" min="0" step="0.1" value={circuit.routeLengthOverrideM ?? ""} placeholder="usar traçado" onChange={(e) => onChange((d) => patchCircuit(d, circuit.id, { routeLengthOverrideM: e.target.value ? Math.max(0, Number(e.target.value) || 0) : null }))} /></Field><Field label="Quadro"><select className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" value={circuit.panelId ?? ""} onChange={(e) => onChange((d) => patchCircuit(d, circuit.id, { panelId: e.target.value || null }))}><option value="">Não definido</option>{doc.panels.map((panel) => <option key={panel.id} value={panel.id}>{panel.name}</option>)}</select></Field></div>
              <div className="flex justify-end"><Button size="sm" variant="destructive" onClick={() => onChange((d) => removeCircuit(d, circuit.id))}>Excluir</Button></div>
            </div>;
          })}
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div className="space-y-1"><Label className="tech-label">{label}</Label>{children}</div>; }
