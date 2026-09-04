import type { PlanDocument } from "@/lib/electrical";
import { calculateMaterials } from "@/lib/materials";
import { generateMemorial } from "@/lib/documentation";

export function exportMaterialsCsv(doc: PlanDocument) {
  const rows = [["Categoria", "Material", "Unidade", "Quantidade", "Observação"]];
  for (const item of calculateMaterials(doc)) rows.push([item.category, item.name, item.unit, String(item.quantity), item.note ?? ""]);
  return rows.map((row) => row.map(csvCell).join(";")).join("\n");
}

export function exportMemorialTxt(doc: PlanDocument) {
  return generateMemorial(doc);
}

export function exportBasicDxf(doc: PlanDocument) {
  const lines: string[] = ["0","SECTION","2","ENTITIES"];
  for (const element of doc.architecture) {
    lines.push("0","LINE","8","ARQUITETURA","10",String(element.x1),"20",String(-element.y1),"30","0","11",String(element.x2),"21",String(-element.y2),"31","0");
  }
  for (const conduit of doc.conduits) {
    const a = doc.points.find((p) => p.id === conduit.from) ?? doc.panels.find((p) => p.id === conduit.from);
    const b = doc.points.find((p) => p.id === conduit.to) ?? doc.panels.find((p) => p.id === conduit.to);
    if (!a || !b) continue;
    lines.push("0","LINE","8","ELETRODUTOS","10",String(a.x),"20",String(-a.y),"30","0","11",String(b.x),"21",String(-b.y),"31","0");
  }
  for (const point of doc.points) {
    lines.push("0","POINT","8","PONTOS","10",String(point.x),"20",String(-point.y),"30","0");
    lines.push("0","TEXT","8","PONTOS","10",String(point.x),"20",String(-point.y),"30","0","40","0.15","1",point.label.replace(/[^\x20-\x7E]/g, ""));
  }
  lines.push("0","ENDSEC","0","EOF");
  return lines.join("\n");
}

export function downloadText(filename: string, content: string, mime = "text/plain;charset=utf-8") {
  if (typeof document === "undefined") return;
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function csvCell(value: string) {
  const escaped = value.replace(/"/g, '""');
  return `"${escaped}"`;
}
