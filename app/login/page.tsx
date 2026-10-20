"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Heart, LoaderCircle, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const supabase = createClient();

      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.replace("/pacientes");
        router.refresh();
        return;
      }

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      });
      if (error) throw error;

      if (data.session) {
        router.replace("/pacientes");
        router.refresh();
        return;
      }

      setSuccessMessage("Conta criada. Confira seu e-mail para confirmar o cadastro antes de entrar.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Não foi possível concluir a solicitação.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <a className="auth-brand" href="/" aria-label="MenteHub início">
          <span className="auth-brand-mark"><Heart size={20} /></span>
          <span><strong>mentehub</strong><small>seu consultório em harmonia</small></span>
        </a>
        <p className="auth-eyebrow">SEU ESPAÇO PROFISSIONAL</p>
        <h1>{mode === "login" ? "Que bom ter você de volta." : "Vamos preparar seu espaço."}</h1>
        <p className="auth-description">
          {mode === "login"
            ? "Entre para acessar seus pacientes e organizar sua rotina."
            : "Crie sua conta para começar a configurar seu consultório."}
        </p>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label htmlFor="email">E-mail profissional</label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="voce@exemplo.com"
          />
          <label htmlFor="password">Senha</label>
          <input
            id="password"
            type="password"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            minLength={8}
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Pelo menos 8 caracteres"
          />
          {errorMessage && <p className="auth-message auth-error" role="alert">{errorMessage}</p>}
          {successMessage && <p className="auth-message auth-success" role="status">{successMessage}</p>}
          <button className="button button-primary auth-submit" type="submit" disabled={busy}>
            {busy ? <LoaderCircle className="spin" size={16} /> : null}
            {busy ? "Aguarde…" : mode === "login" ? "Entrar com segurança" : "Criar conta"}
          </button>
        </form>

        <button
          className="auth-switch"
          type="button"
          onClick={() => {
            setMode(mode === "login" ? "register" : "login");
            setErrorMessage("");
            setSuccessMessage("");
          }}
        >
          {mode === "login" ? "Ainda não tem conta? Criar conta" : "Já tem uma conta? Entrar"}
        </button>
        <p className="auth-security"><ShieldCheck size={14} /> Seus dados são protegidos por autenticação e políticas de acesso.</p>
        <a className="auth-back" href="/">Voltar à página inicial</a>
      </section>
    </main>
  );
}
