import type { PlanDocument } from "@/lib/electrical";
import { estimateWiring } from "@/lib/wiring";

export type ConduitStatus = "ok" | "warning" | "error" | "unknown";
export type ConduitAnalysis = {
  conduitId: string;
  length: number;
  diameter: number;
  conductorCount: number;
  estimatedFillPercent: number | null;
  status: ConduitStatus;
  notes: string[];
};

export function analyzeConduits(doc: PlanDocument): ConduitAnalysis[] {
  const wiring = estimateWiring(doc);
  return doc.conduits.map((conduit) => {
    const a = doc.points.find((p) => p.id === conduit.from) ?? doc.panels.find((p) => p.id === conduit.from);
    const b = doc.points.find((p) => p.id === conduit.to) ?? doc.panels.find((p) => p.id === conduit.to);
    const length = a && b ? Math.hypot(b.x - a.x, b.y - a.y) : 0;
    const touchedCircuitIds = new Set<string>();
    const endpoints = [conduit.from, conduit.to];
    for (const point of doc.points) {
      if (endpoints.includes(point.id) && point.circuit.trim()) touchedCircuitIds.add(point.circuit.trim().toUpperCase());
    }
    const conductorCount = wiring.filter((wire) => touchedCircuitIds.has(wire.circuitId)).length;
    const area = Math.PI * Math.pow(Math.max(conduit.diameter, 1) / 2, 2);
    const estimatedCableArea = conductorCount * 12;
    const fill = conductorCount > 0 ? Math.min(100, (estimatedCableArea / area) * 100) : null;
    const notes: string[] = [];
    let status: ConduitStatus = "unknown";
    if (fill != null) {
      status = fill > 40 ? "error" : fill > 32 ? "warning" : "ok";
      notes.push("Ocupação geométrica simplificada; substituir por cálculo com diâmetro externo real dos cabos da biblioteca.");
    } else notes.push("Ainda não foi possível inferir os condutores deste trecho.");
    return { conduitId: conduit.id, length, diameter: conduit.diameter, conductorCount, estimatedFillPercent: fill, status, notes };
  });
}
