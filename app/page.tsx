import Link from "next/link";
import { redirect } from "next/navigation";
import {
  CalendarDays,
  CreditCard,
  Heart,
  Settings,
  Users,
  UserRound,
  ArrowRight,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "P";
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("");
}

export default async function HomePage() {
  const supabase = await createClient();
  const { data: auth, error } = await supabase.auth.getUser();
  if (error || !auth.user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", auth.user.id)
    .maybeSingle();

  const displayName =
    profile?.full_name?.trim() ||
    auth.user.user_metadata?.full_name?.trim() ||
    auth.user.email?.split("@")[0] ||
    "Profissional";
  const avatar = initials(displayName);

  const navItems = [
    { label: "Agenda", href: "/agenda", icon: CalendarDays },
    { label: "Pacientes e prontuários", href: "/pacientes", icon: Users },
    { label: "Financeiro", href: "/financeiro", icon: CreditCard },
  ];

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <Link className="brand" href="/" aria-label="MenteHub início">
          <span className="brand-mark"><Heart size={20} /></span>
          <span><strong>mentehub</strong><small>seu consultório em harmonia</small></span>
        </Link>

        <div className="workspace-switch" aria-label="Profissional autenticado">
          <span className="avatar avatar-brand">{avatar}</span>
          <span className="workspace-copy">
            <strong>{displayName}</strong>
            <small>Espaço profissional</small>
          </span>
        </div>

        <nav className="nav" aria-label="Menu principal">
          <div className="nav-group">
            <p className="nav-heading">CONSULTÓRIO</p>
            {navItems.map((item) => (
              <Link className="nav-link" href={item.href} key={item.href}>
                <item.icon size={17} />
                <span>{item.label}</span>
              </Link>
            ))}
          </div>
        </nav>

        <div className="sidebar-bottom">
          <Link className="nav-link" href="/perfil">
            <Settings size={17} />
            <span>Meu perfil profissional</span>
          </Link>
          <div className="profile">
            <span className="avatar">{avatar}</span>
            <span className="workspace-copy">
              <strong>{displayName}</strong>
              <small>{auth.user.email ?? "Conta autenticada"}</small>
            </span>
          </div>
        </div>
      </aside>

      <section className="main-area">
        <header className="topbar">
          <div className="breadcrumb">Seu espaço <span>/</span> <strong>Visão geral</strong></div>
          <div className="top-actions">
            <span className="avatar" aria-label={displayName}>{avatar}</span>
          </div>
        </header>

        <div className="content">
          <div className="welcome-row">
            <div>
              <p className="eyebrow"><span className="eyebrow-dot" /> SEU ESPAÇO PROFISSIONAL</p>
              <h1>Seu consultório, <em>em harmonia.</em></h1>
              <p className="subheading">Olá, {displayName}. Acesse as áreas disponíveis do seu consultório.</p>
            </div>
          </div>

          <section className="templates-section" aria-labelledby="modules-heading">
            <div className="section-heading">
              <div>
                <p className="eyebrow">SEU CONSULTÓRIO</p>
                <h2 id="modules-heading">Acesse seus módulos</h2>
                <p className="section-desc">Somente as áreas disponíveis no MenteHub.</p>
              </div>
            </div>

            <div className="template-grid">
              <Link className="template-card" href="/agenda">
                <div className="template-preview sage">
                  <span className="template-category">CONSULTÓRIO</span>
                  <p>Organize seus horários e acompanhe as consultas.</p>
                  <span className="template-index"><CalendarDays size={22} /></span>
                </div>
                <div className="template-meta">
                  <div><strong>Agenda</strong><small>Consultas e horários</small></div>
                  <ArrowRight size={16} />
                </div>
              </Link>

              <Link className="template-card" href="/pacientes">
                <div className="template-preview peach">
                  <span className="template-category">CUIDADO CLÍNICO</span>
                  <p>Acesse cadastros, prontuários e anamneses.</p>
                  <span className="template-index"><Users size={22} /></span>
                </div>
                <div className="template-meta">
                  <div><strong>Pacientes e prontuários</strong><small>Cadastros e registros clínicos</small></div>
                  <ArrowRight size={16} />
                </div>
              </Link>

              <Link className="template-card" href="/financeiro">
                <div className="template-preview lavender">
                  <span className="template-category">GESTÃO</span>
                  <p>Acompanhe recebíveis, mensalidades e pagamentos.</p>
                  <span className="template-index"><CreditCard size={22} /></span>
                </div>
                <div className="template-meta">
                  <div><strong>Financeiro</strong><small>Receitas e despesas</small></div>
                  <ArrowRight size={16} />
                </div>
              </Link>
            </div>
          </section>

          <section className="bottom-grid" aria-label="Perfil profissional">
            <article className="bottom-card">
              <div className="bottom-icon"><UserRound size={18} /></div>
              <div>
                <h3>Seu perfil profissional</h3>
                <p>Confira e atualize os dados do seu perfil.</p>
                <Link className="text-button" href="/perfil">Acessar perfil <ArrowRight size={14} /></Link>
              </div>
            </article>
          </section>

          <footer className="footer">
            <span>mentehub · Feito para cuidar de quem cuida.</span>
            <span>Conectado como {auth.user.email ?? "Conta autenticada"}</span>
          </footer>
        </div>
      </section>
    </main>
  );
}
