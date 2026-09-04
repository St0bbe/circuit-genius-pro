import type { PlanDocument } from "@/lib/electrical";
import { analyzeProject } from "@/lib/engineering";

export type PhaseLoad = { phase: "A" | "B" | "C"; power: number; circuits: string[] };
export type PhaseBalance = { phases: PhaseLoad[]; maxDifferencePercent: number; warning: string | null };

export function analyzePhaseBalance(doc: PlanDocument): PhaseBalance {
  const phases: Record<"A" | "B" | "C", PhaseLoad> = {
    A: { phase: "A", power: 0, circuits: [] },
    B: { phase: "B", power: 0, circuits: [] },
    C: { phase: "C", power: 0, circuits: [] },
  };

  for (const circuit of analyzeProject(doc).circuits) {
    if (!circuit.enabled) continue;
    const phase = circuit.phase;
    if (phase === "A" || phase === "B" || phase === "C") {
      phases[phase].power += circuit.demandPower;
      phases[phase].circuits.push(circuit.id);
    } else if (phase === "AB" || phase === "BC" || phase === "CA") {
      const [p1, p2] = phase.split("") as ["A" | "B" | "C", "A" | "B" | "C"];
      phases[p1].power += circuit.demandPower / 2;
      phases[p2].power += circuit.demandPower / 2;
      phases[p1].circuits.push(circuit.id);
      phases[p2].circuits.push(circuit.id);
    }
  }

  const values = Object.values(phases).map((p) => p.power);
  const max = Math.max(...values, 0);
  const min = Math.min(...values, 0);
  const average = values.reduce((a, b) => a + b, 0) / 3;
  const maxDifferencePercent = average > 0 ? ((max - min) / average) * 100 : 0;
  const warning = maxDifferencePercent > 20 ? `Desequilíbrio estimado de ${maxDifferencePercent.toFixed(1)}% entre as fases. Revise a distribuição dos circuitos.` : null;

  return { phases: Object.values(phases), maxDifferencePercent, warning };
}
