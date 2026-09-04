import type { PlanDocument } from "@/lib/electrical";
import { analyzeProject } from "@/lib/engineering";
import { preliminarySizing } from "@/lib/engineering-rules";
import { circuitRouteLength } from "@/lib/wiring";
import { getRulesProfile } from "@/lib/platform";

export type VoltageDropResult = {
  circuitId: string;
  length: number;
  section: number | null;
  current: number | null;
  voltage: number | null;
  dropVolts: number | null;
  dropPercent: number | null;
  limitPercent: number;
  status: "ok" | "warning" | "unavailable";
};

const RESISTIVITY = { copper: 0.0175, aluminum: 0.0282 } as const;

export function calculateVoltageDrops(doc: PlanDocument): VoltageDropResult[] {
  const limitPercent = getRulesProfile(doc).voltageDropLimitPct;
  return analyzeProject(doc).circuits.map((circuit) => {
    const sizing = preliminarySizing(circuit);
    const section = sizing.conductorSection;
    const current = circuit.designCurrent;
    const voltage = circuit.voltage;
    const measuredLength = circuitRouteLength(doc, circuit.id, circuit.panelId);
    const length = circuit.routeLengthOverrideM && circuit.routeLengthOverrideM > 0 ? circuit.routeLengthOverrideM : measuredLength;
    if (!section || !current || !voltage || length <= 0) return { circuitId: circuit.id, length, section: section ?? null, current: current ?? null, voltage: voltage ?? null, dropVolts: null, dropPercent: null, limitPercent, status: "unavailable" };
    const resistivity = RESISTIVITY[circuit.conductorMaterial] ?? RESISTIVITY.copper;
    const factor = 2;
    const dropVolts = (factor * resistivity * length * current) / section;
    const dropPercent = (dropVolts / voltage) * 100;
    return { circuitId: circuit.id, length, section, current, voltage, dropVolts, dropPercent, limitPercent, status: dropPercent > limitPercent ? "warning" : "ok" };
  });
}
