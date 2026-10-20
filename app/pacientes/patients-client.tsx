"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, LogOut, Pencil, Plus, Search, Trash2, Users, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Patient = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  status: "active" | "inactive";
  created_at: string;
};

type PatientForm = {
  full_name: string;
  email: string;
  phone: string;
  status: "active" | "inactive";
};

const emptyForm: PatientForm = { full_name: "", email: "", phone: "", status: "active" };

export default function PatientsClient({ userEmail }: { userEmail: string }) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [form, setForm] = useState<PatientForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [notice, setNotice] = useState("");

  const loadPatients = useCallback(async () => {
    setLoading(true);
    setErrorMessage("");
    const { data, error } = await supabase
      .from("patients")
      .select("id, full_name, email, phone, status, created_at")
      .order("full_name", { ascending: true });

    if (error) {
      setErrorMessage("Não foi possível carregar os pacientes. Confira a configuração do Supabase e as políticas de acesso.");
      setPatients([]);
    } else {
      setPatients((data ?? []) as Patient[]);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    void loadPatients();
  }, [loadPatients]);

  const filteredPatients = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("pt-BR");
    if (!term) return patients;
    return patients.filter((patient) =>
      [patient.full_name, patient.email ?? "", patient.phone ?? ""]
        .some((value) => value.toLocaleLowerCase("pt-BR").includes(term)),
    );
  }, [patients, search]);

  function startCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setErrorMessage("");
    setNotice("");
    setShowForm(true);
  }

  function startEdit(patient: Patient) {
    setEditingId(patient.id);
    setForm({
      full_name: patient.full_name,
      email: patient.email ?? "",
      phone: patient.phone ?? "",
      status: patient.status,
    });
    setErrorMessage("");
    setNotice("");
    setShowForm(true);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setErrorMessage("");
    setNotice("");

    const payload = {
      full_name: form.full_name.trim(),
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      status: form.status,
    };

    try {
      const result = editingId
        ? await supabase.from("patients").update(payload).eq("id", editingId).select("id").maybeSingle()
        : await supabase.from("patients").insert(payload).select("id").single();

      if (result.error) throw result.error;
      if (!result.data) throw new Error("Cadastro não encontrado ou sem permissão para alterá-lo.");

      setShowForm(false);
      setEditingId(null);
      setForm(emptyForm);
      setNotice(editingId ? "Cadastro atualizado." : "Paciente cadastrado.");
      await loadPatients();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Não foi possível salvar o cadastro.");
    } finally {
      setSaving(false);
    }
  }

  async function deletePatient(patient: Patient) {
    if (!window.confirm(`Deseja excluir o cadastro de ${patient.full_name}? Esta ação não pode ser desfeita.`)) return;
    setErrorMessage("");
    setNotice("");
    try {
      const { data, error } = await supabase
        .from("patients")
        .delete()
        .eq("id", patient.id)
        .select("id")
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("Cadastro não encontrado ou sem permissão para excluí-lo.");
      await loadPatients();
      setNotice("Cadastro excluído.");
    } catch {
      setErrorMessage("Não foi possível excluir. Verifique se há consultas ou lançamentos financeiros vinculados a este cadastro.");
    }
  }

  async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) {
      setErrorMessage("Não foi possível encerrar a sessão.");
      return;
    }
    router.replace("/login");
    router.refresh();
  }

  return (
    <main className="patients-page">
      <header className="patients-topbar">
        <a className="auth-brand" href="/" aria-label="MenteHub início">
          <span className="auth-brand-mark"><Users size={19} /></span>
          <span><strong>mentehub</strong><small>seu consultório em harmonia</small></span>
        </a>
        <div className="patients-account">
          <span>{userEmail}</span>
          <button type="button" className="patients-quiet-button" onClick={signOut}><LogOut size={15} /> Sair</button>
        </div>
      </header>

      <section className="patients-content">
        <a className="patients-back" href="/"><ArrowLeft size={15} /> Visão geral</a>
        <div className="patients-heading">
          <div>
            <p className="auth-eyebrow">ROTINA DO CONSULTÓRIO</p>
            <h1>Pacientes</h1>
            <p className="auth-description">Organize informações administrativas com privacidade e cuidado.</p>
          </div>
          <button type="button" className="button button-primary" onClick={startCreate}><Plus size={16} /> Novo paciente</button>
        </div>

        {notice && <div className="patients-notice" role="status">{notice}<button type="button" onClick={() => setNotice("")} aria-label="Fechar aviso"><X size={15} /></button></div>}
        {errorMessage && <div className="patients-error" role="alert">{errorMessage}</div>}

        {showForm && (
          <form className="patient-form-card" onSubmit={handleSubmit}>
            <div className="patient-form-heading">
              <h2>{editingId ? "Editar cadastro" : "Novo cadastro"}</h2>
              <button type="button" className="patients-icon-button" onClick={() => setShowForm(false)} aria-label="Fechar formulário"><X size={17} /></button>
            </div>
            <div className="patient-form-grid">
              <div className="patient-field patient-field-wide">
                <label htmlFor="patient-name">Nome completo *</label>
                <input id="patient-name" required maxLength={160} value={form.full_name} onChange={(event) => setForm({ ...form, full_name: event.target.value })} autoComplete="name" />
              </div>
              <div className="patient-field">
                <label htmlFor="patient-email">E-mail</label>
                <input id="patient-email" type="email" maxLength={254} value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} autoComplete="email" />
              </div>
              <div className="patient-field">
                <label htmlFor="patient-phone">Telefone</label>
                <input id="patient-phone" type="tel" maxLength={40} value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} autoComplete="tel" />
              </div>
              <div className="patient-field">
                <label htmlFor="patient-status">Situação</label>
                <select id="patient-status" value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as PatientForm["status"] })}>
                  <option value="active">Ativo</option>
                  <option value="inactive">Inativo</option>
                </select>
              </div>
            </div>
            <p className="patient-privacy-note">Use este cadastro apenas para dados administrativos. Não inclua diagnósticos, prontuários ou notas de sessão.</p>
            <div className="patient-form-actions">
              <button type="button" className="patients-quiet-button" onClick={() => setShowForm(false)}>Cancelar</button>
              <button type="submit" className="button button-primary" disabled={saving}>{saving ? "Salvando…" : editingId ? "Salvar alterações" : "Cadastrar paciente"}</button>
            </div>
          </form>
        )}

        <section className="patients-list-card">
          <div className="patients-list-heading">
            <div><h2>Lista de pacientes</h2><p>{patients.length} {patients.length === 1 ? "cadastro" : "cadastros"}</p></div>
            <label className="patients-search"><Search size={16} /><input aria-label="Buscar pacientes" placeholder="Buscar por nome, e-mail ou telefone" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
          </div>

          {loading ? <p className="patients-empty">Carregando cadastros…</p> : filteredPatients.length === 0 ? (
            <div className="patients-empty">
              <span className="patients-empty-icon"><Users size={21} /></span>
              <strong>{search ? "Nenhum resultado encontrado" : "Sua lista começa aqui"}</strong>
              <p>{search ? "Tente buscar com outro termo." : "Cadastre o primeiro paciente para começar a organizar sua rotina."}</p>
              {!search && <button type="button" className="button button-primary" onClick={startCreate}><Plus size={15} /> Novo paciente</button>}
            </div>
          ) : (
            <div className="patients-table-wrap">
              <table className="patients-table">
                <thead><tr><th>Nome</th><th>Contato</th><th>Situação</th><th aria-label="Ações"></th></tr></thead>
                <tbody>
                  {filteredPatients.map((patient) => (
                    <tr key={patient.id}>
                      <td><strong>{patient.full_name}</strong></td>
                      <td><span>{patient.email || "—"}</span><small>{patient.phone || ""}</small></td>
                      <td><span className={patient.status === "active" ? "patient-status patient-status-active" : "patient-status"}>{patient.status === "active" ? "Ativo" : "Inativo"}</span></td>
                      <td><div className="patient-row-actions"><button type="button" className="patients-icon-button" onClick={() => startEdit(patient)} aria-label={`Editar ${patient.full_name}`}><Pencil size={15} /></button><button type="button" className="patients-icon-button patients-delete-button" onClick={() => void deletePatient(patient)} aria-label={`Excluir ${patient.full_name}`}><Trash2 size={15} /></button></div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
        <p className="patients-footer">MenteHub · Acesso individual protegido por autenticação e políticas de banco de dados.</p>
      </section>
    </main>
  );
}
