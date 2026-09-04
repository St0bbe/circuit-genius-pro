import { CATALOG_BY_KIND, normalizeDocument, type PlanDocument, type PlanPoint } from "@/lib/electrical";

export type CircuitType = "lighting" | "outlets" | "equipment" | "mixed";
export type CircuitPhase = "A" | "B" | "C" | "AB" | "BC" | "CA" | "auto";
export type ConductorMaterial = "copper" | "aluminum";

export type Circuit = {
  id: string;
  name: string;
  description: string;
  type: CircuitType;
  voltage: 127 | 220;
  phase: CircuitPhase;
  panelId: string | null;
  demandFactor: number;
  enabled: boolean;
  installationMethod: string;
  ambientCorrection: number;
  groupingCorrection: number;
  conductorMaterial: ConductorMaterial;
  routeLengthOverrideM: number | null;
  powerFactor: number;
};

type DocumentWithCircuits = PlanDocument & { circuits?: Circuit[] };

function inferCircuitType(points: PlanPoint[]): CircuitType {
  const layers = new Set(points.map((point) => CATALOG_BY_KIND[point.kind]?.layer));
  if (layers.size !== 1) return "mixed";
  const layer = [...layers][0];
  if (layer === "iluminacao") return "lighting";
  if (layer === "tomadas") return "outlets";
  if (layer === "equipamentos") return "equipment";
  return "mixed";
}

function defaultDescription(type: CircuitType) {
  if (type === "lighting") return "Iluminação";
  if (type === "outlets") return "Tomadas";
  if (type === "equipment") return "Equipamentos";
  return "Circuito misto";
}

function inferVoltage(points: PlanPoint[]): 127 | 220 {
  const voltages = [...new Set(points.map((point) => Number(point.voltage)).filter((v) => v === 127 || v === 220))];
  return voltages.length === 1 ? (voltages[0] as 127 | 220) : 127;
}

function defaults(): Pick<Circuit, "installationMethod" | "ambientCorrection" | "groupingCorrection" | "conductorMaterial" | "routeLengthOverrideM" | "powerFactor"> {
  return { installationMethod: "configurar", ambientCorrection: 1, groupingCorrection: 1, conductorMaterial: "copper", routeLengthOverrideM: null, powerFactor: 1 };
}

function normalizeCircuit(circuit: Circuit): Circuit {
  return {
    ...defaults(),
    ...circuit,
    id: circuit.id.toUpperCase(),
    ambientCorrection: Number.isFinite(circuit.ambientCorrection) && circuit.ambientCorrection > 0 ? circuit.ambientCorrection : 1,
    groupingCorrection: Number.isFinite(circuit.groupingCorrection) && circuit.groupingCorrection > 0 ? circuit.groupingCorrection : 1,
    powerFactor: Number.isFinite(circuit.powerFactor) && circuit.powerFactor > 0 ? circuit.powerFactor : 1,
  };
}

export function circuitFromPoints(id: string, points: PlanPoint[]): Circuit {
  const type = inferCircuitType(points);
  return { id, name: id, description: defaultDescription(type), type, voltage: inferVoltage(points), phase: "auto", panelId: null, demandFactor: 1, enabled: true, ...defaults() };
}

export function getCircuits(doc: PlanDocument): Circuit[] {
  return Array.isArray((doc as DocumentWithCircuits).circuits) ? (doc as DocumentWithCircuits).circuits!.map(normalizeCircuit) : [];
}

export function withCircuits(doc: PlanDocument, circuits: Circuit[]): PlanDocument {
  return { ...doc, circuits: circuits.map(normalizeCircuit) } as PlanDocument;
}

export function normalizeProjectDocument(raw: unknown): PlanDocument {
  const base = normalizeDocument(raw);
  const rawCircuits = Array.isArray((raw as { circuits?: unknown[] } | null)?.circuits) ? ((raw as { circuits: Circuit[] }).circuits ?? []) : [];
  const byId = new Map(rawCircuits.filter((c) => c?.id).map((c) => [c.id.toUpperCase(), normalizeCircuit(c)]));
  const groups = new Map<string, PlanPoint[]>();
  for (const point of base.points) {
    const id = point.circuit.trim().toUpperCase();
    if (!id) continue;
    const list = groups.get(id) ?? [];
    list.push(point);
    groups.set(id, list);
  }
  for (const [id, points] of groups) if (!byId.has(id)) byId.set(id, circuitFromPoints(id, points));
  return withCircuits(base, [...byId.values()].sort((a, b) => a.id.localeCompare(b.id, "pt-BR", { numeric: true })));
}

export function nextCircuitCode(doc: PlanDocument) {
  const numbers = getCircuits(doc).map((c) => /^C(\d+)$/i.exec(c.id)).filter((match): match is RegExpExecArray => Boolean(match)).map((match) => Number(match[1]));
  const next = numbers.length ? Math.max(...numbers) + 1 : 1;
  return `C${String(next).padStart(2, "0")}`;
}

export function createCircuit(doc: PlanDocument, partial?: Partial<Circuit>): Circuit {
  const id = partial?.id?.trim().toUpperCase() || nextCircuitCode(doc);
  return normalizeCircuit({ id, name: partial?.name ?? id, description: partial?.description ?? "Novo circuito", type: partial?.type ?? "mixed", voltage: partial?.voltage ?? 127, phase: partial?.phase ?? "auto", panelId: partial?.panelId ?? null, demandFactor: partial?.demandFactor ?? 1, enabled: partial?.enabled ?? true, ...defaults(), ...partial } as Circuit);
}

export function removeCircuit(doc: PlanDocument, id: string): PlanDocument {
  return withCircuits({ ...doc, points: doc.points.map((point) => point.circuit.toUpperCase() === id.toUpperCase() ? { ...point, circuit: "" } : point) }, getCircuits(doc).filter((circuit) => circuit.id !== id));
}
