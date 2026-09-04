import { analyzeProject } from "@/lib/engineering";
import type { PlanDocument } from "@/lib/electrical";

type Props = { doc: PlanDocument };

export function CircuitsSummary({ doc }: Props) {
  const analysis = analyzeProject(doc);

  return (
    <div className="border-t border-border bg-sidebar p-3">
      <div className="mb-2 flex items-center justify-between">
        <div>
          <p className="tech-label">Circuitos</p>
          <p className="text-[11px] text-muted-foreground">
            {analysis.installedPower.toLocaleString("pt-BR")} VA instalados · {analysis.demandPower.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} VA demanda
          </p>
        </div>
        <span className="font-mono text-xs text-muted-foreground">{analysis.circuits.length}</span>
      </div>

      {analysis.circuits.length === 0 ? (
        <p className="text-xs text-muted-foreground">Crie um circuito ou atribua C01, C02... aos pontos.</p>
      ) : (
        <div className="max-h-48 space-y-1 overflow-y-auto pr-1">
          {analysis.circuits.map((circuit) => {
            const panel = circuit.panelId ? doc.panels.find((item) => item.id === circuit.panelId) : null;
            return (
              <div key={circuit.id} className="rounded border border-border/70 bg-card/50 px-2 py-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs text-primary">{circuit.id} · {circuit.description}</span>
                  <span className="font-mono text-xs">{circuit.demandPower.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} VA</span>
                </div>
                <div className="mt-0.5 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                  <span>{circuit.loads.length} carga(s) · {circuit.voltage ?? "—"} V · fase {circuit.phase === "auto" ? "auto" : circuit.phase}</span>
                  <span>{circuit.designCurrent == null ? "revisar" : `${circuit.designCurrent.toFixed(2)} A`}</span>
                </div>
                <div className="mt-0.5 text-[10px] text-muted-foreground">
                  Quadro: {panel?.name ?? "não definido"} · demanda {(circuit.demandFactor * 100).toFixed(0)}%
                </div>
              </div>
            );
          })}
        </div>
      )}

      {analysis.warnings.length > 0 && (
        <div className="mt-2 space-y-1">
          {analysis.warnings.map((warning) => <p key={warning} className="text-[11px] text-amber-500">⚠ {warning}</p>)}
        </div>
      )}
    </div>
  );
}
