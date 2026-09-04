import type { PlanDocument } from "@/lib/electrical";
import { analyzeProject } from "@/lib/engineering";
import { preliminarySizing } from "@/lib/engineering-rules";

export type ValidationSeverity = "error" | "warning" | "ok";
export type ValidationItem = { code: string; severity: ValidationSeverity; title: string; detail: string; circuitId?: string };

export function validateProject(doc: PlanDocument): ValidationItem[] {
  const overview = analyzeProject(doc);
  const items: ValidationItem[] = [];

  if (doc.points.length === 0) items.push({ code: "NO_POINTS", severity: "warning", title: "Sem pontos elétricos", detail: "O projeto ainda não possui pontos elétricos." });
  if (doc.panels.length === 0) items.push({ code: "NO_PANEL", severity: "error", title: "Sem quadro", detail: "Adicione ao menos um quadro de distribuição." });
  if (overview.unassigned.length > 0) items.push({ code: "UNASSIGNED", severity: "error", title: "Pontos sem circuito", detail: `${overview.unassigned.length} ponto(s) ainda não possuem circuito.` });

  for (const circuit of overview.circuits) {
    if (!circuit.enabled) continue;
    if (circuit.loads.length === 0) items.push({ code: "EMPTY_CIRCUIT", severity: "warning", title: `${circuit.id} sem cargas`, detail: "O circuito não possui pontos associados.", circuitId: circuit.id });
    if (!circuit.panelId) items.push({ code: "NO_PANEL_LINK", severity: "error", title: `${circuit.id} sem quadro`, detail: "Associe o circuito a um quadro de distribuição.", circuitId: circuit.id });
    if (circuit.mixedVoltage) items.push({ code: "VOLTAGE_MISMATCH", severity: "error", title: `${circuit.id} com tensão incompatível`, detail: "Há cargas cuja tensão não coincide com a tensão configurada do circuito.", circuitId: circuit.id });
    const sizing = preliminarySizing(circuit);
    if (sizing.status === "review") items.push({ code: "SIZING_REVIEW", severity: "warning", title: `${circuit.id} requer revisão de dimensionamento`, detail: sizing.notes.join(" "), circuitId: circuit.id });
  }

  if (doc.conduits.some((c) => c.diameter <= 0)) items.push({ code: "CONDUIT_DIAMETER", severity: "error", title: "Eletroduto sem diâmetro", detail: "Existe eletroduto com diâmetro inválido." });

  if (items.length === 0) items.push({ code: "BASIC_OK", severity: "ok", title: "Validação básica OK", detail: "Nenhum problema básico foi encontrado. A validação técnica final depende das regras normativas configuradas e do responsável técnico." });
  return items;
}
