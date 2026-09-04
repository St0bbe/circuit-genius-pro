import { CATALOG_BY_KIND, type PlanDocument, type PlanPoint } from "@/lib/electrical";

export type CircuitLoad = {
  pointId: string;
  label: string;
  kind: PlanPoint["kind"];
  power: number;
  voltage: number;
};

export type CircuitAnalysis = {
  id: string;
  description: string;
  loads: CircuitLoad[];
  installedPower: number;
  voltage: number | null;
  designCurrent: number | null;
  mixedVoltage: boolean;
};

export type EngineeringOverview = {
  circuits: CircuitAnalysis[];
  unassigned: PlanPoint[];
  installedPower: number;
  warnings: string[];
};

function circuitDescription(points: PlanPoint[]) {
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

export function analyzeCircuit(id: string, points: PlanPoint[]): CircuitAnalysis {
  const loads = points.map((p) => ({
    pointId: p.id,
    label: p.label,
    kind: p.kind,
    power: Math.max(0, p.power || 0),
    voltage: Math.max(0, p.voltage || 0),
  }));
  const installedPower = loads.reduce((sum, load) => sum + load.power, 0);
  const voltages = [...new Set(loads.map((load) => load.voltage).filter(Boolean))];
  const mixedVoltage = voltages.length > 1;
  const voltage = voltages.length === 1 ? voltages[0] : null;
  const designCurrent = voltage && !mixedVoltage ? installedPower / voltage : null;

  return {
    id,
    description: circuitDescription(points),
    loads,
    installedPower,
    voltage,
    designCurrent,
    mixedVoltage,
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

  const circuits = [...assigned.entries()]
    .map(([id, points]) => analyzeCircuit(id, points))
    .sort((a, b) => a.id.localeCompare(b.id, "pt-BR", { numeric: true }));

  const warnings: string[] = [];
  if (unassigned.length) warnings.push(`${unassigned.length} ponto(s) ainda não possuem circuito.`);
  for (const circuit of circuits) {
    if (circuit.mixedVoltage) warnings.push(`${circuit.id} contém cargas com tensões diferentes e precisa de revisão.`);
  }

  return {
    circuits,
    unassigned,
    installedPower: doc.points.reduce((sum, point) => sum + Math.max(0, point.power || 0), 0),
    warnings,
  };
}

export function nextCircuitId(doc: PlanDocument) {
  const numbers = doc.points
    .map((p) => /^C(\d+)$/i.exec(p.circuit.trim()))
    .filter((match): match is RegExpExecArray => Boolean(match))
    .map((match) => Number(match[1]));
  const next = numbers.length ? Math.max(...numbers) + 1 : 1;
  return `C${String(next).padStart(2, "0")}`;
}
