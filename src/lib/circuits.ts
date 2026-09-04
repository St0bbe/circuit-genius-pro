import { CATALOG_BY_KIND, normalizeDocument, type PlanDocument, type PlanPoint } from "@/lib/electrical";

export type CircuitType = "lighting" | "outlets" | "equipment" | "mixed";
export type CircuitPhase = "A" | "B" | "C" | "AB" | "BC" | "CA" | "auto";

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

export function circuitFromPoints(id: string, points: PlanPoint[]): Circuit {
  const type = inferCircuitType(points);
  return {
    id,
    name: id,
    description: defaultDescription(type),
    type,
    voltage: inferVoltage(points),
    phase: "auto",
    panelId: null,
    demandFactor: 1,
    enabled: true,
  };
}

export function getCircuits(doc: PlanDocument): Circuit[] {
  return Array.isArray((doc as DocumentWithCircuits).circuits) ? (doc as DocumentWithCircuits).circuits! : [];
}

export function withCircuits(doc: PlanDocument, circuits: Circuit[]): PlanDocument {
  return { ...doc, circuits } as PlanDocument;
}

export function normalizeProjectDocument(raw: unknown): PlanDocument {
  const base = normalizeDocument(raw);
  const rawCircuits = Array.isArray((raw as { circuits?: unknown[] } | null)?.circuits)
    ? ((raw as { circuits: Circuit[] }).circuits ?? [])
    : [];

  const byId = new Map(rawCircuits.filter((c) => c?.id).map((c) => [c.id.toUpperCase(), { ...c, id: c.id.toUpperCase() }]));
  const groups = new Map<string, PlanPoint[]>();

  for (const point of base.points) {
    const id = point.circuit.trim().toUpperCase();
    if (!id) continue;
    const list = groups.get(id) ?? [];
    list.push(point);
    groups.set(id, list);
  }

  for (const [id, points] of groups) {
    if (!byId.has(id)) byId.set(id, circuitFromPoints(id, points));
  }

  return withCircuits(base, [...byId.values()].sort((a, b) => a.id.localeCompare(b.id, "pt-BR", { numeric: true })));
}

export function nextCircuitCode(doc: PlanDocument) {
  const numbers = getCircuits(doc)
    .map((c) => /^C(\d+)$/i.exec(c.id))
    .filter((match): match is RegExpExecArray => Boolean(match))
    .map((match) => Number(match[1]));
  const next = numbers.length ? Math.max(...numbers) + 1 : 1;
  return `C${String(next).padStart(2, "0")}`;
}

export function createCircuit(doc: PlanDocument, partial?: Partial<Circuit>): Circuit {
  const id = partial?.id?.trim().toUpperCase() || nextCircuitCode(doc);
  return {
    id,
    name: partial?.name ?? id,
    description: partial?.description ?? "Novo circuito",
    type: partial?.type ?? "mixed",
    voltage: partial?.voltage ?? 127,
    phase: partial?.phase ?? "auto",
    panelId: partial?.panelId ?? null,
    demandFactor: partial?.demandFactor ?? 1,
    enabled: partial?.enabled ?? true,
  };
}

export function removeCircuit(doc: PlanDocument, id: string): PlanDocument {
  return withCircuits(
    {
      ...doc,
      points: doc.points.map((point) => point.circuit.toUpperCase() === id.toUpperCase() ? { ...point, circuit: "" } : point),
    },
    getCircuits(doc).filter((circuit) => circuit.id !== id),
  );
}
