import type { PlanDocument } from "@/lib/electrical";
import { analyzeProject } from "@/lib/engineering";
import { preliminarySizing } from "@/lib/engineering-rules";

export type MaterialItem = {
  category: "cabos" | "eletrodutos" | "caixas" | "protecao" | "identificacao";
  name: string;
  unit: "m" | "un";
  quantity: number;
  note?: string;
};

export function calculateMaterials(doc: PlanDocument): MaterialItem[] {
  const items: MaterialItem[] = [];
  const conduitByDiameter = new Map<number, number>();

  for (const conduit of doc.conduits) {
    const a = doc.points.find((p) => p.id === conduit.from) ?? doc.panels.find((p) => p.id === conduit.from);
    const b = doc.points.find((p) => p.id === conduit.to) ?? doc.panels.find((p) => p.id === conduit.to);
    if (!a || !b) continue;
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    conduitByDiameter.set(conduit.diameter, (conduitByDiameter.get(conduit.diameter) ?? 0) + length);
  }

  for (const [diameter, length] of conduitByDiameter) {
    items.push({ category: "eletrodutos", name: `Eletroduto ${diameter} mm`, unit: "m", quantity: round2(length * 1.1), note: "Inclui margem preliminar de 10%." });
  }

  const analysis = analyzeProject(doc);
  const cableBySection = new Map<number, number>();
  for (const circuit of analysis.circuits) {
    const sizing = preliminarySizing(circuit);
    if (!sizing.conductorSection || circuit.loads.length === 0) continue;
    const routeLength = estimateCircuitRoute(doc, circuit.id, circuit.panelId);
    if (routeLength <= 0) continue;
    const conductors = circuit.voltage === 220 ? 3 : 3;
    const total = routeLength * conductors * 1.1;
    cableBySection.set(sizing.conductorSection, (cableBySection.get(sizing.conductorSection) ?? 0) + total);
    if (sizing.breakerRating) items.push({ category: "protecao", name: `Disjuntor ${sizing.breakerRating} A`, unit: "un", quantity: 1, note: circuit.id });
  }

  for (const [section, length] of cableBySection) {
    items.push({ category: "cabos", name: `Cabo ${String(section).replace(".", ",")} mm²`, unit: "m", quantity: round2(length), note: "Estimativa baseada nos eletrodutos conectados ao circuito; revisar roteamento e condutores especiais." });
  }

  const outletCount = doc.points.filter((p) => ["tug", "tug_dupla", "tug_tripla", "tug_usb", "tue", "tomada_equipamento", "tomada_externa"].includes(p.kind)).length;
  const switchCount = doc.points.filter((p) => p.kind.startsWith("interruptor_") || p.kind === "dimmer").length;
  if (outletCount + switchCount > 0) items.push({ category: "caixas", name: "Caixa 4x2", unit: "un", quantity: outletCount + switchCount, note: "Estimativa inicial por ponto de tomada/comando." });

  const lightCount = doc.points.filter((p) => ["ponto_luz", "luminaria", "spot"].includes(p.kind)).length;
  if (lightCount > 0) items.push({ category: "caixas", name: "Caixa de teto", unit: "un", quantity: lightCount, note: "Estimativa inicial por ponto de iluminação." });

  for (const circuit of analysis.circuits) {
    if (circuit.loads.length === 0) continue;
    items.push({ category: "identificacao", name: `${circuit.id}-F / ${circuit.id}-N / ${circuit.id}-PE`, unit: "un", quantity: circuit.loads.length * 6, note: "Anilhas estimadas considerando duas extremidades e três condutores básicos." });
  }

  return items.sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
}

function estimateCircuitRoute(doc: PlanDocument, circuitId: string, panelId: string | null) {
  const nodeIds = new Set(doc.points.filter((p) => p.circuit.trim().toUpperCase() === circuitId).map((p) => p.id));
  if (panelId) nodeIds.add(panelId);
  return doc.conduits.reduce((sum, conduit) => {
    if (!nodeIds.has(conduit.from) && !nodeIds.has(conduit.to)) return sum;
    const a = doc.points.find((p) => p.id === conduit.from) ?? doc.panels.find((p) => p.id === conduit.from);
    const b = doc.points.find((p) => p.id === conduit.to) ?? doc.panels.find((p) => p.id === conduit.to);
    if (!a || !b) return sum;
    return sum + Math.hypot(b.x - a.x, b.y - a.y);
  }, 0);
}

const round2 = (value: number) => Math.round(value * 100) / 100;
