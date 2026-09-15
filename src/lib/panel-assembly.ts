import type { PlanDocument } from "@/lib/electrical";
import { analyzeProject } from "@/lib/engineering";
import { preliminarySizing } from "@/lib/engineering-rules";
import { getProtectionConfigs } from "@/lib/protection";
import { uid } from "@/lib/electrical";

export type PanelDeviceKind = "main" | "dps" | "dr" | "breaker" | "contactor" | "timer" | "reserve";
export type WireColor = "red" | "black" | "blue" | "green" | "yellow";
export type PanelDevice = {
  id: string;
  kind: PanelDeviceKind;
  label: string;
  modules: number;
  poles: number;
  rating?: number;
  circuitId?: string;
  rail: number;
  slot: number;
};
export type PanelWire = {
  id: string;
  from: string;
  to: string;
  color: WireColor;
  section: number;
  label: string;
};
export type PanelAssembly = {
  panelId: string;
  rows: number;
  modulesPerRow: number;
  devices: PanelDevice[];
  wires: PanelWire[];
  doorOpen: boolean;
};
type DocWithAssemblies = PlanDocument & { panelAssemblies?: PanelAssembly[] };

export const DEVICE_PRESETS: Record<PanelDeviceKind, Omit<PanelDevice, "id" | "rail" | "slot">> = {
  main: { kind: "main", label: "Disjuntor geral", modules: 2, poles: 2, rating: 63 },
  dps: { kind: "dps", label: "DPS", modules: 1, poles: 1, rating: 20 },
  dr: { kind: "dr", label: "DR 30 mA", modules: 2, poles: 2, rating: 63 },
  breaker: { kind: "breaker", label: "Disjuntor", modules: 1, poles: 1, rating: 16 },
  contactor: { kind: "contactor", label: "Contator", modules: 2, poles: 2, rating: 25 },
  timer: { kind: "timer", label: "Temporizador", modules: 1, poles: 1, rating: 16 },
  reserve: { kind: "reserve", label: "Reserva", modules: 1, poles: 1 },
};

export function getPanelAssemblies(doc: PlanDocument): PanelAssembly[] {
  return Array.isArray((doc as DocWithAssemblies).panelAssemblies)
    ? (doc as DocWithAssemblies).panelAssemblies!
    : [];
}

export function getPanelAssembly(doc: PlanDocument, panelId: string): PanelAssembly {
  return (
    getPanelAssemblies(doc).find((a) => a.panelId === panelId) ?? {
      panelId,
      rows: 2,
      modulesPerRow: 12,
      devices: [],
      wires: [],
      doorOpen: true,
    }
  );
}

export function setPanelAssembly(doc: PlanDocument, assembly: PanelAssembly): PlanDocument {
  const next = getPanelAssemblies(doc)
    .filter((a) => a.panelId !== assembly.panelId)
    .concat(assembly);
  return { ...doc, panelAssemblies: next } as PlanDocument;
}

export function firstFreeSlot(assembly: PanelAssembly, modules: number) {
  for (let rail = 0; rail < assembly.rows; rail++) {
    for (let slot = 0; slot <= assembly.modulesPerRow - modules; slot++) {
      const occupied = assembly.devices.some(
        (d) => d.rail === rail && slot < d.slot + d.modules && slot + modules > d.slot,
      );
      if (!occupied) return { rail, slot };
    }
  }
  return null;
}

export function addDevice(assembly: PanelAssembly, kind: PanelDeviceKind): PanelAssembly {
  const preset = DEVICE_PRESETS[kind];
  const position = firstFreeSlot(assembly, preset.modules);
  if (!position) return assembly;
  return { ...assembly, devices: [...assembly.devices, { ...preset, ...position, id: uid() }] };
}

export function autoBuildPanel(doc: PlanDocument, panelId: string): PanelAssembly {
  const circuits = analyzeProject(doc).circuits.filter((c) => c.panelId === panelId && c.enabled);
  const protections = getProtectionConfigs(doc);
  const requiredModules =
    2 + 2 + 2 + circuits.reduce((sum, c) => sum + (c.voltage === 220 ? 2 : 1), 0);
  const modulesPerRow = requiredModules <= 12 ? 12 : 18;
  const rows = Math.max(2, Math.ceil((requiredModules * 1.2) / modulesPerRow));
  let assembly: PanelAssembly = {
    panelId,
    rows,
    modulesPerRow,
    devices: [],
    wires: [],
    doorOpen: true,
  };
  for (const kind of ["main", "dps", "dps", "dr"] as PanelDeviceKind[])
    assembly = addDevice(assembly, kind);
  for (const circuit of circuits) {
    const sizing = preliminarySizing(circuit);
    const config = protections.find((p) => p.circuitId === circuit.id);
    const poles = config?.poles ?? (circuit.voltage === 220 ? 2 : 1);
    const preset = DEVICE_PRESETS.breaker;
    const position = firstFreeSlot(assembly, poles);
    if (!position) continue;
    assembly.devices.push({
      ...preset,
      ...position,
      id: uid(),
      modules: poles,
      poles,
      rating: config?.breaker ?? sizing.breakerRating ?? 16,
      circuitId: circuit.id,
      label: `${circuit.id} · ${circuit.description}`,
    });
  }
  const main = assembly.devices.find((d) => d.kind === "main");
  const dr = assembly.devices.find((d) => d.kind === "dr");
  if (main && dr)
    assembly.wires.push({
      id: uid(),
      from: main.id,
      to: dr.id,
      color: "red",
      section: 10,
      label: "Alimentação DR",
    });
  for (const breaker of assembly.devices.filter((d) => d.kind === "breaker")) {
    if (dr)
      assembly.wires.push({
        id: uid(),
        from: dr.id,
        to: breaker.id,
        color: "red",
        section: 6,
        label: breaker.circuitId ?? "Fase",
      });
    assembly.wires.push({
      id: uid(),
      from: "bar-neutral",
      to: breaker.id,
      color: "blue",
      section: 2.5,
      label: `${breaker.circuitId ?? "C"}-N`,
    });
    assembly.wires.push({
      id: uid(),
      from: "bar-earth",
      to: breaker.id,
      color: "green",
      section: 2.5,
      label: `${breaker.circuitId ?? "C"}-PE`,
    });
  }
  return assembly;
}

export function validateAssembly(doc: PlanDocument, assembly: PanelAssembly) {
  const issues: string[] = [];
  const circuits = analyzeProject(doc).circuits.filter(
    (c) => c.panelId === assembly.panelId && c.enabled,
  );
  if (!assembly.devices.some((d) => d.kind === "main")) issues.push("Falta o disjuntor geral.");
  if (!assembly.devices.some((d) => d.kind === "dr")) issues.push("Falta o dispositivo DR.");
  if (!assembly.devices.some((d) => d.kind === "dps")) issues.push("Falta proteção DPS.");
  for (const circuit of circuits)
    if (!assembly.devices.some((d) => d.circuitId === circuit.id))
      issues.push(`${circuit.id} está sem disjuntor no quadro.`);
  const overlaps = assembly.devices.some((a, i) =>
    assembly.devices.some(
      (b, j) =>
        i < j && a.rail === b.rail && a.slot < b.slot + b.modules && a.slot + a.modules > b.slot,
    ),
  );
  if (overlaps) issues.push("Há dispositivos ocupando os mesmos módulos.");
  if (!assembly.wires.some((w) => w.color === "blue"))
    issues.push("Barramento de neutro ainda não foi ligado.");
  if (!assembly.wires.some((w) => w.color === "green" || w.color === "yellow"))
    issues.push("Barramento de proteção (PE) ainda não foi ligado.");
  return issues;
}
