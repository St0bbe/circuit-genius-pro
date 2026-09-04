import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  Box,
  Cable,
  Check,
  ChevronDown,
  DoorOpen,
  FileText,
  Hand,
  Layers3,
  Library,
  Minus,
  Monitor,
  MousePointer2,
  PanelRight,
  Pencil,
  Plus,
  Redo2,
  Route as RouteIcon,
  Save,
  Square,
  Undo2,
  Workflow,
  X,
  type LucideIcon,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { PlanCanvas, type Selection, type Tool } from "@/components/plan/PlanCanvas";
import { LibraryPanel } from "@/components/plan/LibraryPanel";
import { PropertiesPanel } from "@/components/plan/PropertiesPanel";
import { PlanSummaryPanel } from "@/components/plan/PlanSummaryPanel";
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

type ToolDefinition = { id: Tool; label: string; hint: string; icon: LucideIcon };

const TOOLS: ToolDefinition[] = [
  { id: "navigate", label: "Navegar", icon: Hand, hint: "Arraste em qualquer lugar para mover a visualização sem alterar o projeto" },
  { id: "select", label: "Selecionar", icon: MousePointer2, hint: "Clique para selecionar, arraste para mover" },
  { id: "room", label: "Ambiente", icon: Square, hint: "Arraste para criar um ambiente retangular" },
  { id: "room_free", label: "Ambiente livre", icon: Pencil, hint: "Clique nos cantos do ambiente e clique no primeiro ponto para fechar" },
  { id: "wall", label: "Parede", icon: Minus, hint: "Arraste para desenhar uma parede" },
  { id: "door", label: "Porta", icon: DoorOpen, hint: "Arraste sobre a parede para inserir uma porta" },
  { id: "passage", label: "Passagem", icon: RouteIcon, hint: "Arraste sobre a parede para criar um vão sem folha de porta" },
  { id: "window", label: "Janela", icon: Monitor, hint: "Arraste sobre a parede para inserir uma janela" },
  { id: "point", label: "Adicionar ponto", icon: Plus, hint: "Escolha primeiro o componente na biblioteca e depois clique na planta" },
  { id: "panel_supply", label: "QA", icon: Box, hint: "Clique para posicionar o Quadro de Alimentação" },
  { id: "panel_distribution", label: "QD", icon: Box, hint: "Clique para posicionar o Quadro de Distribuição" },
  { id: "conduit", label: "Eletroduto", icon: Cable, hint: "Clique em dois pontos/quadros; curvas são criadas e podem ser ajustadas" },
];

const ARCHITECTURE_TOOL_IDS: Tool[] = ["wall", "room", "room_free", "passage", "window", "door"];
const ARCHITECTURE_TOOLS = ARCHITECTURE_TOOL_IDS.map((id) => TOOLS.find((tool) => tool.id === id)!).filter(Boolean);
const PRIMARY_TOOLS = TOOLS.filter((tool) => tool.id === "navigate" || tool.id === "select");
const ELECTRICAL_TOOLS = TOOLS.filter((tool) => !ARCHITECTURE_TOOL_IDS.includes(tool.id) && tool.id !== "navigate" && tool.id !== "select");

const ALL_VISIBLE = Object.fromEntries(LAYERS.map((l) => [l.id, true])) as Record<LayerId, boolean>;
type MobilePanel = "library" | "properties" | "summary" | null;
type HistoryState = { past: PlanDocument[]; future: PlanDocument[] };

function EditorPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [doc, setDoc] = useState<PlanDocument>(EMPTY_DOCUMENT);
  const [tool, setTool] = useState<Tool>("navigate");
  const [activeKind, setActiveKind] = useState<ComponentKind>("ponto_luz");
  const [visible, setVisible] = useState<Record<LayerId, boolean>>(ALL_VISIBLE);
  const [selection, setSelection] = useState<Selection>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [mobilePanel, setMobilePanel] = useState<MobilePanel>(null);
  const [architectureMenuOpen, setArchitectureMenuOpen] = useState(false);
  const [, setHistoryVersion] = useState(0);
  const loaded = useRef(false);
  const clipboard = useRef<{ type: NonNullable<Selection>["type"]; data: unknown } | null>(null);
  const history = useRef<HistoryState>({ past: [], future: [] });
  const docRef = useRef<PlanDocument>(EMPTY_DOCUMENT);

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
      const loadedDoc = normalizeProjectDocument(project.document);
      docRef.current = loadedDoc;
      setDoc(loadedDoc);
      history.current = { past: [], future: [] };
      setHistoryVersion((v) => v + 1);
      loaded.current = true;
    }
  }, [project]);

  const update = useCallback((updater: (d: PlanDocument) => PlanDocument) => {
    const current = docRef.current;
    const next = updater(current);
    if (next === current) return;
    history.current.past.push(current);
    if (history.current.past.length > 100) history.current.past.shift();
    history.current.future = [];
    docRef.current = next;
    setDoc(next);
    setHistoryVersion((v) => v + 1);
    setDirty(true);
  }, []);

  const undo = useCallback(() => {
    const previous = history.current.past.pop();
    if (!previous) return;
    const current = docRef.current;
    history.current.future.push(current);
    docRef.current = previous;
    setDoc(previous);
    setHistoryVersion((v) => v + 1);
    setSelection(null);
    setDirty(true);
  }, []);

  const redo = useCallback(() => {
    const next = history.current.future.pop();
    if (!next) return;
    const current = docRef.current;
    history.current.past.push(current);
    docRef.current = next;
    setDoc(next);
    setHistoryVersion((v) => v + 1);
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

  const openPointLibrary = useCallback(() => {
    setTool("navigate");
    setSelection(null);
    setArchitectureMenuOpen(false);
    setMobilePanel("library");
  }, []);

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
      if (e.key === "Escape") { setTool("navigate"); setArchitectureMenuOpen(false); }
      if (e.key.toLowerCase() === "n") setTool("navigate");
      if (e.key.toLowerCase() === "v") setTool("select");
      if (e.key.toLowerCase() === "a") setTool("room");
      if (e.key.toLowerCase() === "f") setTool("room_free");
      if (e.key.toLowerCase() === "w") setTool("wall");
      if (e.key.toLowerCase() === "d") setTool("door");
      if (e.key.toLowerCase() === "g") setTool("passage");
      if (e.key.toLowerCase() === "j") setTool("window");
      if (e.key.toLowerCase() === "p") { e.preventDefault(); openPointLibrary(); }
      if (e.key.toLowerCase() === "e") setTool("conduit");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [copySelection, openPointLibrary, pasteSelection, redo, selection, undo, update]);

  const summary = useMemo(() => summarize(doc), [doc]);
  const activeTool = TOOLS.find((t) => t.id === tool);
  const architectureToolActive = ARCHITECTURE_TOOL_IDS.includes(tool);
  const canUndo = history.current.past.length > 0;
  const canRedo = history.current.future.length > 0;

  const closeMobilePanels = () => setMobilePanel(null);
  const pickComponent = (kind: ComponentKind) => {
    setActiveKind(kind);
    setTool("point");
    setArchitectureMenuOpen(false);
    closeMobilePanels();
  };

  const activateTool = (toolId: Tool) => {
    if (toolId === "point") {
      openPointLibrary();
      return;
    }
    setTool(toolId);
    setArchitectureMenuOpen(false);
    closeMobilePanels();
  };

  const propertiesContent = (
    <>
      <div className="min-h-[260px] sm:min-h-[320px]">
        <PropertiesPanel doc={doc} selection={selection} onChange={update} onSelect={setSelection} />
      </div>
      <CircuitsSummary doc={doc} />
      <EngineeringWorkspace doc={doc} onChange={update} />
      <SmartActionsPanel doc={doc} onChange={update} />
      <ProjectToolsPanel doc={doc} onChange={update} />
      <CompletionPanel doc={doc} onChange={update} />
      <PlatformPanel doc={doc} onChange={update} />
    </>
  );

  const summaryContent = <PlanSummaryPanel doc={doc} summary={summary} />;

  return (
    <div className="flex h-[100dvh] min-h-0 flex-col overflow-hidden bg-background">
      <header className="relative z-50 shrink-0 border-b border-border bg-sidebar">
        <div className="flex min-h-12 items-center justify-between gap-2 px-2 py-2 sm:px-3">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <Link to="/projetos" className="flex shrink-0 items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground sm:text-sm">
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Projetos</span>
            </Link>
            <div className="hidden h-5 w-px bg-border sm:block" />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium leading-tight">{isLoading ? "Carregando..." : project?.name}</p>
              <p className="hidden truncate text-[10px] uppercase tracking-wide text-muted-foreground sm:block">{project?.client_name || "sem cliente"}</p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            <Button size="sm" variant="ghost" disabled={!canUndo} onClick={undo} title="Desfazer (Ctrl+Z)"><Undo2 className="h-4 w-4" /><span className="hidden md:inline">Desfazer</span></Button>
            <Button size="sm" variant="ghost" disabled={!canRedo} onClick={redo} title="Refazer (Ctrl+Y / Ctrl+Shift+Z)"><Redo2 className="h-4 w-4" /><span className="hidden md:inline">Refazer</span></Button>
            <Button size="sm" variant={mobilePanel === "summary" ? "default" : "secondary"} onClick={() => setMobilePanel((p) => p === "summary" ? null : "summary")}><FileText className="h-4 w-4" />Resumo</Button>
            <Button className="xl:hidden" size="sm" variant={mobilePanel === "library" ? "default" : "secondary"} onClick={() => setMobilePanel((p) => p === "library" ? null : "library")}><Library className="h-4 w-4" />Biblioteca</Button>
            <Button className="xl:hidden" size="sm" variant={mobilePanel === "properties" ? "default" : "secondary"} onClick={() => setMobilePanel((p) => p === "properties" ? null : "properties")}><PanelRight className="h-4 w-4" />Painel</Button>
            <span className="hidden text-[10px] uppercase tracking-wide text-muted-foreground md:inline">{saving ? "salvando..." : dirty ? "pendente" : "salvo"}</span>
            <Button size="sm" variant="secondary" onClick={() => void save()}><Save className="h-4 w-4" />{saving ? "Salvando..." : "Salvar"}</Button>
          </div>
        </div>

        <div className="scrollbar-none flex items-center gap-1 overflow-x-auto border-t border-border/60 px-2 py-1.5 sm:px-3 xl:justify-center">
          {PRIMARY_TOOLS.map((t) => {
            const Icon = t.icon;
            return <Button key={t.id} className="shrink-0" size="sm" variant={tool === t.id ? "default" : "ghost"} onClick={() => activateTool(t.id)}><Icon className="h-4 w-4" />{t.label}</Button>;
          })}
          <Button className="shrink-0" size="sm" variant={architectureToolActive || architectureMenuOpen ? "default" : "ghost"} onClick={() => setArchitectureMenuOpen((open) => !open)} aria-expanded={architectureMenuOpen} aria-haspopup="menu">
            <Layers3 className="h-4 w-4" /> Elementos <ChevronDown className={cn("h-4 w-4 transition-transform", architectureMenuOpen && "rotate-180")} />
          </Button>
          {ELECTRICAL_TOOLS.map((t) => {
            const Icon = t.icon;
            return <Button key={t.id} className="shrink-0" size="sm" variant={tool === t.id ? "default" : "ghost"} onClick={() => activateTool(t.id)}><Icon className="h-4 w-4" />{t.label}</Button>;
          })}
          <span className="mx-1 h-5 w-px shrink-0 bg-border" />
          <Button className="shrink-0" size="sm" variant="secondary" onClick={runAutoConduits}><Workflow className="h-4 w-4" />Auto eletrodutos</Button>
          <Button className="shrink-0" size="sm" variant="secondary" onClick={runAutoWiring}><Cable className="h-4 w-4" />Auto fiação</Button>
        </div>

        {architectureMenuOpen && <>
          <button type="button" aria-label="Fechar menu de elementos" className="fixed inset-0 z-[55] cursor-default bg-transparent" onClick={() => setArchitectureMenuOpen(false)} />
          <div role="menu" className="absolute left-2 top-full z-[60] mt-1 w-[min(92vw,390px)] overflow-hidden rounded-lg border border-border bg-popover p-1.5 text-popover-foreground shadow-2xl sm:left-28">
            <div className="px-2.5 pb-2 pt-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Elementos da planta</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">Escolha o que deseja desenhar ou inserir.</p>
            </div>
            <div className="grid gap-1">
              {ARCHITECTURE_TOOLS.map((item) => {
                const Icon = item.icon;
                return <button key={item.id} type="button" role="menuitem" className={cn("flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left transition-colors hover:bg-accent hover:text-accent-foreground", tool === item.id && "bg-accent text-accent-foreground")} onClick={() => activateTool(item.id)}>
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md border border-border bg-background text-primary"><Icon className="h-4 w-4" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">{item.label}</span>
                    <span className="block truncate text-[11px] text-muted-foreground">{item.hint}</span>
                  </span>
                  {tool === item.id && <Check className="h-4 w-4 text-primary" />}
                </button>;
              })}
            </div>
          </div>
        </>}
      </header>

      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        <aside className="hidden w-64 shrink-0 xl:block">
          <LibraryPanel activeKind={activeKind} onPick={pickComponent} visible={visible} onToggleLayer={(l) => setVisible((v) => ({ ...v, [l]: !v[l] }))} />
        </aside>

        <main className="relative min-w-0 flex-1 overflow-hidden">
          <PlanReferenceOverlay doc={doc} />
          <div className="absolute inset-0 z-10 touch-none">
            <PlanCanvas doc={doc} onChange={update} tool={tool} activeKind={activeKind} visible={visible} selection={selection} onSelect={setSelection} onToolDone={() => setTool("navigate")} />
          </div>
          <div className={cn("pointer-events-none absolute bottom-3 left-1/2 z-20 max-w-[calc(100%-1rem)] -translate-x-1/2 truncate rounded-full border border-border bg-card/95 px-3 py-1.5 text-[10px] text-muted-foreground shadow-sm sm:bottom-4 sm:px-4 sm:text-xs")}>
            <span className="sm:hidden">{activeTool?.hint}</span>
            <span className="hidden sm:inline">{activeTool?.hint} · N navegar · V selecionar · P escolher ponto · G passagem · Ctrl+Z/Y desfazer/refazer · Ctrl+C/V duplicar · R girar · M espelhar</span>
          </div>
        </main>

        <aside className="hidden w-[min(32vw,430px)] min-w-[340px] shrink-0 flex-col overflow-y-auto border-l border-border bg-sidebar xl:flex">
          {propertiesContent}
        </aside>

        {mobilePanel && <button aria-label="Fechar painel" type="button" className="absolute inset-0 z-30 bg-background/60 backdrop-blur-[1px] xl:hidden" onClick={closeMobilePanels} />}

        <aside className={cn("absolute inset-y-0 left-0 z-40 w-[min(88vw,320px)] transform bg-sidebar shadow-2xl transition-transform duration-200 xl:hidden", mobilePanel === "library" ? "translate-x-0" : "-translate-x-full")}>
          <div className="flex h-full min-h-0 flex-col">
            <div className="flex shrink-0 items-center justify-between border-b border-border px-3 py-2"><span className="flex items-center gap-2 text-sm font-medium"><Library className="h-4 w-4" />Escolha o ponto para adicionar</span><Button size="sm" variant="ghost" onClick={closeMobilePanels}><X className="h-4 w-4" />Fechar</Button></div>
            <div className="min-h-0 flex-1 overflow-y-auto"><LibraryPanel activeKind={activeKind} onPick={pickComponent} visible={visible} onToggleLayer={(l) => setVisible((v) => ({ ...v, [l]: !v[l] }))} /></div>
          </div>
        </aside>

        <aside className={cn("absolute inset-y-0 right-0 z-40 flex w-[min(94vw,460px)] transform flex-col bg-sidebar shadow-2xl transition-transform duration-200 xl:hidden", mobilePanel === "properties" ? "translate-x-0" : "translate-x-full")}>
          <div className="flex shrink-0 items-center justify-between border-b border-border px-3 py-2"><span className="flex items-center gap-2 text-sm font-medium"><PanelRight className="h-4 w-4" />Projeto e propriedades</span><Button size="sm" variant="ghost" onClick={closeMobilePanels}><X className="h-4 w-4" />Fechar</Button></div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{propertiesContent}</div>
        </aside>

        <aside className={cn("absolute inset-y-0 right-0 z-50 flex w-[min(92vw,380px)] transform flex-col border-l border-border bg-sidebar shadow-2xl transition-transform duration-200", mobilePanel === "summary" ? "translate-x-0" : "translate-x-full")}>
          <div className="flex shrink-0 items-center justify-between border-b border-border px-3 py-2"><span className="flex items-center gap-2 text-sm font-medium"><FileText className="h-4 w-4" />Resumo da planta</span><Button size="sm" variant="ghost" onClick={closeMobilePanels}><X className="h-4 w-4" />Fechar</Button></div>
          <div className="min-h-0 flex-1 overflow-y-auto">{summaryContent}</div>
        </aside>
      </div>

      {!isLoading && !project && <div className="absolute inset-0 z-[100] grid place-items-center bg-background/90 p-6"><Button onClick={() => navigate({ to: "/projetos" })}><ArrowLeft className="h-4 w-4" />Projeto não encontrado</Button></div>}
    </div>
  );
}