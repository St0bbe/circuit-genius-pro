import type { PlanDocument } from "@/lib/electrical";
import { analyzeProject } from "@/lib/engineering";
import { preliminarySizing } from "@/lib/engineering-rules";
import { calculateTerminals } from "@/lib/terminals";

export type MaterialItem = {
  category: "cabos" | "eletrodutos" | "caixas" | "protecao" | "identificacao" | "terminais" | "conectores" | "acessorios";
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
    const conductors = 3;
    const total = routeLength * conductors * 1.1;
    cableBySection.set(sizing.conductorSection, (cableBySection.get(sizing.conductorSection) ?? 0) + total);
    if (sizing.breakerRating) items.push({ category: "protecao", name: `Disjuntor ${sizing.breakerRating} A`, unit: "un", quantity: 1, note: circuit.id });
  }

  for (const [section, length] of cableBySection) {
    items.push({ category: "cabos", name: `Cabo ${String(section).replace(".", ",")} mm²`, unit: "m", quantity: round2(length), note: "Estimativa baseada nos eletrodutos conectados ao circuito; revisar roteamento e condutores especiais." });
  }

  const explicitBoxes = [
    ["caixa_4x2", "Caixa 4x2"],
    ["caixa_4x4", "Caixa 4x4"],
    ["caixa_passagem", "Caixa de passagem"],
    ["caixa_teto", "Caixa de teto"],
    ["condulete", "Condulete"],
  ] as const;
  let hasExplicitBoxes = false;
  for (const [kind, name] of explicitBoxes) {
    const quantity = doc.points.filter((p) => p.kind === kind).length;
    if (quantity) {
      hasExplicitBoxes = true;
      items.push({ category: kind === "condulete" ? "acessorios" : "caixas", name, unit: "un", quantity });
    }
  }

  if (!hasExplicitBoxes) {
    const outletCount = doc.points.filter((p) => ["tug", "tug_dupla", "tug_tripla", "tug_usb", "tue", "tomada_equipamento", "tomada_externa"].includes(p.kind)).length;
    const switchCount = doc.points.filter((p) => p.kind.startsWith("interruptor_") || p.kind === "dimmer").length;
    if (outletCount + switchCount > 0) items.push({ category: "caixas", name: "Caixa 4x2", unit: "un", quantity: outletCount + switchCount, note: "Estimativa automática porque não há caixas explícitas suficientes no desenho." });
    const lightCount = doc.points.filter((p) => ["ponto_luz", "luminaria", "spot"].includes(p.kind)).length;
    if (lightCount > 0) items.push({ category: "caixas", name: "Caixa de teto", unit: "un", quantity: lightCount, note: "Estimativa automática porque não há caixas explícitas suficientes no desenho." });
  }

  for (const circuit of analysis.circuits) {
    if (circuit.loads.length === 0) continue;
    items.push({ category: "identificacao", name: `${circuit.id}-F / ${circuit.id}-N / ${circuit.id}-PE`, unit: "un", quantity: circuit.loads.length * 6, note: "Anilhas estimadas considerando duas extremidades e três condutores básicos." });
  }

  for (const terminal of calculateTerminals(doc)) {
    items.push({ category: terminal.category === "terminal" ? "terminais" : terminal.category === "connector" ? "conectores" : "identificacao", name: terminal.name, unit: "un", quantity: terminal.quantity, note: terminal.note });
  }

  if (doc.conduits.length) {
    items.push({ category: "acessorios", name: "Curvas/conexões de eletroduto", unit: "un", quantity: Math.max(1, Math.ceil(doc.conduits.length * 0.5)), note: "Estimativa; ajuste conforme o traçado executivo." });
    items.push({ category: "acessorios", name: "Abraçadeiras e fixadores", unit: "un", quantity: Math.max(1, Math.ceil([...conduitByDiameter.values()].reduce((a, b) => a + b, 0) / 1.5)), note: "Estimativa por comprimento de eletroduto." });
  }

  return mergeItems(items).sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
}

function mergeItems(items: MaterialItem[]) {
  const map = new Map<string, MaterialItem>();
  for (const item of items) {
    const key = `${item.category}|${item.name}|${item.unit}`;
    const current = map.get(key);
    map.set(key, current ? { ...current, quantity: round2(current.quantity + item.quantity) } : item);
  }
  return [...map.values()];
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
