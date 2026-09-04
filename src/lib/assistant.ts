import { CATALOG_BY_KIND, uid, type ComponentKind, type PlanDocument } from "@/lib/electrical";
import { createCircuit, getCircuits, withCircuits } from "@/lib/circuits";

export type AssistantAction = {
  label: string;
  description: string;
  apply: (doc: PlanDocument) => PlanDocument;
};

function detectKind(text: string): ComponentKind | null {
  const t = text.toLowerCase();
  if (t.includes("tomada")) return "tug";
  if (t.includes("lumin") || t.includes("lâmp") || t.includes("lamp")) return "luminaria";
  if (t.includes("chuveiro")) return "chuveiro";
  if (t.includes("forno")) return "forno";
  if (t.includes("ar-condicionado") || t.includes("ar condicionado")) return "ar_condicionado";
  if (t.includes("interruptor")) return "interruptor_simples";
  return null;
}

function detectQuantity(text: string) {
  const direct = text.match(/\b(\d+)\b/);
  if (direct) return Math.min(20, Math.max(1, Number(direct[1])));
  if (/\bduas\b/i.test(text)) return 2;
  if (/\btrês\b|\btres\b/i.test(text)) return 3;
  if (/\bquatro\b/i.test(text)) return 4;
  return 1;
}

export function suggestAssistantActions(doc: PlanDocument, prompt: string): AssistantAction[] {
  const actions: AssistantAction[] = [];
  const text = prompt.trim();
  if (!text) return actions;

  if (/circuito exclusivo/i.test(text)) {
    const kind = detectKind(text);
    const target = kind ? doc.points.find((p) => p.kind === kind) : undefined;
    if (target) {
      actions.push({
        label: `Criar circuito exclusivo para ${target.label}`,
        description: "Cria um novo circuito e move apenas a carga encontrada para ele.",
        apply: (current) => {
          const circuit = createCircuit(current, { description: `Exclusivo ${target.label}`, type: "equipment", voltage: target.voltage === 220 ? 220 : 127 });
          return withCircuits({ ...current, points: current.points.map((p) => p.id === target.id ? { ...p, circuit: circuit.id } : p) }, [...getCircuits(current), circuit]);
        },
      });
    }
  }

  const kind = detectKind(text);
  if (kind && /(adicione|adicionar|crie|criar|coloque|inserir)/i.test(text)) {
    const quantity = detectQuantity(text);
    const def = CATALOG_BY_KIND[kind];
    actions.push({
      label: `Adicionar ${quantity} × ${def.label}`,
      description: "Insere os pontos próximos ao centro do primeiro ambiente para revisão manual.",
      apply: (current) => {
        const room = current.rooms[0];
        const baseX = room ? room.x + room.w / 2 : 2;
        const baseY = room ? room.y + room.h / 2 : 2;
        const next = [...current.points];
        for (let i = 0; i < quantity; i++) {
          next.push({ id: uid(), kind, x: baseX + i * 0.5, y: baseY, label: `${def.short}-AI-${i + 1}`, power: def.power, voltage: def.voltage, height: def.height, circuit: "", rotation: 0, mirrored: false });
        }
        return { ...current, points: next };
      },
    });
  }

  if (/circuitos?.*limite|próximos? do limite|proximos? do limite/i.test(text)) {
    actions.push({ label: "Revisar circuitos no limite", description: "Abra a aba Cargas/Validação para conferir corrente, cabo e avisos. Esta ação não altera o projeto.", apply: (current) => current });
  }

  return actions;
}
