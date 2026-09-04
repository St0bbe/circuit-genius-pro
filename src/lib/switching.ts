import { CATALOG_BY_KIND, uid, type PlanDocument } from "@/lib/electrical";

export type ControlPlan = {
  controlPoints: number;
  switches: ("three-way" | "four-way")[];
  travelerConductors: number;
  returnConductors: number;
  description: string;
};

export function buildControlPlan(controlPoints: number): ControlPlan {
  const count = Math.max(1, Math.floor(controlPoints));
  if (count <= 1) return { controlPoints: 1, switches: [], travelerConductors: 0, returnConductors: 1, description: "Comando simples em um ponto." };
  if (count === 2) return { controlPoints: 2, switches: ["three-way", "three-way"], travelerConductors: 2, returnConductors: 1, description: "Dois interruptores paralelos (three-way) controlando a mesma carga." };
  return {
    controlPoints: count,
    switches: ["three-way", ...Array.from({ length: count - 2 }, () => "four-way" as const), "three-way"],
    travelerConductors: 2,
    returnConductors: 1,
    description: `${count} pontos de comando: paralelos nas extremidades e ${count - 2} intermediário(s) (four-way) entre eles.`,
  };
}

export function applyControlPlan(doc: PlanDocument, lightId: string, controlPoints: number): PlanDocument {
  const light = doc.points.find((p) => p.id === lightId);
  if (!light) return doc;
  const plan = buildControlPlan(controlPoints);
  const circuit = light.circuit;
  const removeKinds = new Set(["interruptor_simples", "interruptor_paralelo", "interruptor_intermediario"]);
  const retained = doc.points.filter((p) => !(p.circuit.toUpperCase() === circuit.toUpperCase() && removeKinds.has(p.kind)));
  const room = doc.rooms.find((r) => light.x >= r.x && light.x <= r.x + r.w && light.y >= r.y && light.y <= r.y + r.h);
  const baseX = room ? room.x + 0.4 : light.x - 1;
  const baseY = room ? room.y + room.h - 0.4 : light.y + 1;
  const kinds = plan.controlPoints === 1 ? ["interruptor_simples" as const] : plan.switches.map((s) => s === "three-way" ? "interruptor_paralelo" as const : "interruptor_intermediario" as const);
  const additions = kinds.map((kind, index) => {
    const def = CATALOG_BY_KIND[kind];
    return {
      id: uid(), kind, x: baseX + index * 0.65, y: baseY, label: `${def.short}-${light.label}-${index + 1}`,
      power: 0, voltage: light.voltage, height: def.height, circuit, notes: `Comando automático de ${light.label}. ${plan.description}`, rotation: 0, mirrored: false,
    };
  });
  return { ...doc, points: [...retained, ...additions] };
}
