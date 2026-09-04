export type LayerId =
  | "arquitetura" | "iluminacao" | "tomadas" | "interruptores" | "equipamentos"
  | "eletrodutos" | "fiacao" | "quadro" | "dados" | "seguranca" | "outros";

export const LAYERS: { id: LayerId; label: string; colorVar: string }[] = [
  { id: "arquitetura", label: "Arquitetura", colorVar: "var(--wall)" },
  { id: "iluminacao", label: "Iluminação", colorVar: "var(--layer-light)" },
  { id: "tomadas", label: "Tomadas", colorVar: "var(--layer-outlet)" },
  { id: "interruptores", label: "Interruptores", colorVar: "var(--layer-switch)" },
  { id: "equipamentos", label: "Equipamentos", colorVar: "var(--layer-equipment)" },
  { id: "eletrodutos", label: "Eletrodutos", colorVar: "var(--layer-conduit)" },
  { id: "fiacao", label: "Fiação", colorVar: "var(--primary)" },
  { id: "quadro", label: "Quadro", colorVar: "var(--layer-panel)" },
  { id: "dados", label: "Dados", colorVar: "var(--muted-foreground)" },
  { id: "seguranca", label: "Segurança", colorVar: "var(--destructive)" },
  { id: "outros", label: "Outros", colorVar: "var(--foreground)" },
];

export type ComponentKind =
  | "ponto_luz" | "luminaria" | "spot" | "arandela" | "perfil_led" | "sensor_presenca" | "fotocelula"
  | "interruptor_simples" | "interruptor_paralelo" | "interruptor_intermediario" | "dimmer" | "rele" | "comando_sensor"
  | "tug" | "tug_dupla" | "tug_tripla" | "tug_usb" | "tue" | "tomada_equipamento" | "tomada_piso" | "tomada_externa"
  | "chuveiro" | "torneira_eletrica" | "forno" | "cooktop" | "microondas" | "maquina_lavar" | "maquina_secar"
  | "ar_condicionado" | "bomba" | "motor" | "motor_portao" | "aquecedor" | "geladeira" | "freezer" | "lava_loucas"
  | "caixa_4x2" | "caixa_4x4" | "caixa_passagem" | "caixa_teto" | "condulete";

export type ComponentDef = {
  kind: ComponentKind; label: string; short: string; layer: LayerId;
  group: "Iluminação" | "Comandos" | "Tomadas" | "Equipamentos" | "Caixas";
  power: number; voltage: 127 | 220; height: number;
};

export const CATALOG: ComponentDef[] = [
  { kind: "ponto_luz", label: "Ponto de luz", short: "L", layer: "iluminacao", group: "Iluminação", power: 100, voltage: 127, height: 2.8 },
  { kind: "luminaria", label: "Luminária", short: "LM", layer: "iluminacao", group: "Iluminação", power: 60, voltage: 127, height: 2.8 },
  { kind: "spot", label: "Spot", short: "SP", layer: "iluminacao", group: "Iluminação", power: 12, voltage: 127, height: 2.8 },
  { kind: "arandela", label: "Arandela", short: "AR", layer: "iluminacao", group: "Iluminação", power: 60, voltage: 127, height: 2 },
  { kind: "perfil_led", label: "Perfil LED", short: "PL", layer: "iluminacao", group: "Iluminação", power: 24, voltage: 127, height: 2.8 },
  { kind: "sensor_presenca", label: "Sensor de presença", short: "SN", layer: "iluminacao", group: "Iluminação", power: 5, voltage: 127, height: 2.2 },
  { kind: "fotocelula", label: "Fotocélula", short: "FC", layer: "iluminacao", group: "Iluminação", power: 5, voltage: 127, height: 2.2 },
  { kind: "interruptor_simples", label: "Interruptor simples", short: "S", layer: "interruptores", group: "Comandos", power: 0, voltage: 127, height: 1.3 },
  { kind: "interruptor_paralelo", label: "Paralelo (three-way)", short: "P", layer: "interruptores", group: "Comandos", power: 0, voltage: 127, height: 1.3 },
  { kind: "interruptor_intermediario", label: "Intermediário (four-way)", short: "I", layer: "interruptores", group: "Comandos", power: 0, voltage: 127, height: 1.3 },
  { kind: "dimmer", label: "Dimmer", short: "DM", layer: "interruptores", group: "Comandos", power: 0, voltage: 127, height: 1.3 },
  { kind: "rele", label: "Relé", short: "RL", layer: "interruptores", group: "Comandos", power: 0, voltage: 127, height: 1.3 },
  { kind: "comando_sensor", label: "Comando por sensor", short: "CS", layer: "interruptores", group: "Comandos", power: 0, voltage: 127, height: 1.3 },
  { kind: "tug", label: "Tomada TUG", short: "TUG", layer: "tomadas", group: "Tomadas", power: 100, voltage: 127, height: 0.3 },
  { kind: "tug_dupla", label: "Tomada dupla", short: "2T", layer: "tomadas", group: "Tomadas", power: 200, voltage: 127, height: 0.3 },
  { kind: "tug_tripla", label: "Tomada tripla", short: "3T", layer: "tomadas", group: "Tomadas", power: 300, voltage: 127, height: 0.3 },
  { kind: "tug_usb", label: "Tomada USB", short: "USB", layer: "tomadas", group: "Tomadas", power: 100, voltage: 127, height: 0.3 },
  { kind: "tue", label: "Tomada TUE", short: "TUE", layer: "tomadas", group: "Tomadas", power: 600, voltage: 127, height: 1.2 },
  { kind: "tomada_equipamento", label: "Tomada para equipamento", short: "TEQ", layer: "tomadas", group: "Tomadas", power: 1000, voltage: 127, height: 1.2 },
  { kind: "tomada_piso", label: "Tomada de piso", short: "TP", layer: "tomadas", group: "Tomadas", power: 100, voltage: 127, height: 0 },
  { kind: "tomada_externa", label: "Tomada externa", short: "TE", layer: "tomadas", group: "Tomadas", power: 100, voltage: 127, height: 0.6 },
  { kind: "chuveiro", label: "Chuveiro", short: "CH", layer: "equipamentos", group: "Equipamentos", power: 5500, voltage: 220, height: 2.2 },
  { kind: "torneira_eletrica", label: "Torneira elétrica", short: "TQ", layer: "equipamentos", group: "Equipamentos", power: 2800, voltage: 220, height: 1.4 },
  { kind: "forno", label: "Forno elétrico", short: "FR", layer: "equipamentos", group: "Equipamentos", power: 3500, voltage: 220, height: 1.4 },
  { kind: "cooktop", label: "Cooktop", short: "CT", layer: "equipamentos", group: "Equipamentos", power: 4000, voltage: 220, height: 0.9 },
  { kind: "microondas", label: "Micro-ondas", short: "MO", layer: "equipamentos", group: "Equipamentos", power: 1500, voltage: 127, height: 1.4 },
  { kind: "maquina_lavar", label: "Máquina de lavar", short: "ML", layer: "equipamentos", group: "Equipamentos", power: 1000, voltage: 127, height: 1.2 },
  { kind: "maquina_secar", label: "Máquina de secar", short: "MS", layer: "equipamentos", group: "Equipamentos", power: 2500, voltage: 220, height: 1.2 },
  { kind: "ar_condicionado", label: "Ar-condicionado", short: "AC", layer: "equipamentos", group: "Equipamentos", power: 1400, voltage: 220, height: 2.4 },
  { kind: "bomba", label: "Bomba", short: "BP", layer: "equipamentos", group: "Equipamentos", power: 750, voltage: 220, height: 0.5 },
  { kind: "motor", label: "Motor", short: "MT", layer: "equipamentos", group: "Equipamentos", power: 1000, voltage: 220, height: 0.5 },
  { kind: "motor_portao", label: "Motor de portão", short: "MP", layer: "equipamentos", group: "Equipamentos", power: 500, voltage: 127, height: 1.2 },
  { kind: "aquecedor", label: "Aquecedor", short: "AQ", layer: "equipamentos", group: "Equipamentos", power: 3000, voltage: 220, height: 1.5 },
  { kind: "geladeira", label: "Geladeira", short: "GE", layer: "equipamentos", group: "Equipamentos", power: 500, voltage: 127, height: 0.3 },
  { kind: "freezer", label: "Freezer", short: "FZ", layer: "equipamentos", group: "Equipamentos", power: 500, voltage: 127, height: 0.3 },
  { kind: "lava_loucas", label: "Lava-louças", short: "LL", layer: "equipamentos", group: "Equipamentos", power: 1800, voltage: 127, height: 0.6 },
  { kind: "caixa_4x2", label: "Caixa 4x2", short: "CX42", layer: "eletrodutos", group: "Caixas", power: 0, voltage: 127, height: 1.2 },
  { kind: "caixa_4x4", label: "Caixa 4x4", short: "CX44", layer: "eletrodutos", group: "Caixas", power: 0, voltage: 127, height: 1.2 },
  { kind: "caixa_passagem", label: "Caixa de passagem", short: "CXP", layer: "eletrodutos", group: "Caixas", power: 0, voltage: 127, height: 2.2 },
  { kind: "caixa_teto", label: "Caixa de teto", short: "CXT", layer: "eletrodutos", group: "Caixas", power: 0, voltage: 127, height: 2.8 },
  { kind: "condulete", label: "Condulete", short: "CDL", layer: "eletrodutos", group: "Caixas", power: 0, voltage: 127, height: 1.5 },
];

export const CATALOG_BY_KIND: Record<ComponentKind, ComponentDef> = Object.fromEntries(CATALOG.map((c) => [c.kind, c])) as Record<ComponentKind, ComponentDef>;

export type PlanVertex = { x: number; y: number };
export type Room = { id: string; name: string; x: number; y: number; w: number; h: number; points?: PlanVertex[]; labelX?: number; labelY?: number };
export type PlanPoint = { id: string; kind: ComponentKind; x: number; y: number; label: string; power: number; voltage: number; height: number; circuit: string; notes?: string; rotation?: number; mirrored?: boolean };
export type Panel = { id: string; name: string; x: number; y: number; rotation?: number };
export type ConduitType = "normal" | "ceiling" | "underground";
export type Conduit = { id: string; from: string; to: string; diameter: number; type?: ConduitType; route?: PlanVertex[] };
export type ArchitecturalKind = "wall" | "door" | "window";
export type ArchitecturalElement = {
  id: string;
  kind: ArchitecturalKind;
  x1: number; y1: number; x2: number; y2: number;
  thickness?: number;
  openingDirection?: "left" | "right";
};

export type PlanDocument = {
  rooms: Room[];
  points: PlanPoint[];
  panels: Panel[];
  conduits: Conduit[];
  architecture: ArchitecturalElement[];
};

export const EMPTY_DOCUMENT: PlanDocument = { rooms: [], points: [], panels: [], conduits: [], architecture: [] };

export function normalizeDocument(raw: unknown): PlanDocument {
  const d = (raw ?? {}) as Partial<PlanDocument>;
  return {
    rooms: Array.isArray(d.rooms) ? d.rooms : [],
    points: Array.isArray(d.points) ? d.points : [],
    panels: Array.isArray(d.panels) ? d.panels : [],
    conduits: Array.isArray(d.conduits) ? d.conduits.map((c) => ({ ...c, type: c.type ?? "normal", route: Array.isArray(c.route) ? c.route : [] })) : [],
    architecture: Array.isArray(d.architecture) ? d.architecture : [],
  };
}

export const uid = () => Math.random().toString(36).slice(2, 10);
export const PX_PER_M = 60;
export const GRID_M = 0.25;
export const snap = (v: number) => Math.round(v / GRID_M) * GRID_M;
export const fmtM = (v: number) => `${v.toFixed(2).replace(".", ",")} m`;

export function nodePosition(doc: PlanDocument, id: string): PlanVertex | null {
  const p = doc.points.find((n) => n.id === id); if (p) return { x: p.x, y: p.y };
  const q = doc.panels.find((n) => n.id === id); if (q) return { x: q.x, y: q.y };
  return null;
}

export function conduitPath(doc: PlanDocument, c: Conduit): PlanVertex[] {
  const a = nodePosition(doc, c.from);
  const b = nodePosition(doc, c.to);
  if (!a || !b) return [];
  return [a, ...(c.route ?? []), b];
}

export function conduitLength(doc: PlanDocument, c: Conduit): number {
  const path = conduitPath(doc, c);
  let total = 0;
  for (let i = 1; i < path.length; i++) total += Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y);
  return total;
}

export function architectureLength(e: ArchitecturalElement): number { return Math.hypot(e.x2 - e.x1, e.y2 - e.y1); }

export function roomArea(r: Room): number {
  const pts = r.points;
  if (!pts || pts.length < 3) return r.w * r.h;
  let sum = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return Math.abs(sum) / 2;
}

export function roomPerimeter(r: Room): number {
  const pts = r.points;
  if (!pts || pts.length < 3) return 2 * (r.w + r.h);
  let total = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    total += Math.hypot(b.x - a.x, b.y - a.y);
  }
  return total;
}

export function roomBounds(points: PlanVertex[]) {
  const xs = points.map((p) => p.x), ys = points.map((p) => p.y);
  const x = Math.min(...xs), y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

export function nextLabel(doc: PlanDocument, kind: ComponentKind): string { const def = CATALOG_BY_KIND[kind]; const n = doc.points.filter((p) => p.kind === kind).length + 1; return `${def.short}-${String(n).padStart(2, "0")}`; }

export type PlanSummary = { totalPoints: number; lighting: number; outlets: number; equipment: number; installedPower: number; conduitLength: number; area: number };
export function summarize(doc: PlanDocument): PlanSummary {
  let lighting = 0, outlets = 0, equipment = 0, installedPower = 0;
  for (const p of doc.points) { const def = CATALOG_BY_KIND[p.kind]; if (!def) continue; installedPower += p.power; if (def.layer === "iluminacao") lighting++; if (def.layer === "tomadas") outlets++; if (def.layer === "equipamentos") equipment++; }
  return { totalPoints: doc.points.length, lighting, outlets, equipment, installedPower, conduitLength: doc.conduits.reduce((acc, c) => acc + conduitLength(doc, c), 0), area: doc.rooms.reduce((acc, r) => acc + roomArea(r), 0) };
}