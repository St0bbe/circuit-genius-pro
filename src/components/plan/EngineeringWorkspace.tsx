import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import type { PlanDocument } from "@/lib/electrical";
import { analyzeProject } from "@/lib/engineering";
import { preliminarySizing } from "@/lib/engineering-rules";
import { validateProject } from "@/lib/validation";
import { calculateMaterials } from "@/lib/materials";
import { estimateWiring } from "@/lib/wiring";
import { analyzePhaseBalance } from "@/lib/phase-balance";
import { generateLegend, generateMemorial, generateSingleLine } from "@/lib/documentation";
import { CircuitManager } from "./CircuitManager";

type Props = {
  doc: PlanDocument;
  onChange: (updater: (doc: PlanDocument) => PlanDocument) => void;
};

type Tab = "cargas" | "circuitos" | "validacao" | "materiais" | "quadro" | "fiacao" | "fases" | "docs";

export function EngineeringWorkspace({ doc, onChange }: Props) {
  const [tab, setTab] = useState<Tab>("cargas");
  const overview = useMemo(() => analyzeProject(doc), [doc]);
  const validation = useMemo(() => validateProject(doc), [doc]);
  const materials = useMemo(() => calculateMaterials(doc), [doc]);
  const wiring = useMemo(() => estimateWiring(doc), [doc]);
  const balance = useMemo(() => analyzePhaseBalance(doc), [doc]);
  const legend = useMemo(() => generateLegend(doc), [doc]);
  const singleLine = useMemo(() => generateSingleLine(doc), [doc]);
  const memorial = useMemo(() => generateMemorial(doc), [doc]);

  const errors = validation.filter((item) => item.severity === "error").length;
  const warnings = validation.filter((item) => item.severity === "warning").length;

  return (
    <div className="border-t border-border bg-sidebar">
      <div className="flex flex-wrap gap-1 border-b border-border p-2">
        <TabButton active={tab === "cargas"} onClick={() => setTab("cargas")}>Cargas</TabButton>
        <TabButton active={tab === "circuitos"} onClick={() => setTab("circuitos")}>Circuitos</TabButton>
        <TabButton active={tab === "quadro"} onClick={() => setTab("quadro")}>Quadro</TabButton>
        <TabButton active={tab === "fiacao"} onClick={() => setTab("fiacao")}>Fiação</TabButton>
        <TabButton active={tab === "fases"} onClick={() => setTab("fases")}>Fases</TabButton>
        <TabButton active={tab === "validacao"} onClick={() => setTab("validacao")}>Validar {errors ? `(${errors})` : ""}</TabButton>
        <TabButton active={tab === "materiais"} onClick={() => setTab("materiais")}>Materiais</TabButton>
        <TabButton active={tab === "docs"} onClick={() => setTab("docs")}>Docs</TabButton>
      </div>

      {tab === "cargas" && (
        <div className="p-3">
          <div className="mb-2 flex items-end justify-between gap-3">
            <div><p className="tech-label">Quadro de cargas</p><p className="text-[11px] text-muted-foreground">Dimensionamento preliminar configurável</p></div>
            <div className="text-right text-[11px] text-muted-foreground"><div>Instalada: {overview.installedPower.toLocaleString("pt-BR")} VA</div><div>Demanda: {overview.demandPower.toLocaleString("pt-BR")} VA</div></div>
          </div>
          <div className="overflow-x-auto rounded border border-border">
            <table className="w-full min-w-[700px] text-xs">
              <thead className="bg-card"><tr className="text-left text-muted-foreground"><th className="p-2">Circuito</th><th className="p-2">Descrição</th><th className="p-2">Potência</th><th className="p-2">Demanda</th><th className="p-2">Tensão</th><th className="p-2">Corrente</th><th className="p-2">Cabo</th><th className="p-2">Disj.</th><th className="p-2">Fase</th></tr></thead>
              <tbody>{overview.circuits.map((circuit) => { const sizing = preliminarySizing(circuit); return <tr key={circuit.id} className="border-t border-border/70"><td className="p-2 font-mono text-primary">{circuit.id}</td><td className="p-2">{circuit.description}</td><td className="p-2 font-mono">{circuit.installedPower.toLocaleString("pt-BR")} VA</td><td className="p-2 font-mono">{circuit.demandPower.toLocaleString("pt-BR")} VA</td><td className="p-2 font-mono">{circuit.voltage ?? "—"} V</td><td className="p-2 font-mono">{circuit.designCurrent == null ? "—" : `${circuit.designCurrent.toFixed(2)} A`}</td><td className="p-2 font-mono">{sizing.conductorSection ? `${String(sizing.conductorSection).replace(".", ",")} mm²` : "revisar"}</td><td className="p-2 font-mono">{sizing.breakerRating ? `${sizing.breakerRating} A` : "revisar"}</td><td className="p-2 font-mono">{circuit.phase}</td></tr>; })}</tbody>
            </table>
          </div>
          <p className="mt-2 text-[10px] text-muted-foreground">Os valores de cabo/disjuntor são preliminares e precisam ser confirmados com método de instalação, agrupamento, temperatura, queda de tensão e regras aplicáveis ao projeto.</p>
        </div>
      )}

      {tab === "circuitos" && <CircuitManager doc={doc} onChange={onChange} />}

      {tab === "quadro" && (
        <div className="space-y-3 p-3"><div><p className="tech-label">Quadros de distribuição</p><p className="text-[11px] text-muted-foreground">Visão lógica dos circuitos associados</p></div>{doc.panels.length === 0 ? <p className="text-xs text-muted-foreground">Nenhum quadro posicionado.</p> : doc.panels.map((panel) => { const circuits = overview.circuits.filter((c) => c.panelId === panel.id); const modules = Math.max(8, Math.ceil((circuits.length + 3) / 4) * 4); return <div key={panel.id} className="rounded border border-border bg-card/50 p-2"><div className="flex justify-between"><span className="font-mono text-primary">{panel.name}</span><span className="text-[11px] text-muted-foreground">sugestão ≥ {modules} módulos</span></div><div className="mt-2 space-y-1 text-xs"><div className="rounded bg-background/60 px-2 py-1">Disjuntor geral · configurar</div><div className="rounded bg-background/60 px-2 py-1">DPS · configurar</div><div className="rounded bg-background/60 px-2 py-1">DR · configurar</div>{circuits.map((c) => <div key={c.id} className="flex justify-between rounded bg-background/60 px-2 py-1"><span>{c.id} · {c.description}</span><span className="font-mono">{c.designCurrent == null ? "—" : `${c.designCurrent.toFixed(1)} A`}</span></div>)}</div></div>; })}</div>
      )}

      {tab === "fiacao" && (
        <div className="p-3"><div className="mb-2"><p className="tech-label">Fiação estimada</p><p className="text-[11px] text-muted-foreground">Comprimentos por circuito com margem de compra</p></div>{wiring.length === 0 ? <p className="text-xs text-muted-foreground">Conecte circuitos ao quadro através dos eletrodutos para gerar a estimativa.</p> : <div className="space-y-1">{wiring.map((wire) => <div key={`${wire.circuitId}-${wire.role}`} className="flex justify-between rounded border border-border/60 bg-card/45 px-2 py-1.5 text-xs"><div><div className="font-mono text-primary">{wire.marker}</div><div className="text-[10px] text-muted-foreground">{String(wire.section).replace(".", ",")} mm² · traçado {wire.length.toLocaleString("pt-BR")} m</div></div><div className="font-mono">comprar {wire.purchaseLength.toLocaleString("pt-BR")} m</div></div>)}</div>}</div>
      )}

      {tab === "fases" && (
        <div className="p-3"><div className="mb-2"><p className="tech-label">Balanceamento de fases</p><p className="text-[11px] text-muted-foreground">Distribuição estimada da potência de demanda</p></div><div className="grid grid-cols-3 gap-2">{balance.phases.map((phase) => <div key={phase.phase} className="rounded border border-border bg-card/50 p-2"><div className="font-mono text-primary">FASE {phase.phase}</div><div className="mt-1 font-mono text-sm">{phase.power.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} VA</div><div className="mt-1 text-[10px] text-muted-foreground">{phase.circuits.join(", ") || "sem circuitos"}</div></div>)}</div>{balance.warning && <p className="mt-2 text-xs text-amber-500">⚠ {balance.warning}</p>}</div>
      )}

      {tab === "validacao" && (
        <div className="space-y-2 p-3"><div className="flex justify-between"><div><p className="tech-label">Validação do projeto</p><p className="text-[11px] text-muted-foreground">{errors} erro(s) · {warnings} aviso(s)</p></div></div>{validation.map((item) => <div key={`${item.code}-${item.circuitId ?? "global"}`} className="rounded border border-border bg-card/45 p-2 text-xs"><div className="font-medium">{item.severity === "error" ? "🔴" : item.severity === "warning" ? "🟡" : "🟢"} {item.title}</div><div className="mt-1 text-[11px] text-muted-foreground">{item.detail}</div></div>)}</div>
      )}

      {tab === "materiais" && (
        <div className="p-3"><div className="mb-2"><p className="tech-label">Quantitativo preliminar</p><p className="text-[11px] text-muted-foreground">Gerado a partir do desenho e circuitos atuais</p></div>{materials.length === 0 ? <p className="text-xs text-muted-foreground">Ainda não há dados suficientes para estimar materiais.</p> : <div className="space-y-1">{materials.map((item, index) => <div key={`${item.category}-${item.name}-${index}`} className="flex items-start justify-between gap-3 rounded border border-border/60 bg-card/45 px-2 py-1.5 text-xs"><div><div>{item.name}</div>{item.note && <div className="text-[10px] text-muted-foreground">{item.note}</div>}</div><div className="whitespace-nowrap font-mono">{item.quantity.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} {item.unit}</div></div>)}</div>}</div>
      )}

      {tab === "docs" && (
        <div className="space-y-3 p-3"><div><p className="tech-label">Documentação automática</p><p className="text-[11px] text-muted-foreground">Legenda, dados do unifilar e memorial gerados a partir do projeto</p></div><section><p className="mb-1 text-xs font-medium">Legenda</p><div className="grid grid-cols-2 gap-1">{legend.map((item) => <div key={item.symbol} className="rounded border border-border/60 bg-card/45 px-2 py-1 text-xs"><span className="font-mono text-primary">{item.symbol}</span> · {item.label}</div>)}</div></section><section><p className="mb-1 text-xs font-medium">Unifilar — dados</p><div className="space-y-1">{singleLine.map((branch) => <div key={branch.circuitId} className="rounded border border-border/60 bg-card/45 px-2 py-1.5 text-xs"><div className="font-mono text-primary">{branch.panelName} → {branch.circuitId}</div><div className="text-[10px] text-muted-foreground">{branch.description} · {branch.voltage ?? "—"} V · {branch.current == null ? "corrente revisar" : `${branch.current.toFixed(2)} A`} · {branch.conductor ? `${branch.conductor} mm²` : "cabo revisar"} · {branch.breaker ? `${branch.breaker} A` : "disjuntor revisar"}</div></div>)}</div></section><section><p className="mb-1 text-xs font-medium">Memorial</p><pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded border border-border bg-card/45 p-2 text-[10px] text-muted-foreground">{memorial}</pre></section></div>
      )}
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <Button type="button" size="sm" variant={active ? "default" : "ghost"} onClick={onClick}>{children}</Button>;
}
