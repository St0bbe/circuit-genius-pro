import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { PlanDocument } from "@/lib/electrical";
import { calculateTerminals } from "@/lib/terminals";
import { fileToDataUrl, getImportBase, importDxfLines, setImportBase } from "@/lib/plan-import";
import { generateExecutiveHtml, generateMultilineData, generateSheetIndex, generateSingleLineText } from "@/lib/executive-docs";
import { suggestAssistantActions } from "@/lib/assistant";

type Props = {
  doc: PlanDocument;
  onChange: (updater: (doc: PlanDocument) => PlanDocument) => void;
};

type Tab = "importar" | "terminais" | "diagramas" | "pranchas" | "assistente";

function downloadText(name: string, text: string, type = "text/plain;charset=utf-8") {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export function CompletionPanel({ doc, onChange }: Props) {
  const [tab, setTab] = useState<Tab>("importar");
  const [assistantPrompt, setAssistantPrompt] = useState("");
  const base = getImportBase(doc);
  const terminals = useMemo(() => calculateTerminals(doc), [doc]);
  const sheets = useMemo(() => generateSheetIndex(), []);
  const multiline = useMemo(() => generateMultilineData(doc), [doc]);
  const singleLine = useMemo(() => generateSingleLineText(doc), [doc]);
  const assistantActions = useMemo(() => suggestAssistantActions(doc, assistantPrompt), [doc, assistantPrompt]);

  const importBase = async (file: File) => {
    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    const isImage = file.type.startsWith("image/");
    if (!isPdf && !isImage) return;
    const dataUrl = await fileToDataUrl(file);
    onChange((current) => setImportBase(current, { kind: isPdf ? "pdf" : "image", name: file.name, dataUrl, opacity: 0.45, scale: 1 }));
  };

  const importDxf = async (file: File) => {
    const text = await file.text();
    onChange((current) => importDxfLines(current, text).doc);
  };

  return (
    <div className="border-t border-border bg-sidebar">
      <div className="flex flex-wrap gap-1 border-b border-border p-2">
        {(["importar", "terminais", "diagramas", "pranchas", "assistente"] as Tab[]).map((id) => (
          <Button key={id} type="button" size="sm" variant={tab === id ? "default" : "ghost"} onClick={() => setTab(id)}>{id === "importar" ? "Importar" : id === "terminais" ? "Terminais" : id === "diagramas" ? "Diagramas" : id === "pranchas" ? "Pranchas" : "Assistente"}</Button>
        ))}
      </div>

      {tab === "importar" && (
        <div className="space-y-3 p-3">
          <div><p className="tech-label">Importação de planta</p><p className="text-[11px] text-muted-foreground">Imagem/PDF como referência e DXF LINE como paredes editáveis.</p></div>
          <label className="block rounded border border-dashed border-border p-3 text-xs">
            <span>Imagem ou PDF de referência</span>
            <Input className="mt-2" type="file" accept="image/*,.pdf,application/pdf" onChange={(e) => { const file = e.target.files?.[0]; if (file) void importBase(file); }} />
          </label>
          <label className="block rounded border border-dashed border-border p-3 text-xs">
            <span>DXF ASCII</span>
            <Input className="mt-2" type="file" accept=".dxf,text/plain" onChange={(e) => { const file = e.target.files?.[0]; if (file) void importDxf(file); }} />
          </label>
          {base && <div className="space-y-2 rounded border border-border bg-card/45 p-2 text-xs"><div className="flex items-center justify-between"><span>{base.name}</span><Button size="sm" variant="destructive" onClick={() => onChange((d) => setImportBase(d, null))}>Remover</Button></div><div className="grid grid-cols-2 gap-2"><label>Opacidade<Input type="number" min="0.05" max="1" step="0.05" value={base.opacity} onChange={(e) => onChange((d) => setImportBase(d, { ...base, opacity: Math.min(1, Math.max(0.05, Number(e.target.value) || 0.45)) }))} /></label><label>Escala<Input type="number" min="0.01" step="0.01" value={base.scale} onChange={(e) => onChange((d) => setImportBase(d, { ...base, scale: Math.max(0.01, Number(e.target.value) || 1) }))} /></label></div>{base.kind === "image" ? <img src={base.dataUrl} alt={base.name} className="max-h-48 w-full object-contain" style={{ opacity: base.opacity }} /> : <iframe title={base.name} src={base.dataUrl} className="h-48 w-full rounded border border-border" />}</div>}
          <p className="text-[10px] text-muted-foreground">DXF/DWG binário e reconhecimento automático de ambientes exigem parser/serviço dedicado; o importador atual cobre DXF ASCII com entidades LINE.</p>
        </div>
      )}

      {tab === "terminais" && (
        <div className="p-3"><div className="mb-2"><p className="tech-label">Terminais, conectores e anilhas</p><p className="text-[11px] text-muted-foreground">Estimativa por extremidades dos condutores calculados.</p></div>{terminals.length ? <div className="space-y-1">{terminals.map((item) => <div key={`${item.category}-${item.name}`} className="rounded border border-border/60 bg-card/45 px-2 py-1.5 text-xs"><div className="flex justify-between gap-2"><span>{item.name}</span><span className="font-mono">{item.quantity} un</span></div>{item.note && <div className="mt-1 text-[10px] text-muted-foreground">{item.note}</div>}</div>)}</div> : <p className="text-xs text-muted-foreground">Gere fiação/circuitos para obter a estimativa.</p>}</div>
      )}

      {tab === "diagramas" && (
        <div className="space-y-3 p-3"><section><p className="mb-1 tech-label">Unifilar</p><pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded border border-border bg-card/45 p-2 text-[10px]">{singleLine}</pre></section><section><p className="mb-1 tech-label">Multifilar</p>{multiline.length ? <div className="space-y-2">{multiline.map((branch) => <div key={`${branch.circuitId}-${branch.loadLabel}`} className="rounded border border-border bg-card/45 p-2 text-xs"><div className="font-mono text-primary">{branch.circuitId} · {branch.loadLabel}</div><div className="mt-1 text-[10px]">{branch.path.join(" → ")}</div><div className="mt-1 text-[10px] text-muted-foreground">{branch.note}</div></div>)}</div> : <p className="text-xs text-muted-foreground">Associe interruptores e luminárias ao mesmo circuito para gerar o multifilar.</p>}</section></div>
      )}

      {tab === "pranchas" && (
        <div className="space-y-2 p-3"><div className="flex items-center justify-between"><div><p className="tech-label">Projeto executivo</p><p className="text-[11px] text-muted-foreground">Índice de pranchas e documento pronto para imprimir/salvar como PDF.</p></div><Button size="sm" onClick={() => downloadText("voltplan-projeto-executivo.html", generateExecutiveHtml(doc), "text/html;charset=utf-8")}>Gerar HTML/PDF</Button></div>{sheets.map((sheet) => <div key={sheet.code} className="rounded border border-border/60 bg-card/45 px-2 py-1.5 text-xs"><span className="font-mono text-primary">{sheet.code}</span> · {sheet.title}<div className="text-[10px] text-muted-foreground">{sheet.description}</div></div>)}<p className="text-[10px] text-muted-foreground">Abra o HTML gerado no navegador e use Imprimir → Salvar como PDF para gerar o pacote executivo.</p></div>
      )}

      {tab === "assistente" && (
        <div className="space-y-3 p-3"><div><p className="tech-label">Assistente do projeto</p><p className="text-[11px] text-muted-foreground">Interpretação local de comandos; sempre revise as alterações antes de considerar o projeto final.</p></div><Textarea value={assistantPrompt} onChange={(e) => setAssistantPrompt(e.target.value)} placeholder='Ex.: "Adicione duas tomadas" ou "Crie um circuito exclusivo para o forno"' />{assistantActions.length ? <div className="space-y-2">{assistantActions.map((action) => <div key={action.label} className="rounded border border-border bg-card/45 p-2 text-xs"><div className="font-medium">{action.label}</div><div className="mt-1 text-[10px] text-muted-foreground">{action.description}</div><Button className="mt-2" size="sm" onClick={() => onChange(action.apply)}>Aplicar sugestão</Button></div>)}</div> : <p className="text-xs text-muted-foreground">Digite um comando suportado para receber uma ação revisável.</p>}</div>
      )}
    </div>
  );
}
