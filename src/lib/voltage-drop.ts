import type { PlanDocument } from "@/lib/electrical";
import { analyzeProject } from "@/lib/engineering";
import { preliminarySizing } from "@/lib/engineering-rules";
import { circuitRouteLength } from "@/lib/wiring";

export type VoltageDropResult = { circuitId: string; length: number; section: number | null; current: number | null; voltage: number | null; dropVolts: number | null; dropPercent: number | null; status: "ok" | "warning" | "unavailable" };

export function calculateVoltageDrops(doc: PlanDocument, copperResistivity = 0.0175): VoltageDropResult[] {
  return analyzeProject(doc).circuits.map((circuit) => {
    const sizing = preliminarySizing(circuit);
    const section = sizing.conductorSection;
    const current = circuit.designCurrent;
    const voltage = circuit.voltage;
    const length = circuitRouteLength(doc, circuit.id, circuit.panelId);
    if (!section || !current || !voltage || length <= 0) return { circuitId: circuit.id, length, section: section ?? null, current: current ?? null, voltage: voltage ?? null, dropVolts: null, dropPercent: null, status: "unavailable" };
    const factor = voltage === 220 ? 2 : 2;
    const dropVolts = (factor * copperResistivity * length * current) / section;
    const dropPercent = (dropVolts / voltage) * 100;
    return { circuitId: circuit.id, length, section, current, voltage, dropVolts, dropPercent, status: dropPercent > 4 ? "warning" : "ok" };
  });
}
