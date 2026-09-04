import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { normalizeDocument, summarize } from "@/lib/electrical";

export const Route = createFileRoute("/_authenticated/projetos/")({
  head: () => ({
    meta: [
      { title: "Meus projetos — Voltplan" },
      { name: "description", content: "Lista dos seus projetos elétricos no Voltplan." },
      { property: "og:title", content: "Meus projetos — Voltplan" },
      { property: "og:description", content: "Lista dos seus projetos elétricos no Voltplan." },
    ],
  }),
  component: ProjectsPage,
});

function ProjectsPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", client_name: "", site_address: "" });

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const create = async () => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    const { data, error } = await supabase
      .from("projects")
      .insert({
        name: form.name || "Novo projeto",
        client_name: form.client_name,
        site_address: form.site_address,
        user_id: userData.user.id,
      })
      .select()
      .single();
    if (error) {
      toast.error("Não foi possível criar o projeto.");
      return;
    }
    setOpen(false);
    qc.invalidateQueries({ queryKey: ["projects"] });
    navigate({ to: "/projetos/$id", params: { id: data.id } });
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    qc.clear();
    navigate({ to: "/" });
  };

  return (
    <div className="min-h-screen">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary font-mono text-sm font-bold text-primary-foreground">
              V
            </span>
            <span className="font-semibold tracking-tight">Voltplan</span>
          </Link>
          <Button variant="ghost" size="sm" onClick={signOut}>
            Sair
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10">
        <div className="flex items-end justify-between">
          <div>
            <p className="tech-label">Fase 1 · Editor de planta</p>
            <h1 className="text-3xl font-semibold">Meus projetos</h1>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>Novo projeto</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Novo projeto elétrico</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label htmlFor="p-name">Nome do projeto</Label>
                  <Input
                    id="p-name"
                    placeholder="Residência Silva"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="p-client">Cliente</Label>
                  <Input
                    id="p-client"
                    value={form.client_name}
                    onChange={(e) => setForm({ ...form, client_name: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="p-addr">Endereço da obra</Label>
                  <Input
                    id="p-addr"
                    value={form.site_address}
                    onChange={(e) => setForm({ ...form, site_address: e.target.value })}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={create}>Criar e abrir editor</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <div className="mt-8 space-y-3">
          {isLoading && <p className="text-sm text-muted-foreground">Carregando...</p>}
          {!isLoading && projects.length === 0 && (
            <div className="rounded-lg border border-dashed border-border p-10 text-center">
              <p className="text-muted-foreground">
                Nenhum projeto ainda. Crie o primeiro e comece a desenhar a planta.
              </p>
            </div>
          )}
          {projects.map((p) => {
            const s = summarize(normalizeDocument(p.document));
            return (
              <Link
                key={p.id}
                to="/projetos/$id"
                params={{ id: p.id }}
                className="flex items-center justify-between rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary"
              >
                <div>
                  <p className="font-medium">{p.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {[p.client_name, p.site_address].filter(Boolean).join(" · ") || "Sem cliente definido"}
                  </p>
                </div>
                <div className="text-right font-mono text-xs text-muted-foreground">
                  <div>
                    {s.totalPoints} pontos · {s.area.toFixed(1)} m²
                  </div>
                  <div>{s.installedPower.toLocaleString("pt-BR")} VA instalados</div>
                </div>
              </Link>
            );
          })}
        </div>
      </main>
    </div>
  );
}
