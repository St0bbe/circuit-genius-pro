import type { PlanDocument } from "@/lib/electrical";
import { analyzeProject } from "@/lib/engineering";

export type ProtectionConfig = {
  circuitId: string;
  breaker: number | null;
  drRequired: boolean;
  drCurrent: number | null;
  drSensitivityMa: number | null;
  dpsRequired: boolean;
  poles: 1 | 2 | 3 | 4;
};

type DocWithProtection = PlanDocument & { protections?: ProtectionConfig[] };

export function getProtectionConfigs(doc: PlanDocument): ProtectionConfig[] {
  return Array.isArray((doc as DocWithProtection).protections) ? (doc as DocWithProtection).protections! : [];
}

export function ensureProtectionConfigs(doc: PlanDocument): PlanDocument {
  const existing = new Map(getProtectionConfigs(doc).map((p) => [p.circuitId, p]));
  for (const circuit of analyzeProject(doc).circuits) {
    if (!existing.has(circuit.id)) {
      existing.set(circuit.id, {
        circuitId: circuit.id,
        breaker: null,
        drRequired: false,
        drCurrent: null,
        drSensitivityMa: null,
        dpsRequired: false,
        poles: circuit.voltage === 220 ? 2 : 1,
      });
    }
  }
  return { ...doc, protections: [...existing.values()] } as PlanDocument;
}

export function setProtectionConfig(doc: PlanDocument, circuitId: string, patch: Partial<ProtectionConfig>): PlanDocument {
  const current = getProtectionConfigs(doc);
  const found = current.find((p) => p.circuitId === circuitId);
  const base: ProtectionConfig = found ?? { circuitId, breaker: null, drRequired: false, drCurrent: null, drSensitivityMa: null, dpsRequired: false, poles: 1 };
  const next = current.filter((p) => p.circuitId !== circuitId).concat({ ...base, ...patch, circuitId });
  return { ...doc, protections: next } as PlanDocument;
}
