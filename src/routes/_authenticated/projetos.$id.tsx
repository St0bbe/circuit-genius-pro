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
import { PlanReferenceOverlay } from "@/components/plan/PlanReferenceOverlay";
import { SmartActionsPanel } from "@/components/plan/SmartActionsPanel";
import { autoRouteConduits, autoRouteWiring } from "@/lib/auto-routing";
import { normalizeProjectDocument } from "@/lib/circuits";
import { EMPTY_DOCUMENT, LAYERS, summarize, uid, type ComponentKind, type LayerId, type PlanDocument } from "@/lib/electrical";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/projetos/$id")({
  head: () => ({
    meta: [
      { title: "Editor de planta — Voltplan" },
      { name: "description", content: "Desenhe ambientes, arquitetura e instalações elétricas do projeto." },
    ],
  }),
  component: EditorPage,
});

const TOOLS: { id: Tool; label: string; hint: string }[] = [
  { id: "select", label: "Selecionar", hint: "Clique para selecionar, arraste para mover" },
  { id: "room", label: "Ambiente", hint: "Arraste para criar um ambiente retangular" },
  { id: "room_free", label: "Ambiente livre", hint: "Clique nos cantos do ambiente e clique no primeiro ponto para fechar" },
  { id: "wall", label: "Parede", hint: "Arraste para desenhar uma parede" },
  { id: "door", label: "Porta", hint: "Arraste sobre a parede para inserir uma porta" },
  { id: "window", label: "Janela", hint: "Arraste sobre a parede para inserir uma janela" },
  { id: "point", label: "Ponto", hint: "Clique para inserir o componente escolhido" },
  { id: "panel", label: "Quadro", hint: "Clique para posicionar o quadro" },
  { id: "conduit", label: "Eletroduto", hint: "Clique em dois pontos/quadros; curvas são criadas e podem ser ajustadas" },
];

const ALL_VISIBLE = Object.fromEntries(LAYERS.map((l) => [l.id, true])) as Record<LayerId, boolean>;
type MobilePanel = "library" | "properties" | null;
type HistoryState = { past: PlanDocument[]; future: PlanDocument[] };

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
  const [mobilePanel, setMobilePanel] = useState<MobilePanel>(null);
  const [, setHistoryVersion] = useState(0);
  const loaded = useRef(false);
  const clipboard = useRef<{ type: NonNullable<Selection>["type"]; data: unknown } | null>(null);
  const history = useRef<HistoryState>({ past: [], future: [] });

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
      history.current = { past: [], future: [] };
      setHistoryVersion((v) => v + 1);
      loaded.current = true;
    }
  }, [project]);

  const update = useCallback((updater: (d: PlanDocument) => PlanDocument) => {
    setDoc((current) => {
      const next = updater(current);
      if (next === current) return current;
      history.current.past.push(current);
      if (history.current.past.length > 100) history.current.past.shift();
      history.current.future = [];
      setHistoryVersion((v) => v + 1);
      return next;
    });
    setDirty(true);
  }, []);

  const undo = useCallback(() => {
    setDoc((current) => {
      const previous = history.current.past.pop();
      if (!previous) return current;
      history.current.future.push(current);
      setHistoryVersion((v) => v + 1);
      return previous;
    });
    setSelection(null);
    setDirty(true);
  }, []);

  const redo = useCallback(() => {
    setDoc((current) => {
      const next = history.current.future.pop();
      if (!next) return current;
      history.current.past.push(current);
      setHistoryVersion((v) => v + 1);
      return next;
    });
    setSelection(null);
    setDirty(true);
  }, []);

  const save = useCallback(async (silent = false) => {
    setSaving(true);
    const { error } = await supabase.from("projects").update({ document: doc }).eq("id", id);
    setSaving(false);
    if (error) {
      toast.error("Falha ao salvar o projeto.");
      return;
    }
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
    const newId = uid();
    update((d) => {
      if (clip.type === "room") {
        const x = clip.data as PlanDocument["rooms"][number];
        return { ...d, rooms: [...d.rooms, { ...x, id: newId, x: x.x + 0.5, y: x.y + 0.5, points: x.points?.map((p) => ({ x: p.x + 0.5, y: p.y + 0.5 })), name: `${x.name} cópia` }] };
      }
      if (clip.type === "point") {
        const x = clip.data as PlanDocument["points"][number];
        return { ...d, points: [...d.points, { ...x, id: newId, x: x.x + 0.5, y: x.y + 0.5, label: `${x.label}-C` }] };
      }
      if (clip.type === "panel") {
        const x = clip.data as PlanDocument["panels"][number];
        return { ...d, panels: [...d.panels, { ...x, id: newId, x: x.x + 0.5, y: x.y + 0.5, name: `${x.name}-C` }] };
      }
      const x = clip.data as PlanDocument["architecture"][number];
      return { ...d, architecture: [...d.architecture, { ...x, id: newId, x1: x.x1 + 0.5, y1: x.y1 + 0.5, x2: x.x2 + 0.5, y2: x.y2 + 0.5 }] };
    });
    setSelection({ type: clip.type, id: newId });
    setTool("select");
  }, [update]);

  const runAutoConduits = useCallback(() => {
    const result = autoRouteConduits(doc);
    if (!result.created) {
      toast.warning("Não foi possível gerar eletrodutos. Confira quadro, circuitos e cargas associadas.");
      return;
    }
    update(() => result.doc);
    setVisible((v) => ({ ...v, eletrodutos: true }));
    toast.success(`${result.created} trecho(s) de eletroduto gerados. Você pode editar as curvas manualmente.`);
  }, [doc, update]);

  const runAutoWiring = useCallback(() => {
    const result = autoRouteWiring(doc);
    if (!result.created) {
      toast.warning("Nenhuma fiação foi gerada. Gere ou desenhe os eletrodutos e confira os circuitos primeiro.");
      return;
    }
    update(() => result.doc);
    setVisible((v) => ({ ...v, fiacao: true }));
    toast.success(`${result.created} circuito(s) com fiação automática. O trajeto acompanha os eletrodutos editáveis.`);
  }, [doc, update]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
      const modifier = e.ctrlKey || e.metaKey;
      if (modifier && e.key.toLowerCase() === "z" && !e.shiftKey) { e.preventDefault(); undo(); return; }
      if (modifier && (e.key.toLowerCase() === "y" || (e.key.toLowerCase() === "z" && e.shiftKey))) { e.preventDefault(); redo(); return; }
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
        update((d) => ({
          ...d,
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
      if (e.key.toLowerCase() === "f") setTool("room_free");
      if (e.key.toLowerCase() === "w") setTool("wall");
      if (e.key.toLowerCase() === "d") setTool("door");
      if (e.key.toLowerCase() === "j") setTool("window");
      if (e.key.toLowerCase() === "p") setTool("point");
      if (e.key.toLowerCase() === "e") setTool("conduit");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [copySelection, pasteSelection, redo, selection, undo, update]);

  const summary = useMemo(() => summarize(doc), [doc]);
  const activeTool = TOOLS.find((t) => t.id === tool);
  const canUndo = history.current.past.length > 0;
  const canRedo = history.current.future.length > 0;

  const closeMobilePanels = () => setMobilePanel(null);
  const pickComponent = (kind: ComponentKind) => {
    setActiveKind(kind);
    setTool("point");
    closeMobilePanels();
  };

  const propertiesContent = (
    <>
      <div className="min-h-[260px] sm:min-h-[320px]">
        <PropertiesPanel doc={doc} selection={selection} summary={summary} onChange={update} onSelect={setSelection} />
      </div>
      <CircuitsSummary doc={doc} />
      <EngineeringWorkspace doc={doc} onChange={update} />
      <SmartActionsPanel doc={doc} onChange={update} />
      <ProjectToolsPanel doc={doc} onChange={update} />
      <CompletionPanel doc={doc} onChange={update} />
      <PlatformPanel doc={doc} onChange={update} />
    </>
  );

  return (
    <div className="flex h-[100dvh] min-h-0 flex-col overflow-hidden bg-background">
      <header className="z-50 shrink-0 border-b border-border bg-sidebar">
        <div className="flex min-h-12 items-center justify-between gap-2 px-2 py-2 sm:px-3">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <Link to="/projetos" className="shrink-0 text-xs font-medium text-muted-foreground hover:text-foreground sm:text-sm">← <span className="hidden sm:inline">Projetos</span></Link>
            <div className="hidden h-5 w-px bg-border sm:block" />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium leading-tight">{isLoading ? "Carregando..." : project?.name}</p>
              <p className="hidden truncate text-[10px] uppercase tracking-wide text-muted-foreground sm:block">{project?.client_name || "sem cliente"}</p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            <Button size="sm" variant="ghost" disabled={!canUndo} onClick={undo} title="Desfazer (Ctrl+Z)">↶ <span className="hidden md:inline">Desfazer</span></Button>
            <Button size="sm" variant="ghost" disabled={!canRedo} onClick={redo} title="Refazer (Ctrl+Y / Ctrl+Shift+Z)">↷ <span className="hidden md:inline">Refazer</span></Button>
            <Button className="xl:hidden" size="sm" variant={mobilePanel === "library" ? "default" : "secondary"} onClick={() => setMobilePanel((p) => p === "library" ? null : "library")}>Biblioteca</Button>
            <Button className="xl:hidden" size="sm" variant={mobilePanel === "properties" ? "default" : "secondary"} onClick={() => setMobilePanel((p) => p === "properties" ? null : "properties")}>Painel</Button>
            <span className="hidden text-[10px] uppercase tracking-wide text-muted-foreground md:inline">{saving ? "salvando..." : dirty ? "pendente" : "salvo"}</span>
            <Button size="sm" variant="secondary" onClick={() => void save()}>{saving ? "..." : "Salvar"}</Button>
          </div>
        </div>

        <div className="scrollbar-none flex items-center gap-1 overflow-x-auto border-t border-border/60 px-2 py-1.5 sm:px-3 xl:justify-center">
          {TOOLS.map((t) => <Button key={t.id} className="shrink-0" size="sm" variant={tool === t.id ? "default" : "ghost"} onClick={() => { setTool(t.id); closeMobilePanels(); }}>{t.label}</Button>)}
          <span className="mx-1 h-5 w-px shrink-0 bg-border" />
          <Button className="shrink-0" size="sm" variant="secondary" onClick={runAutoConduits}>Auto eletrodutos</Button>
          <Button className="shrink-0" size="sm" variant="secondary" onClick={runAutoWiring}>Auto fiação</Button>
        </div>
      </header>

      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        <aside className="hidden w-64 shrink-0 xl:block">
          <LibraryPanel activeKind={activeKind} onPick={pickComponent} visible={visible} onToggleLayer={(l) => setVisible((v) => ({ ...v, [l]: !v[l] }))} />
        </aside>

        <main className="relative min-w-0 flex-1 overflow-hidden">
          <PlanReferenceOverlay doc={doc} />
          <div className="absolute inset-0 z-10 touch-none">
            <PlanCanvas doc={doc} onChange={update} tool={tool} activeKind={activeKind} visible={visible} selection={selection} onSelect={setSelection} onToolDone={() => setTool("select")} />
          </div>
          <div className={cn("pointer-events-none absolute bottom-3 left-1/2 z-20 max-w-[calc(100%-1rem)] -translate-x-1/2 truncate rounded-full border border-border bg-card/95 px-3 py-1.5 text-[10px] text-muted-foreground shadow-sm sm:bottom-4 sm:px-4 sm:text-xs")}>
            <span className="sm:hidden">{activeTool?.hint}</span>
            <span className="hidden sm:inline">{activeTool?.hint} · Ctrl+Z/Y desfazer/refazer · Ctrl+C/V duplicar · R girar · M espelhar</span>
          </div>
        </main>

        <aside className="hidden w-[min(32vw,430px)] min-w-[340px] shrink-0 flex-col overflow-y-auto border-l border-border bg-sidebar xl:flex">
          {propertiesContent}
        </aside>

        {mobilePanel && <button aria-label="Fechar painel" type="button" className="absolute inset-0 z-30 bg-background/60 backdrop-blur-[1px] xl:hidden" onClick={closeMobilePanels} />}

        <aside className={cn("absolute inset-y-0 left-0 z-40 w-[min(88vw,320px)] transform bg-sidebar shadow-2xl transition-transform duration-200 xl:hidden", mobilePanel === "library" ? "translate-x-0" : "-translate-x-full")}>
          <div className="flex h-full min-h-0 flex-col">
            <div className="flex shrink-0 items-center justify-between border-b border-border px-3 py-2"><span className="text-sm font-medium">Biblioteca e camadas</span><Button size="sm" variant="ghost" onClick={closeMobilePanels}>Fechar</Button></div>
            <div className="min-h-0 flex-1 overflow-y-auto"><LibraryPanel activeKind={activeKind} onPick={pickComponent} visible={visible} onToggleLayer={(l) => setVisible((v) => ({ ...v, [l]: !v[l] }))} /></div>
          </div>
        </aside>

        <aside className={cn("absolute inset-y-0 right-0 z-40 flex w-[min(94vw,460px)] transform flex-col bg-sidebar shadow-2xl transition-transform duration-200 xl:hidden", mobilePanel === "properties" ? "translate-x-0" : "translate-x-full")}>
          <div className="flex shrink-0 items-center justify-between border-b border-border px-3 py-2"><span className="text-sm font-medium">Projeto e propriedades</span><Button size="sm" variant="ghost" onClick={closeMobilePanels}>Fechar</Button></div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{propertiesContent}</div>
        </aside>
      </div>

      {!isLoading && !project && <div className="absolute inset-0 z-[100] grid place-items-center bg-background/90 p-6"><Button onClick={() => navigate({ to: "/projetos" })}>Projeto não encontrado</Button></div>}
    </div>
  );
}
