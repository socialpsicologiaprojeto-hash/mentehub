import Link from "next/link";
import {
  Activity,
  ArrowRight,
  CalendarDays,
  CreditCard,
  Heart,
  Settings,
  ShieldCheck,
  Users,
  UserRound,
} from "lucide-react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function initials(name: string) {
  const parts = name.trim().split(/\\s+/).filter(Boolean);
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

  const modules = [
    {
      title: "Agenda",
      description: "Organize horários, acompanhe consultas e mantenha sua rotina em ordem.",
      category: "ORGANIZAÇÃO",
      href: "/agenda",
      icon: CalendarDays,
      color: "sage",
      iconColor: "green",
    },
    {
      title: "Pacientes e prontuários",
      description: "Consulte cadastros, registros clínicos e anamneses dos pacientes.",
      category: "CUIDADO CLÍNICO",
      href: "/pacientes",
      icon: Users,
      color: "peach",
      iconColor: "peach-icon",
    },
    {
      title: "Financeiro",
      description: "Acompanhe recebíveis, mensalidades, pagamentos e despesas.",
      category: "GESTÃO",
      href: "/financeiro",
      icon: CreditCard,
      color: "lavender",
      iconColor: "lilac",
    },
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
            <Link className="nav-link active" href="/">
              <Activity size={17} /><span>Visão geral</span>
            </Link>
            {modules.map((item) => (
              <Link className="nav-link" href={item.href} key={item.href}>
                <item.icon size={17} /><span>{item.title}</span>
              </Link>
            ))}
          </div>
        </nav>

        <div className="sidebar-bottom">
          <Link className="nav-link" href="/perfil">
            <Settings size={17} /><span>Perfil profissional</span>
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
          <div className="top-actions"><span className="avatar" aria-label={displayName}>{avatar}</span></div>
        </header>

        <div className="content">
          <div className="welcome-row">
            <div>
              <p className="eyebrow"><span className="eyebrow-dot" /> SEU ESPAÇO PROFISSIONAL</p>
              <h1>Um bom dia começa <em>com espaço.</em></h1>
              <p className="subheading">Olá, {displayName}. Vamos cuidar um pouquinho do seu consultório?</p>
            </div>
          </div>

          <section className="studio-panel" aria-label="Boas-vindas ao MenteHub">
            <div className="studio-copy">
              <div className="section-kicker"><Heart size={15} /> SEU CONSULTÓRIO, EM HARMONIA</div>
              <h2>Mais espaço para o cuidado. <em>Mais leveza na rotina.</em></h2>
              <p>Reúna a organização da agenda, os registros clínicos e o acompanhamento financeiro em um só lugar, com acesso aos módulos disponíveis na sua conta.</p>
              <Link className="button button-primary generate-button" href="/agenda">
                <CalendarDays size={16} /> Acessar minha agenda <ArrowRight size={16} />
              </Link>
              <p className="microcopy"><ShieldCheck size={13} /> Entre na sua conta para acessar os dados do seu consultório.</p>
            </div>
            <div className="studio-art" aria-hidden="true">
              <div className="art-window">
                <div className="art-toolbar"><span /><span /><span /><small>MENTEHUB</small></div>
                <div className="art-canvas">
                  <div className="art-leaf leaf-one" />
                  <div className="art-leaf leaf-two" />
                  <div className="art-copy">
                    <span className="art-overline">UM ESPAÇO PARA RESPIRAR</span>
                    <p>Organização para<br /><em>cuidar melhor.</em></p>
                    <span className="art-rule" />
                    <small>SEU CONSULTÓRIO</small>
                  </div>
                  <div className="art-seal"><Heart size={15} /></div>
                </div>
                <div className="art-caption"><span>● Cuidado e organização</span><span>MENTEHUB</span></div>
              </div>
              <div className="floating-note">
                <span className="note-check"><ShieldCheck size={14} /></span>
                <span><strong>Seu espaço profissional</strong><small>Agenda · Clínica · Gestão</small></span>
              </div>
            </div>
          </section>

          <section className="templates-section" aria-labelledby="modules-heading">
            <div className="section-heading">
              <div>
                <p className="eyebrow">ÁREAS DISPONÍVEIS</p>
                <h2>Cuide de cada parte do consultório</h2>
                <p className="section-desc">Escolha um módulo para continuar de onde parou.</p>
              </div>
            </div>
            <div className="template-grid">
              {modules.map((item, index) => (
                <Link className="template-card" href={item.href} key={item.href}>
                  <div className={`template-preview ${item.color}`}>
                    <span className="template-index"><item.icon size={22} /></span>
                    <span className="template-category">{item.category}</span>
                    <p>{item.title}</p>
                    <span className="template-footer">Acessar módulo <span>↗</span></span>
                  </div>
                  <div className="template-meta">
                    <div><strong>{item.title}</strong><small>{item.description}</small></div>
                    <ArrowRight size={16} />
                  </div>
                </Link>
              ))}
            </div>
          </section>

          <section className="bottom-grid" aria-label="Perfil profissional">
            <article className="bottom-card">
              <div className="bottom-icon"><UserRound size={18} /></div>
              <div>
                <h3>Seu perfil profissional</h3>
                <p>Confira e atualize os dados do perfil associado à sua conta.</p>
                <Link className="text-button" href="/perfil">Acessar perfil <ArrowRight size={14} /></Link>
              </div>
            </article>
            <article className="bottom-card">
              <div className="bottom-icon"><ShieldCheck size={18} /></div>
              <div>
                <h3>Um espaço individual</h3>
                <p>O painel identifica o profissional conectado à sessão atual.</p>
                <span className="text-button">Conta autenticada</span>
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
