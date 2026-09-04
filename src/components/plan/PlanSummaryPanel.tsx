import { fmtM, type PlanDocument, type PlanSummary } from "@/lib/electrical";

function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex items-baseline justify-between gap-3 border-b border-border/60 py-2 last:border-0"><span className="text-xs text-muted-foreground">{label}</span><span className="font-mono text-sm text-foreground">{value}</span></div>;
}

export function PlanSummaryPanel({ doc, summary }: { doc: PlanDocument; summary: PlanSummary }) {
  return <div className="p-4">
    <div className="mb-3">
      <p className="tech-label">Resumo da planta</p>
      <p className="mt-1 text-xs text-muted-foreground">Visão geral do desenho e da instalação elétrica.</p>
    </div>
    <div className="rounded-md border border-border bg-card/40 px-3">
      <Row label="Ambientes" value={`${doc.rooms.length} · ${summary.area.toFixed(2)} m²`} />
      <Row label="Paredes/aberturas" value={String(doc.architecture.length)} />
      <Row label="Pontos de luz" value={String(summary.lighting)} />
      <Row label="Tomadas" value={String(summary.outlets)} />
      <Row label="Equipamentos" value={String(summary.equipment)} />
      <Row label="Quadros" value={String(doc.panels.length)} />
      <Row label="Eletroduto total" value={fmtM(summary.conduitLength)} />
      <Row label="Potência instalada" value={`${summary.installedPower.toLocaleString("pt-BR")} VA`} />
    </div>
  </div>;
}
