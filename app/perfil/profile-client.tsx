"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Heart, LoaderCircle, Save } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Props = {
  userId: string;
  email: string;
  initialName: string;
  initialRegistration: string;
  initialTimezone: string;
};

export default function ProfileClient({ userId, email, initialName, initialRegistration, initialTimezone }: Props) {
  const router = useRouter();
  const [fullName, setFullName] = useState(initialName);
  const [registration, setRegistration] = useState(initialRegistration);
  const [timezone, setTimezone] = useState(initialTimezone);
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
      const { error } = await supabase.from("profiles").upsert({
        id: userId,
        full_name: fullName.trim(),
        professional_registration: registration.trim() || null,
        timezone,
      }, { onConflict: "id" });
      if (error) throw error;
      setSuccessMessage("Perfil salvo com sucesso.");
      router.refresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Não foi possível salvar o perfil.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <Link className="auth-brand" href="/" aria-label="Voltar ao MenteHub">
          <span className="auth-brand-mark"><Heart size={20} /></span>
          <span><strong>mentehub</strong><small>seu consultório em harmonia</small></span>
        </Link>
        <p className="auth-eyebrow">CONFIGURAÇÕES DA CONTA</p>
        <h1>Perfil profissional</h1>
        <p className="auth-description">Personalize as informações associadas à sua conta.</p>
        <form className="auth-form" onSubmit={handleSubmit}>
          <label htmlFor="profile-email">E-mail da conta</label>
          <input id="profile-email" type="email" value={email} readOnly />
          <label htmlFor="full-name">Nome completo</label>
          <input id="full-name" value={fullName} onChange={(event) => setFullName(event.target.value)} required maxLength={120} autoComplete="name" />
          <label htmlFor="registration">Registro profissional (opcional)</label>
          <input id="registration" value={registration} onChange={(event) => setRegistration(event.target.value)} maxLength={80} placeholder="Ex.: CRP 00/00000" />
          <label htmlFor="timezone">Fuso horário</label>
          <select id="timezone" value={timezone} onChange={(event) => setTimezone(event.target.value)} required>
            <option value="America/Sao_Paulo">Brasília (America/Sao_Paulo)</option>
            <option value="America/Manaus">Manaus (America/Manaus)</option>
            <option value="America/Rio_Branco">Rio Branco (America/Rio_Branco)</option>
            <option value="America/Noronha">Fernando de Noronha (America/Noronha)</option>
          </select>
          {errorMessage && <p className="auth-message auth-error" role="alert">{errorMessage}</p>}
          {successMessage && <p className="auth-message auth-success" role="status">{successMessage}</p>}
          <button className="button button-primary auth-submit" type="submit" disabled={busy}>
            {busy ? <LoaderCircle className="spin" size={16} /> : <Save size={16} />}
            {busy ? "Salvando…" : "Salvar perfil"}
          </button>
        </form>
        <Link className="auth-back" href="/">Voltar ao início</Link>
      </section>
    </main>
  );
}
