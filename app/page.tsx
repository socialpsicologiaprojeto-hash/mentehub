import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarDays, CreditCard, Heart, Settings, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const supabase = await createClient();
  const { data: auth, error } = await supabase.auth.getUser();
  if (error || !auth.user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", auth.user.id)
    .maybeSingle();

  const displayName = profile?.full_name?.trim() || auth.user.email?.split("@")[0] || "Profissional";

  return (
    <main className="auth-page">
      <section className="auth-card" style={{ maxWidth: 720 }}>
        <Link className="auth-brand" href="/" aria-label="MenteHub início">
          <span className="auth-brand-mark"><Heart size={20} /></span>
          <span><strong>mentehub</strong><small>seu consultório em harmonia</small></span>
        </Link>
        <p className="auth-eyebrow">SEU ESPAÇO PROFISSIONAL</p>
        <h1>Olá, {displayName}.</h1>
        <p className="auth-description">Acesse os módulos disponíveis do seu consultório.</p>
        <div style={{ display: "grid", gap: 12, marginTop: 24 }}>
          <Link className="button button-primary" href="/agenda"><CalendarDays size={17} /> Agenda</Link>
          <Link className="button button-primary" href="/pacientes"><Users size={17} /> Pacientes e prontuários</Link>
          <Link className="button button-primary" href="/financeiro"><CreditCard size={17} /> Financeiro</Link>
          <Link className="button" href="/perfil"><Settings size={17} /> Meu perfil profissional</Link>
        </div>
        <p className="auth-security" style={{ marginTop: 24 }}>Conectado como {auth.user.email}. Os módulos demonstrativos e ainda indisponíveis foram retirados desta página.</p>
      </section>
    </main>
  );
}
