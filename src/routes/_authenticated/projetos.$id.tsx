import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { PlanCanvas, type Selection, type Tool } from "@/components/plan/PlanCanvas";
import { LibraryPanel } from "@/components/plan/LibraryPanel";
import { PropertiesPanel } from "@/components/plan/PropertiesPanel";
import {
  EMPTY_DOCUMENT,
  LAYERS,
  normalizeDocument,
  summarize,
  type ComponentKind,
  type LayerId,
  type PlanDocument,
} from "@/lib/electrical";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/projetos/$id")({
  head: () => ({
    meta: [
      { title: "Editor de planta — Voltplan" },
      {
        name: "description",
        content: "Desenhe ambientes, pontos elétricos, quadros e eletrodutos do projeto.",
      },
      { property: "og:title", content: "Editor de planta — Voltplan" },
      {
        property: "og:description",
        content: "Desenhe ambientes, pontos elétricos, quadros e eletrodutos do projeto.",
      },
    ],
  }),
  component: EditorPage,
});

const TOOLS: { id: Tool; label: string; hint: string }[] = [
  { id: "select", label: "Selecionar", hint: "Clique para selecionar, arraste para mover" },
  { id: "room", label: "Ambiente", hint: "Arraste na planta para criar o ambiente" },
  { id: "point", label: "Inserir ponto", hint: "Clique para inserir o componente escolhido" },
  { id: "panel", label: "Quadro", hint: "Clique para posicionar o quadro de distribuição" },
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
      setDoc(normalizeDocument(project.document));
      loaded.current = true;
    }
  }, [project]);

  const update = useCallback((updater: (d: PlanDocument) => PlanDocument) => {
    setDoc((d) => updater(d));
    setDirty(true);
  }, []);

  const save = useCallback(
    async (silent = false) => {
      setSaving(true);
      const { error } = await supabase.from("projects").update({ document: doc }).eq("id", id);
      setSaving(false);
      if (error) {
        toast.error("Falha ao salvar o projeto.");
        return;
      }
      setDirty(false);
      if (!silent) toast.success("Projeto salvo.");
    },
    [doc, id],
  );

  // autosave
  useEffect(() => {
    if (!dirty || !loaded.current) return;
    const t = setTimeout(() => void save(true), 1500);
    return () => clearTimeout(t);
  }, [dirty, save]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA"].includes(target.tagName)) return;
      if ((e.key === "Delete" || e.key === "Backspace") && selection) {
        e.preventDefault();
        update((d) => ({
          rooms: d.rooms.filter((r) => selection.type !== "room" || r.id !== selection.id),
          points: d.points.filter((p) => selection.type !== "point" || p.id !== selection.id),
          panels: d.panels.filter((p) => selection.type !== "panel" || p.id !== selection.id),
          conduits: d.conduits.filter(
            (c) =>
              (selection.type !== "conduit" || c.id !== selection.id) &&
              c.from !== selection.id &&
              c.to !== selection.id,
          ),
        }));
        setSelection(null);
      }
      if (e.key === "Escape") setTool("select");
      if (e.key === "v") setTool("select");
      if (e.key === "a") setTool("room");
      if (e.key === "p") setTool("point");
      if (e.key === "e") setTool("conduit");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selection, update]);

  const summary = useMemo(() => summarize(doc), [doc]);
  const activeTool = TOOLS.find((t) => t.id === tool);

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <header className="flex shrink-0 items-center justify-between gap-4 border-b border-border bg-sidebar px-4 py-2">
        <div className="flex items-center gap-3">
          <Link to="/projetos" className="tech-label hover:text-foreground">
            ← Projetos
          </Link>
          <div className="h-5 w-px bg-border" />
          <div>
            <p className="text-sm font-medium leading-tight">
              {isLoading ? "Carregando..." : project?.name}
            </p>
            <p className="tech-label">{project?.client_name || "sem cliente"}</p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {TOOLS.map((t) => (
            <Button
              key={t.id}
              size="sm"
              variant={tool === t.id ? "default" : "ghost"}
              onClick={() => setTool(t.id)}
            >
              {t.label}
            </Button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <span className="tech-label">
            {saving ? "salvando..." : dirty ? "alterações pendentes" : "salvo"}
          </span>
          <Button size="sm" variant="secondary" onClick={() => void save()}>
            Salvar
          </Button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="w-64 shrink-0">
          <LibraryPanel
            activeKind={activeKind}
            onPick={(k) => {
              setActiveKind(k);
              setTool("point");
            }}
            visible={visible}
            onToggleLayer={(l) => setVisible((v) => ({ ...v, [l]: !v[l] }))}
          />
        </aside>

        <main className="relative min-w-0 flex-1">
          <PlanCanvas
            doc={doc}
            onChange={update}
            tool={tool}
            activeKind={activeKind}
            visible={visible}
            selection={selection}
            onSelect={setSelection}
            onToolDone={() => setTool("select")}
          />
          <div
            className={cn(
              "pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full border border-border bg-card/95 px-4 py-1.5 text-xs text-muted-foreground",
            )}
          >
            {activeTool?.hint}
          </div>
        </main>

        <aside className="w-72 shrink-0">
          <PropertiesPanel
            doc={doc}
            selection={selection}
            summary={summary}
            onChange={update}
            onSelect={setSelection}
          />
        </aside>
      </div>

      {!isLoading && !project && (
        <div className="p-6">
          <Button onClick={() => navigate({ to: "/projetos" })}>Projeto não encontrado</Button>
        </div>
      )}
    </div>
  );
}
