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
