import type { CircuitAnalysis } from "@/lib/engineering";

export type EngineeringRuleProfile = {
  id: string;
  label: string;
  conductorByCurrent: { maxCurrent: number; section: number }[];
  breakerRatings: number[];
  maxVoltageDropPercent: number;
  conduitFillWarningPercent: number;
  conduitFillMaxPercent: number;
};

export const DEFAULT_ENGINEERING_PROFILE: EngineeringRuleProfile = {
  id: "br-preliminary",
  label: "Brasil · preliminar configurável",
  conductorByCurrent: [
    { maxCurrent: 15, section: 1.5 },
    { maxCurrent: 21, section: 2.5 },
    { maxCurrent: 28, section: 4 },
    { maxCurrent: 36, section: 6 },
    { maxCurrent: 50, section: 10 },
    { maxCurrent: 68, section: 16 },
  ],
  breakerRatings: [6, 10, 16, 20, 25, 32, 40, 50, 63],
  maxVoltageDropPercent: 4,
  conduitFillWarningPercent: 32,
  conduitFillMaxPercent: 40,
};

export type PreliminarySizing = {
  conductorSection: number | null;
  breakerRating: number | null;
  current: number | null;
  status: "ok" | "review" | "unavailable";
  notes: string[];
};

export function preliminarySizing(
  circuit: CircuitAnalysis,
  profile: EngineeringRuleProfile = DEFAULT_ENGINEERING_PROFILE,
): PreliminarySizing {
  const current = circuit.designCurrent;
  if (current == null || !Number.isFinite(current) || current <= 0) {
    return { conductorSection: null, breakerRating: null, current: current ?? null, status: "unavailable", notes: ["Corrente de projeto indisponível."] };
  }

  const conductor = profile.conductorByCurrent.find((entry) => current <= entry.maxCurrent);
  if (!conductor) {
    return { conductorSection: null, breakerRating: null, current, status: "review", notes: ["Corrente acima da faixa preliminar configurada."] };
  }

  const breaker = profile.breakerRatings.find((rating) => rating >= current && rating <= conductor.maxCurrent);
  const notes: string[] = [];
  if (!breaker) notes.push("Nenhum disjuntor padrão da configuração atende simultaneamente corrente e capacidade preliminar do condutor.");
  notes.push("Resultado preliminar: confirmar método de instalação, temperatura, agrupamento, queda de tensão e norma aplicável.");

  return {
    conductorSection: conductor.section,
    breakerRating: breaker ?? null,
    current,
    status: breaker ? "ok" : "review",
    notes,
  };
}
