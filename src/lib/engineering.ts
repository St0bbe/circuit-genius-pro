import { CATALOG_BY_KIND, type PlanDocument, type PlanPoint } from "@/lib/electrical";
import { getCircuits, type Circuit } from "@/lib/circuits";

export type CircuitLoad = {
  pointId: string;
  label: string;
  kind: PlanPoint["kind"];
  power: number;
  voltage: number;
};

export type CircuitAnalysis = {
  id: string;
  name: string;
  description: string;
  loads: CircuitLoad[];
  installedPower: number;
  demandPower: number;
  demandFactor: number;
  voltage: number | null;
  designCurrent: number | null;
  mixedVoltage: boolean;
  phase: Circuit["phase"];
  panelId: string | null;
  enabled: boolean;
};

export type EngineeringOverview = {
  circuits: CircuitAnalysis[];
  unassigned: PlanPoint[];
  installedPower: number;
  demandPower: number;
  warnings: string[];
};

function inferredDescription(points: PlanPoint[]) {
  const layers = new Set(points.map((p) => CATALOG_BY_KIND[p.kind]?.layer));
  if (layers.size === 1) {
    const layer = [...layers][0];
    if (layer === "iluminacao") return "Iluminação";
    if (layer === "tomadas") return "Tomadas";
    if (layer === "equipamentos") return "Equipamentos";
    if (layer === "interruptores") return "Comandos";
  }
  return "Circuito misto";
}

export function analyzeCircuit(id: string, points: PlanPoint[], circuit?: Circuit): CircuitAnalysis {
  const loads = points.map((p) => ({
    pointId: p.id,
    label: p.label,
    kind: p.kind,
    power: Math.max(0, p.power || 0),
    voltage: Math.max(0, p.voltage || 0),
  }));
  const installedPower = loads.reduce((sum, load) => sum + load.power, 0);
  const demandFactor = Math.min(1, Math.max(0, circuit?.demandFactor ?? 1));
  const demandPower = installedPower * demandFactor;
  const loadVoltages = [...new Set(loads.map((load) => load.voltage).filter(Boolean))];
  const mixedVoltage = loadVoltages.length > 1 || (loadVoltages.length === 1 && Boolean(circuit) && loadVoltages[0] !== circuit!.voltage);
  const voltage = circuit?.voltage ?? (loadVoltages.length === 1 ? loadVoltages[0] : null);
  const designCurrent = voltage && !mixedVoltage ? demandPower / voltage : null;

  return {
    id,
    name: circuit?.name ?? id,
    description: circuit?.description || inferredDescription(points),
    loads,
    installedPower,
    demandPower,
    demandFactor,
    voltage,
    designCurrent,
    mixedVoltage,
    phase: circuit?.phase ?? "auto",
    panelId: circuit?.panelId ?? null,
    enabled: circuit?.enabled ?? true,
  };
}

export function analyzeProject(doc: PlanDocument): EngineeringOverview {
  const assigned = new Map<string, PlanPoint[]>();
  const unassigned: PlanPoint[] = [];

  for (const point of doc.points) {
    const circuit = point.circuit.trim().toUpperCase();
    if (!circuit) {
      unassigned.push(point);
      continue;
    }
    const list = assigned.get(circuit) ?? [];
    list.push(point);
    assigned.set(circuit, list);
  }

  const definitions = getCircuits(doc);
  const allIds = new Set([...definitions.map((c) => c.id), ...assigned.keys()]);
  const circuits = [...allIds]
    .map((id) => analyzeCircuit(id, assigned.get(id) ?? [], definitions.find((c) => c.id === id)))
    .sort((a, b) => a.id.localeCompare(b.id, "pt-BR", { numeric: true }));

  const warnings: string[] = [];
  if (unassigned.length) warnings.push(`${unassigned.length} ponto(s) ainda não possuem circuito.`);
  for (const circuit of circuits) {
    if (circuit.mixedVoltage) warnings.push(`${circuit.id} contém cargas incompatíveis com a tensão configurada.`);
    if (circuit.loads.length === 0) warnings.push(`${circuit.id} não possui cargas atribuídas.`);
    if (!circuit.panelId) warnings.push(`${circuit.id} ainda não está associado a um quadro.`);
  }

  return {
    circuits,
    unassigned,
    installedPower: doc.points.reduce((sum, point) => sum + Math.max(0, point.power || 0), 0),
    demandPower: circuits.reduce((sum, circuit) => sum + circuit.demandPower, 0),
    warnings,
  };
}

export function nextCircuitId(doc: PlanDocument) {
  const numbers = analyzeProject(doc).circuits
    .map((c) => /^C(\d+)$/i.exec(c.id))
    .filter((match): match is RegExpExecArray => Boolean(match))
    .map((match) => Number(match[1]));
  const next = numbers.length ? Math.max(...numbers) + 1 : 1;
  return `C${String(next).padStart(2, "0")}`;
}
