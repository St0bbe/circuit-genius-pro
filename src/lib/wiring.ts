import type { PlanDocument } from "@/lib/electrical";
import { analyzeProject } from "@/lib/engineering";
import { preliminarySizing } from "@/lib/engineering-rules";

export type WireRole = "F" | "N" | "PE" | "R" | "V1" | "V2";
export type WireEstimate = { circuitId: string; role: WireRole; section: number; length: number; purchaseLength: number; marker: string };

export function estimateWiring(doc: PlanDocument, margin = 0.1): WireEstimate[] {
  const overview = analyzeProject(doc);
  const result: WireEstimate[] = [];

  for (const circuit of overview.circuits) {
    const sizing = preliminarySizing(circuit);
    if (!sizing.conductorSection || circuit.loads.length === 0) continue;
    const route = circuitRouteLength(doc, circuit.id, circuit.panelId);
    if (route <= 0) continue;

    const roles: WireRole[] = circuit.voltage === 220 ? ["F", "N", "PE"] : ["F", "N", "PE"];
    for (const role of roles) {
      result.push({
        circuitId: circuit.id,
        role,
        section: sizing.conductorSection,
        length: round2(route),
        purchaseLength: round2(route * (1 + margin)),
        marker: `${circuit.id}-${role}`,
      });
    }
  }
  return result;
}

export function circuitRouteLength(doc: PlanDocument, circuitId: string, panelId: string | null) {
  const nodes = new Set(doc.points.filter((p) => p.circuit.trim().toUpperCase() === circuitId).map((p) => p.id));
  if (panelId) nodes.add(panelId);
  return doc.conduits.reduce((sum, c) => {
    if (!nodes.has(c.from) && !nodes.has(c.to)) return sum;
    const a = doc.points.find((p) => p.id === c.from) ?? doc.panels.find((p) => p.id === c.from);
    const b = doc.points.find((p) => p.id === c.to) ?? doc.panels.find((p) => p.id === c.to);
    if (!a || !b) return sum;
    return sum + Math.hypot(b.x - a.x, b.y - a.y);
  }, 0);
}

const round2 = (n: number) => Math.round(n * 100) / 100;
