import type { PlanDocument } from "@/lib/electrical";
import { getCircuits, withCircuits } from "@/lib/circuits";
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

export function autoBalancePhases(doc: PlanDocument): PlanDocument {
  const analysis = analyzeProject(doc);
  const definitions = getCircuits(doc);
  const candidates = analysis.circuits
    .filter((c) => c.enabled && c.voltage === 127 && ["auto", "A", "B", "C"].includes(c.phase))
    .sort((a, b) => b.demandPower - a.demandPower);

  const totals: Record<"A" | "B" | "C", number> = { A: 0, B: 0, C: 0 };
  for (const c of analysis.circuits.filter((c) => !candidates.some((x) => x.id === c.id))) {
    if (c.phase === "A" || c.phase === "B" || c.phase === "C") totals[c.phase] += c.demandPower;
    if (c.phase === "AB") { totals.A += c.demandPower / 2; totals.B += c.demandPower / 2; }
    if (c.phase === "BC") { totals.B += c.demandPower / 2; totals.C += c.demandPower / 2; }
    if (c.phase === "CA") { totals.C += c.demandPower / 2; totals.A += c.demandPower / 2; }
  }

  const assignment = new Map<string, "A" | "B" | "C">();
  for (const c of candidates) {
    const phase = (Object.entries(totals) as Array<["A" | "B" | "C", number]>).sort((a, b) => a[1] - b[1])[0][0];
    assignment.set(c.id, phase);
    totals[phase] += c.demandPower;
  }

  return withCircuits(doc, definitions.map((c) => assignment.has(c.id) ? { ...c, phase: assignment.get(c.id)! } : c));
}
