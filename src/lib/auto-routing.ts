import { getCircuits } from "@/lib/circuits";
import { nodePosition, uid, type Conduit, type Panel, type PlanDocument, type PlanVertex } from "@/lib/electrical";
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

function panelKind(panel: Panel) {
  return panel.kind ?? "distribution";
}

function resolveUpstreamSupply(doc: PlanDocument, distribution: Panel): Panel | null {
  if (distribution.upstreamPanelId) {
    const explicit = doc.panels.find((p) => p.id === distribution.upstreamPanelId && panelKind(p) === "supply");
    if (explicit) return explicit;
  }
  return doc.panels.find((p) => panelKind(p) === "supply") ?? null;
}

function feederConduitId(panelId: string) {
  return `auto-feeder-${panelId}`;
}

/**
 * Gera primeiro os alimentadores QA -> QD e depois as árvores dos circuitos finais.
 * Todos os trechos continuam sendo eletrodutos normais/editáveis na planta.
 */
export function autoRouteConduits(doc: PlanDocument): AutoRouteResult {
  const circuits = getCircuits(doc).filter((c) => c.enabled);
  const manual = doc.conduits.filter((c) => !c.id.startsWith("auto-"));
  const generated: Conduit[] = [];
  const skippedCircuits: string[] = [];

  const distributionPanels = doc.panels.filter((p) => panelKind(p) === "distribution");
  for (const distribution of distributionPanels) {
    const supply = resolveUpstreamSupply(doc, distribution);
    if (!supply || supply.id === distribution.id) continue;
    const a = nodePosition(doc, supply.id);
    const b = nodePosition(doc, distribution.id);
    if (!a || !b) continue;
    generated.push({
      id: feederConduitId(distribution.id),
      from: supply.id,
      to: distribution.id,
      diameter: 32,
      type: "normal",
      route: manhattanRoute(a, b),
    });
  }

  for (const circuit of circuits) {
    const preferredDistribution = doc.panels.find((p) => p.id === circuit.panelId && panelKind(p) === "distribution");
    const fallbackDistribution = doc.panels.find((p) => panelKind(p) === "distribution");
    const panelId = preferredDistribution?.id ?? circuit.panelId ?? fallbackDistribution?.id ?? doc.panels[0]?.id ?? null;
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
 * Associa fiação aos alimentadores QA -> QD e aos eletrodutos dos circuitos finais.
 * O alimentador recebe F/F2/PE como configuração inicial, podendo ser detalhado depois.
 */
export function autoRouteWiring(doc: PlanDocument): AutoRouteResult {
  const runs: WireRun[] = [];
  const skippedCircuits: string[] = [];

  for (const distribution of doc.panels.filter((p) => panelKind(p) === "distribution")) {
    const supply = resolveUpstreamSupply(doc, distribution);
    if (!supply) continue;
    const conduit = doc.conduits.find((c) => c.id === feederConduitId(distribution.id) || (c.from === supply.id && c.to === distribution.id) || (c.from === distribution.id && c.to === supply.id));
    if (!conduit) continue;
    runs.push({
      id: `wire-feeder-${distribution.id}`,
      circuitId: `ALIM-${distribution.name}`,
      conduitIds: [conduit.id],
      roles: ["F", "F2", "PE"],
      automatic: true,
    });
  }

  for (const circuit of getCircuits(doc).filter((c) => c.enabled)) {
    const nodeIds = new Set(doc.points.filter((p) => p.circuit.trim().toUpperCase() === circuit.id).map((p) => p.id));
    const fallbackDistribution = doc.panels.find((p) => panelKind(p) === "distribution");
    const panelId = circuit.panelId ?? fallbackDistribution?.id ?? doc.panels[0]?.id ?? null;
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