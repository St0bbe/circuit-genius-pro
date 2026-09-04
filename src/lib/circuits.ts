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

function safeCircuitCode(value: unknown) {
  return typeof value === "string" ? value.trim().toUpperCase() : "";
}

function safePositive(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

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
  const id = safeCircuitCode(circuit?.id);
  const voltage = Number(circuit?.voltage) === 220 ? 220 : 127;
  const phase: CircuitPhase = ["A", "B", "C", "AB", "BC", "CA", "auto"].includes(String(circuit?.phase))
    ? circuit.phase
    : "auto";
  const type: CircuitType = ["lighting", "outlets", "equipment", "mixed"].includes(String(circuit?.type))
    ? circuit.type
    : "mixed";

  return {
    ...defaults(),
    ...circuit,
    id,
    name: typeof circuit?.name === "string" && circuit.name.trim() ? circuit.name : id,
    description: typeof circuit?.description === "string" && circuit.description.trim() ? circuit.description : defaultDescription(type),
    type,
    voltage,
    phase,
    panelId: typeof circuit?.panelId === "string" && circuit.panelId.trim() ? circuit.panelId : null,
    demandFactor: safePositive(circuit?.demandFactor, 1),
    enabled: circuit?.enabled !== false,
    installationMethod: typeof circuit?.installationMethod === "string" && circuit.installationMethod.trim() ? circuit.installationMethod : "configurar",
    ambientCorrection: safePositive(circuit?.ambientCorrection, 1),
    groupingCorrection: safePositive(circuit?.groupingCorrection, 1),
    conductorMaterial: circuit?.conductorMaterial === "aluminum" ? "aluminum" : "copper",
    routeLengthOverrideM: Number.isFinite(Number(circuit?.routeLengthOverrideM)) && Number(circuit?.routeLengthOverrideM) > 0 ? Number(circuit.routeLengthOverrideM) : null,
    powerFactor: safePositive(circuit?.powerFactor, 1),
  };
}

function normalizePoint(point: PlanPoint): PlanPoint {
  const def = CATALOG_BY_KIND[point?.kind];
  return {
    ...point,
    id: typeof point?.id === "string" ? point.id : "",
    label: typeof point?.label === "string" ? point.label : def?.short ?? "P",
    x: Number.isFinite(Number(point?.x)) ? Number(point.x) : 0,
    y: Number.isFinite(Number(point?.y)) ? Number(point.y) : 0,
    power: Number.isFinite(Number(point?.power)) ? Number(point.power) : def?.power ?? 0,
    voltage: Number(point?.voltage) === 220 ? 220 : Number(point?.voltage) === 127 ? 127 : def?.voltage ?? 127,
    height: Number.isFinite(Number(point?.height)) ? Number(point.height) : def?.height ?? 0,
    circuit: safeCircuitCode(point?.circuit),
    notes: typeof point?.notes === "string" ? point.notes : undefined,
  };
}

export function circuitFromPoints(id: string, points: PlanPoint[]): Circuit {
  const type = inferCircuitType(points);
  return { id, name: id, description: defaultDescription(type), type, voltage: inferVoltage(points), phase: "auto", panelId: null, demandFactor: 1, enabled: true, ...defaults() };
}

export function getCircuits(doc: PlanDocument): Circuit[] {
  const raw = Array.isArray((doc as DocumentWithCircuits).circuits) ? (doc as DocumentWithCircuits).circuits! : [];
  return raw.map((circuit) => normalizeCircuit(circuit)).filter((circuit) => Boolean(circuit.id));
}

export function withCircuits(doc: PlanDocument, circuits: Circuit[]): PlanDocument {
  return { ...doc, circuits: circuits.map(normalizeCircuit).filter((circuit) => Boolean(circuit.id)) } as PlanDocument;
}

export function normalizeProjectDocument(raw: unknown): PlanDocument {
  const rawObject = raw && typeof raw === "object" && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
  // Preserve extension data while sanitizing the core drawing fields. Stored JSON can
  // come from older revisions or manual edits, so strings/numbers are normalized here
  // before any engineering module renders.
  const normalized = normalizeDocument(raw);
  const base = {
    ...rawObject,
    ...normalized,
    points: normalized.points.filter((point): point is PlanPoint => Boolean(point && typeof point === "object")).map(normalizePoint),
  } as PlanDocument;

  const candidateCircuits = Array.isArray((raw as { circuits?: unknown[] } | null)?.circuits)
    ? ((raw as { circuits: unknown[] }).circuits ?? [])
    : [];
  const rawCircuits = candidateCircuits.filter((value): value is Circuit => Boolean(value && typeof value === "object"));
  const byId = new Map<string, Circuit>();

  for (const circuit of rawCircuits) {
    const normalizedCircuit = normalizeCircuit(circuit);
    if (normalizedCircuit.id) byId.set(normalizedCircuit.id, normalizedCircuit);
  }

  const groups = new Map<string, PlanPoint[]>();
  for (const point of base.points) {
    const id = safeCircuitCode(point.circuit);
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
  const id = safeCircuitCode(partial?.id) || nextCircuitCode(doc);
  return normalizeCircuit({ id, name: partial?.name ?? id, description: partial?.description ?? "Novo circuito", type: partial?.type ?? "mixed", voltage: partial?.voltage ?? 127, phase: partial?.phase ?? "auto", panelId: partial?.panelId ?? null, demandFactor: partial?.demandFactor ?? 1, enabled: partial?.enabled ?? true, ...defaults(), ...partial } as Circuit);
}

export function removeCircuit(doc: PlanDocument, id: string): PlanDocument {
  const target = safeCircuitCode(id);
  return withCircuits({ ...doc, points: doc.points.map((point) => safeCircuitCode(point.circuit) === target ? { ...point, circuit: "" } : point) }, getCircuits(doc).filter((circuit) => circuit.id !== target));
}
