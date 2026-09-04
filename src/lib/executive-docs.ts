import type { PlanDocument, PlanPoint } from "@/lib/electrical";
import { analyzeProject } from "@/lib/engineering";
import { preliminarySizing } from "@/lib/engineering-rules";
import { planMultiway } from "@/lib/multiway";
import { generateLegend, generateMemorial } from "@/lib/documentation";

export type SheetKind = "electrical" | "lighting" | "outlets" | "conduits" | "wiring" | "circuits" | "loads" | "single-line" | "multi-line" | "materials" | "memorial" | "legend";
export type ProjectSheet = { code: string; title: string; kind: SheetKind; description: string };

export function generateSheetIndex(): ProjectSheet[] {
  return [
    { code: "EL-01", title: "Planta elétrica", kind: "electrical", description: "Planta consolidada de pontos e arquitetura." },
    { code: "EL-02", title: "Planta de iluminação", kind: "lighting", description: "Pontos de iluminação e comandos." },
    { code: "EL-03", title: "Planta de tomadas", kind: "outlets", description: "TUG, TUE e equipamentos." },
    { code: "EL-04", title: "Planta de eletrodutos", kind: "conduits", description: "Traçado e diâmetros dos eletrodutos." },
    { code: "EL-05", title: "Planta de fiação", kind: "wiring", description: "Circuitos e condutores por trecho." },
    { code: "EL-06", title: "Quadro de cargas", kind: "loads", description: "Potências, correntes e dimensionamento." },
    { code: "EL-07", title: "Diagrama unifilar", kind: "single-line", description: "Rede, quadro, proteção e circuitos." },
    { code: "EL-08", title: "Diagrama multifilar", kind: "multi-line", description: "Comandos, three-way/four-way e conexões." },
    { code: "EL-09", title: "Lista de materiais", kind: "materials", description: "Quantitativo consolidado." },
    { code: "EL-10", title: "Legenda e notas", kind: "legend", description: "Simbologia utilizada e notas técnicas." },
    { code: "EL-11", title: "Memorial descritivo", kind: "memorial", description: "Resumo técnico do projeto." },
  ];
}

export type MultiLineBranch = { circuitId: string; loadLabel: string; path: string[]; note: string };

export function generateMultilineData(doc: PlanDocument): MultiLineBranch[] {
  const branches: MultiLineBranch[] = [];
  const lights = doc.points.filter((p) => ["ponto_luz", "luminaria", "spot", "arandela", "perfil_led"].includes(p.kind));
  for (const light of lights) {
    const switches = doc.points.filter((p) => p.circuit && p.circuit.toUpperCase() === light.circuit.toUpperCase() && ["interruptor_simples", "interruptor_paralelo", "interruptor_intermediario"].includes(p.kind));
    if (!switches.length) continue;
    const plan = planMultiway(Math.max(1, switches.length));
    branches.push({
      circuitId: light.circuit || "SEM-CIRCUITO",
      loadLabel: light.label,
      path: plan.components,
      note: plan.note,
    });
  }
  return branches;
}

export function generateSingleLineText(doc: PlanDocument) {
  const overview = analyzeProject(doc);
  const byPanel = new Map<string, typeof overview.circuits>();
  for (const circuit of overview.circuits) {
    const panelName = doc.panels.find((p) => p.id === circuit.panelId)?.name ?? "QD não definido";
    byPanel.set(panelName, [...(byPanel.get(panelName) ?? []), circuit]);
  }
  const lines = ["REDE", " │"];
  for (const [panel, circuits] of byPanel) {
    lines.push(` ├─ ${panel}`, " │   ├─ Disjuntor geral", " │   ├─ DPS", " │   ├─ DR");
    for (const circuit of circuits) {
      const sizing = preliminarySizing(circuit);
      lines.push(` │   └─ ${circuit.id} ${circuit.description} · ${circuit.voltage ?? "?"} V · ${sizing.conductorSection ?? "?"} mm² · ${sizing.breakerRating ?? "?"} A`);
    }
  }
  return lines.join("\n");
}

export function generateExecutiveHtml(doc: PlanDocument, title = "Projeto elétrico") {
  const overview = analyzeProject(doc);
  const sheets = generateSheetIndex();
  const legend = generateLegend(doc);
  const memorial = generateMemorial(doc);
  const rows = overview.circuits.map((c) => {
    const s = preliminarySizing(c);
    return `<tr><td>${c.id}</td><td>${escapeHtml(c.description)}</td><td>${c.installedPower.toFixed(0)} VA</td><td>${c.voltage ?? "—"} V</td><td>${c.designCurrent?.toFixed(2) ?? "—"} A</td><td>${s.conductorSection ?? "—"} mm²</td><td>${s.breakerRating ?? "—"} A</td></tr>`;
  }).join("");
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>body{font-family:Arial,sans-serif;margin:32px;color:#111}h1,h2{margin:0 0 12px}section{page-break-after:always;margin-bottom:32px}table{border-collapse:collapse;width:100%;font-size:12px}th,td{border:1px solid #999;padding:6px;text-align:left}pre{white-space:pre-wrap;font-size:11px}.sheet{border:1px solid #333;padding:16px}</style></head><body><h1>${escapeHtml(title)}</h1><p>Documento executivo gerado pelo Voltplan. Conferência final e responsabilidade técnica permanecem com profissional habilitado.</p><section><h2>Índice de pranchas</h2>${sheets.map((s) => `<div>${s.code} — ${s.title}</div>`).join("")}</section><section><h2>Quadro de cargas</h2><table><thead><tr><th>Circuito</th><th>Descrição</th><th>Potência</th><th>Tensão</th><th>Corrente</th><th>Cabo</th><th>Disjuntor</th></tr></thead><tbody>${rows}</tbody></table></section><section><h2>Diagrama unifilar</h2><pre>${escapeHtml(generateSingleLineText(doc))}</pre></section><section><h2>Legenda</h2>${legend.map((l) => `<div><b>${escapeHtml(l.symbol)}</b> — ${escapeHtml(l.label)}</div>`).join("")}</section><section><h2>Memorial descritivo</h2><pre>${escapeHtml(memorial)}</pre></section></body></html>`;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[ch]!));
}
