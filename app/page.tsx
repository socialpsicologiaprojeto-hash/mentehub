"use server";

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
    { label: "Perfil profissional", href: "/perfil", icon: UserRound },
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
            <span>Configurações do perfil</span>
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

          <div className="section-heading">
            <div>
              <p className="eyebrow">ACESSO RÁPIDO</p>
              <h2>O que você precisa hoje?</h2>
              <p className="section-desc">Os módulos disponíveis estão reunidos abaixo.</p>
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
                <p>Consulte cadastros e acesse os prontuários.</p>
                <span className="template-index"><Users size={22} /></span>
              </div>
              <div className="template-meta">
                <div><strong>Pacientes e prontuários</strong><small>Cadastros, anamnese e evoluções</small></div>
                <ArrowRight size={16} />
              </div>
            </Link>
            <Link className="template-card" href="/financeiro">
              <div className="template-preview lavender">
                <span className="template-category">GESTÃO</span>
                <p>Acompanhe recebíveis, pagamentos e despesas.</p>
                <span className="template-index"><CreditCard size={22} /></span>
              </div>
              <div className="template-meta">
                <div><strong>Financeiro</strong><small>Receitas e despesas</small></div>
                <ArrowRight size={16} />
              </div>
            </Link>
            <Link className="template-card" href="/perfil">
              <div className="template-preview sage">
                <span className="template-category">PERSONALIZAÇÃO</span>
                <p>Mantenha seus dados profissionais atualizados.</p>
                <span className="template-index"><UserRound size={22} /></span>
              </div>
              <div className="template-meta">
                <div><strong>Perfil profissional</strong><small>Nome e informações do perfil</small></div>
                <ArrowRight size={16} />
              </div>
            </Link>
          </div>

          <footer className="footer">
            <span>mentehub · Feito para cuidar de quem cuida.</span>
            <span>Seu espaço profissional</span>
          </footer>
        </div>
      </section>
    </main>
  );
}
