import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { PlanDocument } from "@/lib/electrical";
import { analyzePhaseBalance, autoBalancePhases } from "@/lib/phase-balance";
import { applyControlPlan, buildControlPlan } from "@/lib/switching";

type Props = { doc: PlanDocument; onChange: (updater: (doc: PlanDocument) => PlanDocument) => void };

export function SmartActionsPanel({ doc, onChange }: Props) {
  const lights = doc.points.filter((p) => ["ponto_luz", "luminaria", "spot", "arandela", "perfil_led"].includes(p.kind));
  const [lightId, setLightId] = useState("");
  const [controlPoints, setControlPoints] = useState(2);
  const balance = useMemo(() => analyzePhaseBalance(doc), [doc]);
  const plan = buildControlPlan(controlPoints);

  return <div className="border-t border-border bg-sidebar p-3">
    <p className="tech-label">Ações automáticas</p>
    <p className="mb-3 text-[11px] text-muted-foreground">Aplicações revisáveis sobre o projeto atual.</p>
    <div className="space-y-2 rounded border border-border bg-card/45 p-2">
      <div className="flex items-center justify-between gap-2"><div><div className="text-xs font-medium">Balancear fases</div><div className="text-[10px] text-muted-foreground">Desequilíbrio atual: {balance.maxDifferencePercent.toFixed(1)}%</div></div><Button size="sm" onClick={() => onChange((d) => autoBalancePhases(d))}>Balancear</Button></div>
    </div>
    <div className="mt-2 space-y-2 rounded border border-border bg-card/45 p-2">
      <div className="text-xs font-medium">Aplicar three-way / four-way</div>
      <select className="h-9 w-full rounded border border-input bg-background px-2 text-xs" value={lightId} onChange={(e) => setLightId(e.target.value)}><option value="">Selecione uma luminária</option>{lights.map((light) => <option key={light.id} value={light.id}>{light.label} · {light.circuit || "sem circuito"}</option>)}</select>
      <label className="block text-[10px] text-muted-foreground">Pontos de comando<Input className="mt-1" type="number" min="1" max="12" value={controlPoints} onChange={(e) => setControlPoints(Math.max(1, Math.min(12, Number(e.target.value) || 1)))} /></label>
      <div className="text-[10px] text-muted-foreground">{plan.description}</div>
      <Button size="sm" disabled={!lightId} onClick={() => onChange((d) => applyControlPlan(d, lightId, controlPoints))}>Aplicar ao desenho</Button>
    </div>
  </div>;
}
