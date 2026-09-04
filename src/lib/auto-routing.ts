import { getCircuits } from "@/lib/circuits";
import { nodePosition, uid, type Conduit, type PlanDocument, type PlanVertex } from "@/lib/electrical";
import type { WireRole } from "@/lib/wiring";

export type WireRun = {
  id: string;
  circuitId: string;
  conduitIds: string[];
  roles: WireRole[];
  automatic: boolean;
};

type DocumentWithWireRuns = PlanDocument & { wireRuns?: WireRun[] };

export type AutoRouteResult = {
  doc: PlanDocument;
  created: number;
  skippedCircuits: string[];
};

export function getWireRuns(doc: PlanDocument): WireRun[] {
  const runs = (doc as DocumentWithWireRuns).wireRuns;
  return Array.isArray(runs) ? runs : [];
}

export function withWireRuns(doc: PlanDocument, wireRuns: WireRun[]): PlanDocument {
  return { ...doc, wireRuns } as PlanDocument;
}

function manhattanRoute(a: PlanVertex, b: PlanVertex): PlanVertex[] {
  if (Math.abs(a.x - b.x) < 0.01 || Math.abs(a.y - b.y) < 0.01) return [];
  return [{ x: b.x, y: a.y }];
}

function distance(doc: PlanDocument, aId: string, bId: string) {
  const a = nodePosition(doc, aId);
  const b = nodePosition(doc, bId);
  if (!a || !b) return Number.POSITIVE_INFINITY;
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/**
 * Creates a simple Manhattan tree for each configured circuit.
 * Generated routes are intentionally editable: every conduit is persisted as a normal
 * Conduit and its intermediate route points can be dragged in the canvas afterwards.
 */
export function autoRouteConduits(doc: PlanDocument): AutoRouteResult {
  const circuits = getCircuits(doc).filter((c) => c.enabled);
  const manual = doc.conduits.filter((c) => !c.id.startsWith("auto-"));
  const generated: Conduit[] = [];
  const skippedCircuits: string[] = [];

  for (const circuit of circuits) {
    const panelId = circuit.panelId ?? doc.panels[0]?.id ?? null;
    const loads = doc.points.filter((p) => p.circuit.trim().toUpperCase() === circuit.id.toUpperCase());
    if (!panelId || loads.length === 0 || !nodePosition(doc, panelId)) {
      skippedCircuits.push(circuit.id);
      continue;
    }

    const connected = new Set<string>([panelId]);
    const remaining = new Set(loads.map((p) => p.id));

    while (remaining.size) {
      let bestFrom: string | null = null;
      let bestTo: string | null = null;
      let bestDistance = Number.POSITIVE_INFINITY;
      for (const from of connected) {
        for (const to of remaining) {
          const d = distance(doc, from, to);
          if (d < bestDistance) {
            bestDistance = d;
            bestFrom = from;
            bestTo = to;
          }
        }
      }
      if (!bestFrom || !bestTo || !Number.isFinite(bestDistance)) break;
      const a = nodePosition(doc, bestFrom)!;
      const b = nodePosition(doc, bestTo)!;
      generated.push({
        id: `auto-${circuit.id}-${uid()}`,
        from: bestFrom,
        to: bestTo,
        diameter: 25,
        type: "normal",
        route: manhattanRoute(a, b),
      });
      connected.add(bestTo);
      remaining.delete(bestTo);
    }
  }

  return { doc: { ...doc, conduits: [...manual, ...generated] }, created: generated.length, skippedCircuits };
}

function rolesForCircuit(doc: PlanDocument, circuitId: string): WireRole[] {
  const circuit = getCircuits(doc).find((c) => c.id === circuitId);
  if (!circuit) return [];
  let roles: WireRole[] = circuit.voltage === 220 && ["AB", "BC", "CA", "auto"].includes(circuit.phase)
    ? ["F", "F2", "PE"]
    : ["F", "N", "PE"];

  const points = doc.points.filter((p) => p.circuit.trim().toUpperCase() === circuitId);
  const commands = points.filter((p) => ["interruptor_simples", "interruptor_paralelo", "interruptor_intermediario"].includes(p.kind));
  const hasLighting = points.some((p) => ["ponto_luz", "luminaria", "spot", "arandela", "perfil_led"].includes(p.kind));
  if (hasLighting && commands.length) roles.push("R");
  if (commands.filter((p) => ["interruptor_paralelo", "interruptor_intermediario"].includes(p.kind)).length >= 2) roles.push("V1", "V2");
  return [...new Set(roles)];
}

/**
 * Associates conductors to the existing conduit network. Geometry remains owned by
 * the conduit, so moving a bend after automatic routing also changes the wire path.
 */
export function autoRouteWiring(doc: PlanDocument): AutoRouteResult {
  const runs: WireRun[] = [];
  const skippedCircuits: string[] = [];
  for (const circuit of getCircuits(doc).filter((c) => c.enabled)) {
    const nodeIds = new Set(doc.points.filter((p) => p.circuit.trim().toUpperCase() === circuit.id).map((p) => p.id));
    const panelId = circuit.panelId ?? doc.panels[0]?.id ?? null;
    if (panelId) nodeIds.add(panelId);
    const conduitIds = doc.conduits.filter((c) => nodeIds.has(c.from) || nodeIds.has(c.to)).map((c) => c.id);
    if (!conduitIds.length) {
      skippedCircuits.push(circuit.id);
      continue;
    }
    runs.push({ id: `wire-${circuit.id}-${uid()}`, circuitId: circuit.id, conduitIds: [...new Set(conduitIds)], roles: rolesForCircuit(doc, circuit.id), automatic: true });
  }
  return { doc: withWireRuns(doc, runs), created: runs.length, skippedCircuits };
}
