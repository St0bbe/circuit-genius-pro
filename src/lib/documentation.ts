import { CATALOG_BY_KIND, type PlanDocument } from "@/lib/electrical";
import { analyzeProject } from "@/lib/engineering";
import { preliminarySizing } from "@/lib/engineering-rules";

export type LegendItem = { symbol: string; label: string };
export type SingleLineBranch = { circuitId: string; description: string; voltage: number | null; current: number | null; conductor: number | null; breaker: number | null; panelName: string };

export function generateLegend(doc: PlanDocument): LegendItem[] {
  const used = new Map<string, string>();
  for (const point of doc.points) {
    const def = CATALOG_BY_KIND[point.kind];
    if (def) used.set(def.short, def.label);
  }
  if (doc.panels.length) used.set("QD", "Quadro de distribuição");
  if (doc.conduits.length) used.set("E", "Eletroduto");
  return [...used.entries()].map(([symbol, label]) => ({ symbol, label })).sort((a, b) => a.symbol.localeCompare(b.symbol));
}

export function generateSingleLine(doc: PlanDocument): SingleLineBranch[] {
  const overview = analyzeProject(doc);
  return overview.circuits.map((circuit) => {
    const sizing = preliminarySizing(circuit);
    const panel = doc.panels.find((p) => p.id === circuit.panelId);
    return {
      circuitId: circuit.id,
      description: circuit.description,
      voltage: circuit.voltage,
      current: circuit.designCurrent,
      conductor: sizing.conductorSection,
      breaker: sizing.breakerRating,
      panelName: panel?.name ?? "Sem quadro",
    };
  });
}

export function generateMemorial(doc: PlanDocument) {
  const overview = analyzeProject(doc);
  return [
    "MEMORIAL DESCRITIVO — PROJETO ELÉTRICO",
    "",
    `Potência instalada: ${overview.installedPower.toLocaleString("pt-BR")} VA`,
    `Potência de demanda: ${overview.demandPower.toLocaleString("pt-BR")} VA`,
    `Quantidade de circuitos: ${overview.circuits.length}`,
    `Quadros de distribuição: ${doc.panels.length}`,
    `Pontos elétricos: ${doc.points.length}`,
    `Eletrodutos: ${doc.conduits.length}`,
    "",
    "Circuitos:",
    ...overview.circuits.map((c) => `- ${c.id}: ${c.description} · ${c.installedPower.toLocaleString("pt-BR")} VA · ${c.voltage ?? "—"} V · ${c.designCurrent == null ? "corrente a revisar" : `${c.designCurrent.toFixed(2)} A`}`),
    "",
    "Observação: os cálculos apresentados pelo software são auxiliares. O dimensionamento final, a conformidade normativa e a responsabilidade técnica devem ser validados pelo profissional habilitado conforme as regras aplicáveis ao projeto.",
  ].join("\n");
}
