import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { PlanCanvas, type Selection, type Tool } from "@/components/plan/PlanCanvas";
import { LibraryPanel } from "@/components/plan/LibraryPanel";
import { PropertiesPanel } from "@/components/plan/PropertiesPanel";
import { CircuitsSummary } from "@/components/plan/CircuitsSummary";
import { EngineeringWorkspace } from "@/components/plan/EngineeringWorkspace";
import { ProjectToolsPanel } from "@/components/plan/ProjectToolsPanel";
import { CompletionPanel } from "@/components/plan/CompletionPanel";
import { PlatformPanel } from "@/components/plan/PlatformPanel";
import { normalizeProjectDocument } from "@/lib/circuits";
import { EMPTY_DOCUMENT, LAYERS, summarize, uid, type ComponentKind, type LayerId, type PlanDocument } from "@/lib/electrical";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/projetos/$id")({
  head: () => ({ meta: [{ title: "Editor de planta — Voltplan" }, { name: "description", content: "Desenhe ambientes, arquitetura e instalações elétricas do projeto." }] }),
  component: EditorPage,
});

const TOOLS: { id: Tool; label: string; hint: string }[] = [
  { id: "select", label: "Selecionar", hint: "Clique para selecionar, arraste para mover" },
  { id: "room", label: "Ambiente", hint: "Arraste para criar um ambiente retangular" },
  { id: "wall", label: "Parede", hint: "Arraste para desenhar uma parede" },
  { id: "door", label: "Porta", hint: "Arraste para inserir uma porta" },
  { id: "window", label: "Janela", hint: "Arraste para inserir uma janela" },
  { id: "point", label: "Ponto", hint: "Clique para inserir o componente escolhido" },
  { id: "panel", label: "Quadro", hint: "Clique para posicionar o quadro" },
  { id: "conduit", label: "Eletroduto", hint: "Clique em dois pontos/quadros para ligar" },
];

const ALL_VISIBLE = Object.fromEntries(LAYERS.map((l) => [l.id, true])) as Record<LayerId, boolean>;

function EditorPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [doc, setDoc] = useState<PlanDocument>(EMPTY_DOCUMENT);
  const [tool, setTool] = useState<Tool>("room");
  const [activeKind, setActiveKind] = useState<ComponentKind>("ponto_luz");
  const [visible, setVisible] = useState<Record<LayerId, boolean>>(ALL_VISIBLE);
  const [selection, setSelection] = useState<Selection>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const loaded = useRef(false);
  const clipboard = useRef<{ type: NonNullable<Selection>["type"]; data: unknown } | null>(null);

  const { data: project, isLoading } = useQuery({
    queryKey: ["project", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("projects").select("*").eq("id", id).single();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (project && !loaded.current) {
      setDoc(normalizeProjectDocument(project.document));
      loaded.current = true;
    }
  }, [project]);

  const update = useCallback((updater: (d: PlanDocument) => PlanDocument) => {
    setDoc((d) => updater(d));
    setDirty(true);
  }, []);

  const save = useCallback(async (silent = false) => {
    setSaving(true);
    const { error } = await supabase.from("projects").update({ document: doc }).eq("id", id);
    setSaving(false);
    if (error) { toast.error("Falha ao salvar o projeto."); return; }
    setDirty(false);
    if (!silent) toast.success("Projeto salvo.");
  }, [doc, id]);

  useEffect(() => {
    if (!dirty || !loaded.current) return;
    const t = setTimeout(() => void save(true), 1500);
    return () => clearTimeout(t);
  }, [dirty, save]);

  const copySelection = useCallback(() => {
    if (!selection) return;
    if (selection.type === "room") clipboard.current = { type: "room", data: doc.rooms.find((x) => x.id === selection.id) };
    if (selection.type === "point") clipboard.current = { type: "point", data: doc.points.find((x) => x.id === selection.id) };
    if (selection.type === "panel") clipboard.current = { type: "panel", data: doc.panels.find((x) => x.id === selection.id) };
    if (selection.type === "architecture") clipboard.current = { type: "architecture", data: doc.architecture.find((x) => x.id === selection.id) };
  }, [doc, selection]);

  const pasteSelection = useCallback(() => {
    const clip = clipboard.current;
    if (!clip?.data || clip.type === "conduit") return;
    const id = uid();
    update((d) => {
      if (clip.type === "room") { const x = clip.data as PlanDocument["rooms"][number]; return { ...d, rooms: [...d.rooms, { ...x, id, x: x.x + 0.5, y: x.y + 0.5, name: `${x.name} cópia` }] }; }
      if (clip.type === "point") { const x = clip.data as PlanDocument["points"][number]; return { ...d, points: [...d.points, { ...x, id, x: x.x + 0.5, y: x.y + 0.5, label: `${x.label}-C` }] }; }
      if (clip.type === "panel") { const x = clip.data as PlanDocument["panels"][number]; return { ...d, panels: [...d.panels, { ...x, id, x: x.x + 0.5, y: x.y + 0.5, name: `${x.name}-C` }] }; }
      const x = clip.data as PlanDocument["architecture"][number];
      return { ...d, architecture: [...d.architecture, { ...x, id, x1: x.x1 + 0.5, y1: x.y1 + 0.5, x2: x.x2 + 0.5, y2: x.y2 + 0.5 }] };
    });
    setSelection({ type: clip.type, id });
    setTool("select");
  }, [update]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA"].includes(target.tagName)) return;
      const modifier = e.ctrlKey || e.metaKey;
      if (modifier && e.key.toLowerCase() === "c") { e.preventDefault(); copySelection(); return; }
      if (modifier && e.key.toLowerCase() === "v") { e.preventDefault(); pasteSelection(); return; }
      if ((e.key === "Delete" || e.key === "Backspace") && selection) {
        e.preventDefault();
        update((d) => ({
          ...d,
          rooms: d.rooms.filter((r) => selection.type !== "room" || r.id !== selection.id),
          architecture: d.architecture.filter((a) => selection.type !== "architecture" || a.id !== selection.id),
          points: d.points.filter((p) => selection.type !== "point" || p.id !== selection.id),
          panels: d.panels.filter((p) => selection.type !== "panel" || p.id !== selection.id),
          conduits: d.conduits.filter((c) => (selection.type !== "conduit" || c.id !== selection.id) && c.from !== selection.id && c.to !== selection.id),
        }));
        setSelection(null);
        return;
      }
      if (e.key.toLowerCase() === "r" && selection) {
        update((d) => ({ ...d,
          points: d.points.map((p) => selection.type === "point" && p.id === selection.id ? { ...p, rotation: ((p.rotation ?? 0) + 90) % 360 } : p),
          panels: d.panels.map((p) => selection.type === "panel" && p.id === selection.id ? { ...p, rotation: ((p.rotation ?? 0) + 90) % 360 } : p),
        }));
        return;
      }
      if (e.key.toLowerCase() === "m" && selection?.type === "point") {
        update((d) => ({ ...d, points: d.points.map((p) => p.id === selection.id ? { ...p, mirrored: !p.mirrored } : p) }));
        return;
      }
      if (e.key === "Escape") setTool("select");
      if (e.key.toLowerCase() === "v") setTool("select");
      if (e.key.toLowerCase() === "a") setTool("room");
      if (e.key.toLowerCase() === "w") setTool("wall");
      if (e.key.toLowerCase() === "d") setTool("door");
      if (e.key.toLowerCase() === "j") setTool("window");
      if (e.key.toLowerCase() === "p") setTool("point");
      if (e.key.toLowerCase() === "e") setTool("conduit");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [copySelection, pasteSelection, selection, update]);

  const summary = useMemo(() => summarize(doc), [doc]);
  const activeTool = TOOLS.find((t) => t.id === tool);

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border bg-sidebar px-3 py-2">
        <div className="flex items-center gap-3">
          <Link to="/projetos" className="tech-label hover:text-foreground">← Projetos</Link>
          <div className="h-5 w-px bg-border" />
          <div><p className="text-sm font-medium leading-tight">{isLoading ? "Carregando..." : project?.name}</p><p className="tech-label">{project?.client_name || "sem cliente"}</p></div>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-1">
          {TOOLS.map((t) => <Button key={t.id} size="sm" variant={tool === t.id ? "default" : "ghost"} onClick={() => setTool(t.id)}>{t.label}</Button>)}
        </div>
        <div className="flex items-center gap-3"><span className="tech-label">{saving ? "salvando..." : dirty ? "alterações pendentes" : "salvo"}</span><Button size="sm" variant="secondary" onClick={() => void save()}>Salvar</Button></div>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="w-64 shrink-0"><LibraryPanel activeKind={activeKind} onPick={(k) => { setActiveKind(k); setTool("point"); }} visible={visible} onToggleLayer={(l) => setVisible((v) => ({ ...v, [l]: !v[l] }))} /></aside>
        <main className="relative min-w-0 flex-1">
          <PlanCanvas doc={doc} onChange={update} tool={tool} activeKind={activeKind} visible={visible} selection={selection} onSelect={setSelection} onToolDone={() => setTool("select")} />
          <div className={cn("pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full border border-border bg-card/95 px-4 py-1.5 text-xs text-muted-foreground")}>{activeTool?.hint} · Ctrl+C/V duplicar · R girar · M espelhar</div>
        </main>
        <aside className="flex w-[430px] shrink-0 flex-col overflow-y-auto border-l border-border bg-sidebar">
          <div className="min-h-[320px]"><PropertiesPanel doc={doc} selection={selection} summary={summary} onChange={update} onSelect={setSelection} /></div>
          <CircuitsSummary doc={doc} />
          <EngineeringWorkspace doc={doc} onChange={update} />
          <ProjectToolsPanel doc={doc} onChange={update} />
          <CompletionPanel doc={doc} onChange={update} />
          <PlatformPanel doc={doc} onChange={update} />
        </aside>
      </div>
      {!isLoading && !project && <div className="p-6"><Button onClick={() => navigate({ to: "/projetos" })}>Projeto não encontrado</Button></div>}
    </div>
  );
}
