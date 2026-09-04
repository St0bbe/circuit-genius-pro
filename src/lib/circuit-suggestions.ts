import { CATALOG_BY_KIND, type PlanDocument, type PlanPoint } from "@/lib/electrical";
import { createCircuit, getCircuits, withCircuits } from "@/lib/circuits";

export type CircuitSuggestion = { id: string; description: string; voltage: 127 | 220; pointIds: string[]; reason: string };

export function suggestCircuits(doc: PlanDocument): CircuitSuggestion[] {
  const unassigned = doc.points.filter((p) => !p.circuit.trim());
  const groups = new Map<string, PlanPoint[]>();
  for (const point of unassigned) {
    const def = CATALOG_BY_KIND[point.kind];
    let key = "mixed";
    if (def?.layer === "iluminacao") key = "lighting";
    else if (["chuveiro","forno","cooktop","ar_condicionado","torneira_eletrica","maquina_secar","aquecedor","bomba","motor"].includes(point.kind)) key = `exclusive:${point.id}`;
    else if (def?.layer === "tomadas") key = point.voltage === 220 ? "outlets220" : "outlets127";
    else if (def?.layer === "equipamentos") key = `equipment:${point.voltage}`;
    const list = groups.get(key) ?? [];
    list.push(point);
    groups.set(key, list);
  }
  let index = getCircuits(doc).length + 1;
  return [...groups.entries()].map(([key, points]) => {
    const id = `C${String(index++).padStart(2, "0")}`;
    const exclusive = key.startsWith("exclusive:");
    const description = exclusive ? CATALOG_BY_KIND[points[0].kind]?.label ?? "Carga específica" : key === "lighting" ? "Iluminação" : key.startsWith("outlets") ? "Tomadas" : key.startsWith("equipment") ? "Equipamentos" : "Circuito misto";
    return { id, description, voltage: points.some((p) => p.voltage === 220) ? 220 : 127, pointIds: points.map((p) => p.id), reason: exclusive ? "Carga de maior potência sugerida como circuito exclusivo." : `Agrupamento automático inicial por tipo de uso (${description}).` };
  });
}

export function applyCircuitSuggestions(doc: PlanDocument, suggestions: CircuitSuggestion[]): PlanDocument {
  let next = doc;
  const circuits = [...getCircuits(next)];
  for (const suggestion of suggestions) {
    const circuit = createCircuit(next, { id: suggestion.id, name: suggestion.id, description: suggestion.description, voltage: suggestion.voltage });
    circuits.push(circuit);
    next = { ...next, points: next.points.map((p) => suggestion.pointIds.includes(p.id) ? { ...p, circuit: suggestion.id } : p) };
  }
  return withCircuits(next, circuits);
}
