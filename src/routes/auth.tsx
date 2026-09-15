import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Eye, EyeOff, KeyRound, LockKeyhole, Mail, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useAuth } from "@/lib/auth";

type AuthMode = "login" | "signup" | "forgot" | "reset";
const ATTEMPT_KEY = "voltplan-auth-attempts";
const GENERIC_ERROR = "Não foi possível concluir. Confira os dados e tente novamente.";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Acesso seguro — Voltplan" },
      { name: "description", content: "Acesse sua conta Voltplan com segurança." },
      { name: "robots", content: "noindex, nofollow, noarchive" },
      { property: "og:title", content: "Acesso seguro — Voltplan" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const initialReset =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("mode") === "reset";
  const [mode, setMode] = useState<AuthMode>(initialReset ? "reset" : "login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [lockedUntil, setLockedUntil] = useState(0);
  const { user } = useAuth();
  const navigate = useNavigate();
  const passwordChecks = useMemo(() => validatePassword(password), [password]);
  const requiresPassword = mode === "login" || mode === "signup" || mode === "reset";

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setMode("reset");
    });
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (user && mode !== "reset") navigate({ to: "/projetos" });
  }, [user, mode, navigate]);

  const changeMode = (next: AuthMode) => {
    setMode(next);
    setPassword("");
    setConfirmPassword("");
    setShowPassword(false);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    if (Date.now() < lockedUntil) {
      toast.error("Muitas tentativas. Aguarde um pouco antes de tentar novamente.");
      return;
    }
    if (
      (mode === "signup" || mode === "reset") &&
      (!passwordChecks.every((item) => item.ok) || password !== confirmPassword)
    ) {
      toast.error(
        password !== confirmPassword
          ? "As senhas não coincidem."
          : "A senha ainda não atende aos requisitos de segurança.",
      );
      return;
    }
    setBusy(true);
    try {
      if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
          redirectTo: `${window.location.origin}/auth?mode=reset`,
        });
        if (error) throw error;
        toast.success("Se o e-mail estiver cadastrado, enviaremos as instruções de recuperação.");
        changeMode("login");
      } else if (mode === "reset") {
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        await supabase.auth.signOut({ scope: "global" });
        toast.success("Senha alterada. Entre novamente com a nova senha.");
        changeMode("login");
      } else if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email: normalizedEmail,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth`,
            data: { full_name: name.trim() },
          },
        });
        if (error) throw error;
        clearAttempts();
        toast.success("Cadastro recebido. Verifique seu e-mail para confirmar o acesso.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: normalizedEmail,
          password,
        });
        if (error) throw error;
        clearAttempts();
      }
    } catch {
      if (mode === "login") registerFailedAttempt(setLockedUntil);
      toast.error(GENERIC_ERROR);
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    setBusy(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: `${window.location.origin}/projetos`,
      });
      if (result.error) throw result.error;
      if (!result.redirected) navigate({ to: "/projetos" });
    } catch {
      toast.error(GENERIC_ERROR);
      setBusy(false);
    }
  };

  return (
    <div className="blueprint-surface flex min-h-screen items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <p className="tech-label">Voltplan</p>
          <ShieldCheck className="size-5 text-primary" aria-label="Acesso protegido" />
        </div>
        <h1 className="mt-1 text-2xl font-semibold">{titleFor(mode)}</h1>
        <p className="mt-1 text-xs text-muted-foreground">{subtitleFor(mode)}</p>

        <form onSubmit={submit} className="mt-6 space-y-3" autoComplete="on">
          {mode === "signup" && (
            <Field label="Nome" id="name">
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
                maxLength={100}
                required
              />
            </Field>
          )}
          {mode !== "reset" && (
            <Field label="E-mail" id="email">
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="email"
                  className="pl-9"
                  type="email"
                  inputMode="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  maxLength={254}
                  required
                />
              </div>
            </Field>
          )}
          {requiresPassword && (
            <Field label={mode === "reset" ? "Nova senha" : "Senha"} id="password">
              <div className="relative">
                <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="password"
                  className="px-9"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  minLength={mode === "login" ? 6 : 10}
                  maxLength={128}
                  required
                />
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? "Ocultar senha" : "Visualizar senha"}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </Field>
          )}
          {(mode === "signup" || mode === "reset") && (
            <>
              <PasswordStrength checks={passwordChecks} />
              <Field label="Confirmar senha" id="confirm-password">
                <Input
                  id="confirm-password"
                  type={showPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  minLength={10}
                  maxLength={128}
                  required
                />
              </Field>
            </>
          )}
          {mode === "login" && (
            <button
              type="button"
              className="text-xs text-primary hover:underline"
              onClick={() => changeMode("forgot")}
            >
              Esqueci minha senha
            </button>
          )}
          <Button type="submit" className="w-full" disabled={busy || Date.now() < lockedUntil}>
            {busy ? "Aguarde..." : actionFor(mode)}
          </Button>
        </form>

        {(mode === "login" || mode === "signup") && (
          <>
            <div className="my-4 flex items-center gap-3">
              <span className="h-px flex-1 bg-border" />
              <span className="tech-label">ou</span>
              <span className="h-px flex-1 bg-border" />
            </div>
            <Button
              type="button"
              variant="secondary"
              className="w-full"
              onClick={google}
              disabled={busy}
            >
              Continuar com Google
            </Button>
          </>
        )}
        <button
          type="button"
          className="mt-5 w-full text-sm text-muted-foreground hover:text-foreground"
          onClick={() =>
            changeMode(mode === "signup" ? "login" : mode === "login" ? "signup" : "login")
          }
        >
          {mode === "signup"
            ? "Já tem conta? Entrar"
            : mode === "login"
              ? "Não tem conta? Cadastre-se"
              : "Voltar para o login"}
        </button>
        <div className="mt-5 flex items-start gap-2 rounded border border-border/70 bg-muted/30 p-2 text-[10px] text-muted-foreground">
          <KeyRound className="mt-0.5 size-3.5 shrink-0 text-primary" />
          <span>
            Sua senha é processada pelo provedor de autenticação e nunca é armazenada no documento
            dos seus projetos.
          </span>
        </div>
      </div>
    </div>
  );
}

function Field({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}
function validatePassword(value: string) {
  return [
    { label: "10 ou mais caracteres", ok: value.length >= 10 },
    { label: "maiúscula e minúscula", ok: /[a-z]/.test(value) && /[A-Z]/.test(value) },
    { label: "número", ok: /\d/.test(value) },
    { label: "caractere especial", ok: /[^A-Za-z0-9]/.test(value) },
  ];
}
function PasswordStrength({ checks }: { checks: ReturnType<typeof validatePassword> }) {
  const score = checks.filter((item) => item.ok).length;
  return (
    <div className="rounded border border-border/70 p-2">
      <div className="mb-2 flex gap-1">
        {checks.map((_, index) => (
          <span
            key={index}
            className={`h-1 flex-1 rounded ${index < score ? (score === 4 ? "bg-emerald-500" : "bg-amber-500") : "bg-muted"}`}
          />
        ))}
      </div>
      <ul className="grid grid-cols-2 gap-1 text-[9px] text-muted-foreground">
        {checks.map((item) => (
          <li key={item.label} className={item.ok ? "text-emerald-500" : ""}>
            {item.ok ? "✓" : "○"} {item.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
function titleFor(mode: AuthMode) {
  return {
    login: "Entrar",
    signup: "Criar conta",
    forgot: "Recuperar senha",
    reset: "Definir nova senha",
  }[mode];
}
function subtitleFor(mode: AuthMode) {
  return {
    login: "Acesse seus projetos com segurança.",
    signup: "Crie uma senha forte para proteger seus dados.",
    forgot: "Enviaremos um link seguro se a conta existir.",
    reset: "Escolha uma senha nova e diferente da anterior.",
  }[mode];
}
function actionFor(mode: AuthMode) {
  return {
    login: "Entrar",
    signup: "Criar conta",
    forgot: "Enviar link de recuperação",
    reset: "Alterar senha",
  }[mode];
}
function clearAttempts() {
  try {
    sessionStorage.removeItem(ATTEMPT_KEY);
  } catch {
    /* storage indisponível */
  }
}
function registerFailedAttempt(setLockedUntil: (value: number) => void) {
  try {
    const attempts = Number(sessionStorage.getItem(ATTEMPT_KEY) ?? "0") + 1;
    sessionStorage.setItem(ATTEMPT_KEY, String(attempts));
    if (attempts >= 5) setLockedUntil(Date.now() + Math.min(300_000, 30_000 * (attempts - 4)));
  } catch {
    /* O Supabase também aplica limites no servidor. */
  }
}
