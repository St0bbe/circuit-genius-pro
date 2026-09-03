export type LayerId =
  | "arquitetura"
  | "iluminacao"
  | "tomadas"
  | "interruptores"
  | "equipamentos"
  | "eletrodutos"
  | "quadro";

export const LAYERS: { id: LayerId; label: string; colorVar: string }[] = [
  { id: "arquitetura", label: "Arquitetura", colorVar: "var(--wall)" },
  { id: "iluminacao", label: "Iluminação", colorVar: "var(--layer-light)" },
  { id: "tomadas", label: "Tomadas", colorVar: "var(--layer-outlet)" },
  { id: "interruptores", label: "Interruptores", colorVar: "var(--layer-switch)" },
  { id: "equipamentos", label: "Equipamentos", colorVar: "var(--layer-equipment)" },
  { id: "eletrodutos", label: "Eletrodutos", colorVar: "var(--layer-conduit)" },
  { id: "quadro", label: "Quadro", colorVar: "var(--layer-panel)" },
];

export type ComponentKind =
  | "ponto_luz"
  | "luminaria"
  | "spot"
  | "arandela"
  | "sensor_presenca"
  | "interruptor_simples"
  | "interruptor_paralelo"
  | "interruptor_intermediario"
  | "dimmer"
  | "tug"
  | "tug_dupla"
  | "tug_tripla"
  | "tue"
  | "tomada_piso"
  | "tomada_externa"
  | "chuveiro"
  | "ar_condicionado"
  | "forno"
  | "cooktop"
  | "maquina_lavar"
  | "torneira_eletrica"
  | "motor_portao";

export type ComponentDef = {
  kind: ComponentKind;
  label: string;
  short: string;
  layer: LayerId;
  group: "Iluminação" | "Comandos" | "Tomadas" | "Equipamentos";
  /** Potência padrão em VA/W */
  power: number;
  /** 127 | 220 */
  voltage: 127 | 220;
  /** Altura de instalação padrão em metros */
  height: number;
};

export const CATALOG: ComponentDef[] = [
  { kind: "ponto_luz", label: "Ponto de luz", short: "L", layer: "iluminacao", group: "Iluminação", power: 100, voltage: 127, height: 2.8 },
  { kind: "luminaria", label: "Luminária", short: "LM", layer: "iluminacao", group: "Iluminação", power: 60, voltage: 127, height: 2.8 },
  { kind: "spot", label: "Spot", short: "SP", layer: "iluminacao", group: "Iluminação", power: 12, voltage: 127, height: 2.8 },
  { kind: "arandela", label: "Arandela", short: "AR", layer: "iluminacao", group: "Iluminação", power: 60, voltage: 127, height: 2.0 },
  { kind: "sensor_presenca", label: "Sensor de presença", short: "SN", layer: "iluminacao", group: "Iluminação", power: 5, voltage: 127, height: 2.2 },

  { kind: "interruptor_simples", label: "Interruptor simples", short: "S", layer: "interruptores", group: "Comandos", power: 0, voltage: 127, height: 1.3 },
  { kind: "interruptor_paralelo", label: "Paralelo (three-way)", short: "P", layer: "interruptores", group: "Comandos", power: 0, voltage: 127, height: 1.3 },
  { kind: "interruptor_intermediario", label: "Intermediário (four-way)", short: "I", layer: "interruptores", group: "Comandos", power: 0, voltage: 127, height: 1.3 },
  { kind: "dimmer", label: "Dimmer", short: "DM", layer: "interruptores", group: "Comandos", power: 0, voltage: 127, height: 1.3 },

  { kind: "tug", label: "Tomada TUG", short: "TUG", layer: "tomadas", group: "Tomadas", power: 100, voltage: 127, height: 0.3 },
  { kind: "tug_dupla", label: "Tomada dupla", short: "2T", layer: "tomadas", group: "Tomadas", power: 200, voltage: 127, height: 0.3 },
  { kind: "tug_tripla", label: "Tomada tripla", short: "3T", layer: "tomadas", group: "Tomadas", power: 300, voltage: 127, height: 0.3 },
  { kind: "tue", label: "Tomada TUE", short: "TUE", layer: "tomadas", group: "Tomadas", power: 600, voltage: 127, height: 1.2 },
  { kind: "tomada_piso", label: "Tomada de piso", short: "TP", layer: "tomadas", group: "Tomadas", power: 100, voltage: 127, height: 0 },
  { kind: "tomada_externa", label: "Tomada externa", short: "TE", layer: "tomadas", group: "Tomadas", power: 100, voltage: 127, height: 0.6 },

  { kind: "chuveiro", label: "Chuveiro", short: "CH", layer: "equipamentos", group: "Equipamentos", power: 5500, voltage: 220, height: 2.2 },
  { kind: "torneira_eletrica", label: "Torneira elétrica", short: "TQ", layer: "equipamentos", group: "Equipamentos", power: 2800, voltage: 220, height: 1.4 },
  { kind: "ar_condicionado", label: "Ar-condicionado", short: "AC", layer: "equipamentos", group: "Equipamentos", power: 1400, voltage: 220, height: 2.4 },
  { kind: "forno", label: "Forno elétrico", short: "FR", layer: "equipamentos", group: "Equipamentos", power: 3500, voltage: 220, height: 1.4 },
  { kind: "cooktop", label: "Cooktop", short: "CT", layer: "equipamentos", group: "Equipamentos", power: 4000, voltage: 220, height: 0.9 },
  { kind: "maquina_lavar", label: "Máquina de lavar", short: "ML", layer: "equipamentos", group: "Equipamentos", power: 1000, voltage: 127, height: 1.2 },
  { kind: "motor_portao", label: "Motor de portão", short: "MP", layer: "equipamentos", group: "Equipamentos", power: 500, voltage: 127, height: 1.2 },
];

export const CATALOG_BY_KIND: Record<ComponentKind, ComponentDef> = Object.fromEntries(
  CATALOG.map((c) => [c.kind, c]),
) as Record<ComponentKind, ComponentDef>;

export type Room = {
  id: string;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
};

export type PlanPoint = {
  id: string;
  kind: ComponentKind;
  x: number;
  y: number;
  label: string;
  power: number;
  voltage: number;
  height: number;
  circuit: string;
  notes?: string;
};

export type Panel = {
  id: string;
  name: string;
  x: number;
  y: number;
};

export type Conduit = {
  id: string;
  from: string;
  to: string;
  diameter: number;
};

export type PlanDocument = {
  rooms: Room[];
  points: PlanPoint[];
  panels: Panel[];
  conduits: Conduit[];
};

export const EMPTY_DOCUMENT: PlanDocument = {
  rooms: [],
  points: [],
  panels: [],
  conduits: [],
};

export function normalizeDocument(raw: unknown): PlanDocument {
  const d = (raw ?? {}) as Partial<PlanDocument>;
  return {
    rooms: Array.isArray(d.rooms) ? d.rooms : [],
    points: Array.isArray(d.points) ? d.points : [],
    panels: Array.isArray(d.panels) ? d.panels : [],
    conduits: Array.isArray(d.conduits) ? d.conduits : [],
  };
}

export const uid = () => Math.random().toString(36).slice(2, 10);

/** metros -> pixels na escala base do editor */
export const PX_PER_M = 60;
export const GRID_M = 0.25;

export const snap = (v: number) => Math.round(v / GRID_M) * GRID_M;

export const fmtM = (v: number) => `${v.toFixed(2).replace(".", ",")} m`;

export function nodePosition(doc: PlanDocument, id: string): { x: number; y: number } | null {
  const p = doc.points.find((n) => n.id === id);
  if (p) return { x: p.x, y: p.y };
  const q = doc.panels.find((n) => n.id === id);
  if (q) return { x: q.x, y: q.y };
  return null;
}

export function conduitLength(doc: PlanDocument, c: Conduit): number {
  const a = nodePosition(doc, c.from);
  const b = nodePosition(doc, c.to);
  if (!a || !b) return 0;
  return Math.hypot(b.x - a.x, b.y - a.y);
}

export function roomArea(r: Room): number {
  return r.w * r.h;
}

export function nextLabel(doc: PlanDocument, kind: ComponentKind): string {
  const def = CATALOG_BY_KIND[kind];
  const n = doc.points.filter((p) => p.kind === kind).length + 1;
  return `${def.short}-${String(n).padStart(2, "0")}`;
}

export type PlanSummary = {
  totalPoints: number;
  lighting: number;
  outlets: number;
  equipment: number;
  installedPower: number;
  conduitLength: number;
  area: number;
};

export function summarize(doc: PlanDocument): PlanSummary {
  let lighting = 0;
  let outlets = 0;
  let equipment = 0;
  let installedPower = 0;
  for (const p of doc.points) {
    const def = CATALOG_BY_KIND[p.kind];
    if (!def) continue;
    installedPower += p.power;
    if (def.layer === "iluminacao") lighting += 1;
    if (def.layer === "tomadas") outlets += 1;
    if (def.layer === "equipamentos") equipment += 1;
  }
  return {
    totalPoints: doc.points.length,
    lighting,
    outlets,
    equipment,
    installedPower,
    conduitLength: doc.conduits.reduce((acc, c) => acc + conduitLength(doc, c), 0),
    area: doc.rooms.reduce((acc, r) => acc + roomArea(r), 0),
  };
}
