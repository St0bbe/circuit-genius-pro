import type { PlanDocument } from "@/lib/electrical";
import { estimateWiring } from "@/lib/wiring";

export type TerminalItem = {
  category: "terminal" | "connector" | "marker";
  name: string;
  section?: number;
  quantity: number;
  note?: string;
};

export function calculateTerminals(doc: PlanDocument): TerminalItem[] {
  const wires = estimateWiring(doc);
  const bySection = new Map<number, number>();
  let markers = 0;

  for (const wire of wires) {
    const ends = 2;
    bySection.set(wire.section, (bySection.get(wire.section) ?? 0) + ends);
    markers += ends;
  }

  const items: TerminalItem[] = [...bySection.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([section, quantity]) => ({
      category: "terminal",
      name: `Terminal tubular ${String(section).replace(".", ",")} mm²`,
      section,
      quantity,
      note: "Estimativa por duas extremidades de cada condutor calculado.",
    }));

  if (wires.length) {
    items.push({ category: "connector", name: "Conector de emenda", quantity: Math.max(1, Math.ceil(wires.length / 3)), note: "Estimativa inicial; tipo deve ser escolhido conforme biblioteca do instalador." });
    items.push({ category: "marker", name: "Anilhas/identificadores", quantity: markers, note: "Uma identificação em cada extremidade estimada." });
  }

  return items;
}
