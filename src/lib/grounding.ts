import type { PlanDocument } from "@/lib/electrical";

export type GroundingSystem = "TN-S" | "TN-C-S" | "TT" | "IT" | "custom";
export type GroundingConfig = {
  system: GroundingSystem;
  peBusbar: boolean;
  equipotentialBusbar: boolean;
  electrodeCount: number;
  electrodeLengthM: number | null;
  groundingConductorSection: number | null;
  inspectionBoxCount: number;
  notes: string;
};

type DocWithGrounding = PlanDocument & { grounding?: GroundingConfig };

export const DEFAULT_GROUNDING: GroundingConfig = {
  system: "TT",
  peBusbar: true,
  equipotentialBusbar: false,
  electrodeCount: 1,
  electrodeLengthM: null,
  groundingConductorSection: null,
  inspectionBoxCount: 1,
  notes: "",
};

export function getGrounding(doc: PlanDocument): GroundingConfig {
  return { ...DEFAULT_GROUNDING, ...((doc as DocWithGrounding).grounding ?? {}) };
}

export function setGrounding(doc: PlanDocument, patch: Partial<GroundingConfig>): PlanDocument {
  return { ...doc, grounding: { ...getGrounding(doc), ...patch } } as PlanDocument;
}
