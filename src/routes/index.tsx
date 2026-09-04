import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { CATALOG } from "@/lib/electrical";
import { SymbolPreview } from "@/components/plan/SymbolGlyph";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Voltplan — Editor de planta para projeto elétrico" },
      {
        name: "description",
        content:
          "Desenhe a planta, posicione pontos de luz, tomadas, equipamentos, quadros e eletrodutos, e acompanhe o resumo do projeto elétrico em tempo real.",
      },
      { property: "og:title", content: "Voltplan — Editor de planta para projeto elétrico" },
      {
        property: "og:description",
        content: "Planta, pontos elétricos, eletrodutos e quadros em um editor técnico na nuvem.",
      },
    ],
  }),
  component: Landing,
});

const FEATURES = [
  {
    title: "Planta com escala real",
    text: "Ambientes retangulares com cotas automáticas, grade de 25 cm e encaixe. Zoom e navegação livre.",
  },
  {
    title: "Biblioteca elétrica",
    text: "22 componentes com símbolos normalizados: iluminação, comandos, tomadas TUG/TUE e equipamentos.",
  },
  {
    title: "Camadas de desenho",
    text: "Arquitetura, iluminação, tomadas, interruptores, equipamentos, eletrodutos e quadro — ligue e desligue.",
  },
  {
    title: "Eletrodutos conectados",
    text: "Ligue quadro, caixas e pontos. O comprimento de cada trecho é calculado direto do desenho.",
  },
];

function Landing() {
  const { user, loading } = useAuth();

  return (
    <div className="min-h-screen">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary font-mono text-sm font-bold text-primary-foreground">
              V
            </span>
            <span className="text-lg font-semibold tracking-tight">Voltplan</span>
          </div>
          <Button asChild size="sm" variant={user ? "default" : "secondary"}>
            <Link to={user ? "/projetos" : "/auth"}>
              {loading ? "..." : user ? "Meus projetos" : "Entrar"}
            </Link>
          </Button>
        </div>
      </header>

      <main>
        <section className="blueprint-surface border-b border-border">
          <div className="mx-auto max-w-6xl px-6 py-24">
            <p className="tech-label mb-4">Fase 1 · Editor de planta</p>
            <h1 className="max-w-3xl text-4xl font-bold leading-tight sm:text-6xl">
              O desenho da instalação elétrica,{" "}
              <span className="text-primary">com dados de engenharia por trás.</span>
            </h1>
            <p className="mt-6 max-w-2xl text-lg text-muted-foreground">
              Crie ambientes, distribua pontos de luz, tomadas e equipamentos, posicione o quadro e
              trace os eletrodutos. Cada elemento carrega potência, tensão, altura e circuito.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link to={user ? "/projetos" : "/auth"}>Começar um projeto</Link>
              </Button>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 py-20">
          <h2 className="text-2xl font-semibold">O que já está pronto</h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {FEATURES.map((f) => (
              <div key={f.title} className="rounded-lg border border-border bg-card p-5">
                <h3 className="font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{f.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="border-t border-border bg-card/40">
          <div className="mx-auto max-w-6xl px-6 py-16">
            <p className="tech-label mb-6">Simbologia disponível</p>
            <div className="flex flex-wrap gap-x-6 gap-y-4">
              {CATALOG.map((c) => (
                <div key={c.kind} className="flex items-center gap-2">
                  <SymbolPreview kind={c.kind} />
                  <span className="text-sm text-muted-foreground">{c.label}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border py-8">
        <p className="mx-auto max-w-6xl px-6 text-xs text-muted-foreground">
          Os cálculos e verificações são ferramentas de apoio. A validação final e a
          responsabilidade técnica do projeto são do profissional habilitado.
        </p>
      </footer>
    </div>
  );
}
