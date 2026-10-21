"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, BookOpenText, LogOut, Pencil, Plus, Search, Trash2, Users, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Patient = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  requires_invoice: boolean;
  billing_mode: "per_session" | "monthly";
  default_session_price: number | string | null;
  monthly_fee: number | string | null;
  billing_due_day: number | null;
  preferred_payment_method: "pix" | "cash" | "credit_card" | "debit_card" | "bank_transfer" | "other" | null;
  status: "active" | "inactive";
  created_at: string;
};

type PatientForm = {
  full_name: string;
  email: string;
  phone: string;
  requires_invoice: boolean;
  billing_mode: "per_session" | "monthly";
  default_session_price: string;
  monthly_fee: string;
  billing_due_day: string;
  preferred_payment_method: "" | "pix" | "cash" | "credit_card" | "debit_card" | "bank_transfer" | "other";
  status: "active" | "inactive";
};

const emptyForm: PatientForm = { full_name: "", email: "", phone: "", requires_invoice: false, billing_mode: "per_session", default_session_price: "", monthly_fee: "", billing_due_day: "", preferred_payment_method: "", status: "active" };

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
      .select("id, full_name, email, phone, requires_invoice, billing_mode, default_session_price, monthly_fee, billing_due_day, preferred_payment_method, status, created_at")
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
      requires_invoice: patient.requires_invoice ?? false,
      billing_mode: patient.billing_mode ?? "per_session",
      default_session_price: patient.default_session_price == null ? "" : String(patient.default_session_price).replace(".", ","),
      monthly_fee: patient.monthly_fee == null ? "" : String(patient.monthly_fee).replace(".", ","),
      billing_due_day: patient.billing_due_day == null ? "" : String(patient.billing_due_day),
      preferred_payment_method: patient.preferred_payment_method ?? "",
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

    const parseOptionalAmount = (value: string) => value.trim() ? Number(value.trim().replace(/\./g, "").replace(",", ".")) : null;
    const defaultPrice = parseOptionalAmount(form.default_session_price);
    const monthlyFee = parseOptionalAmount(form.monthly_fee);
    if ((defaultPrice !== null && (!Number.isFinite(defaultPrice) || defaultPrice < 0)) ||
        (form.billing_mode === "monthly" && (monthlyFee === null || !Number.isFinite(monthlyFee) || monthlyFee <= 0 || !form.billing_due_day || Number(form.billing_due_day) < 1 || Number(form.billing_due_day) > 28))) {
      setErrorMessage("Confira os valores financeiros e, na cobrança mensal, informe uma mensalidade positiva e vencimento entre 1 e 28.");
      setSaving(false);
      return;
    }

    const payload = {
      full_name: form.full_name.trim(),
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      requires_invoice: form.requires_invoice,
      billing_mode: form.billing_mode,
      default_session_price: form.default_session_price.trim() ? Number(form.default_session_price.trim().replace(/\./g, "").replace(",", ".")) : null,
      monthly_fee: form.billing_mode === "monthly" && form.monthly_fee.trim() ? Number(form.monthly_fee.trim().replace(/\./g, "").replace(",", ".")) : null,
      billing_due_day: form.billing_mode === "monthly" && form.billing_due_day ? Number(form.billing_due_day) : null,
      preferred_payment_method: form.preferred_payment_method || null,
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
        <Link className="auth-brand" href="/" aria-label="MenteHub início">
          <span className="auth-brand-mark"><Users size={19} /></span>
          <span><strong>mentehub</strong><small>seu consultório em harmonia</small></span>
        </Link>
        <div className="patients-account">
          <span>{userEmail}</span>
          <button type="button" className="patients-quiet-button" onClick={signOut}><LogOut size={15} /> Sair</button>
        </div>
      </header>

      <section className="patients-content">
        <Link className="patients-back" href="/"><ArrowLeft size={15} /> Visão geral</Link>
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
                <label htmlFor="patient-requires-invoice">Emissão de nota fiscal</label>
                <select id="patient-requires-invoice" value={form.requires_invoice ? "yes" : "no"} onChange={(event) => setForm({ ...form, requires_invoice: event.target.value === "yes" })}>
                  <option value="no">Não é necessário</option>
                  <option value="yes">Precisa emitir nota fiscal</option>
                </select>
              </div>
              <div className="patient-field">
                <label htmlFor="patient-billing-mode">Modalidade de cobrança</label>
                <select id="patient-billing-mode" value={form.billing_mode} onChange={(event) => setForm({ ...form, billing_mode: event.target.value as PatientForm["billing_mode"] })}>
                  <option value="per_session">Por sessão</option>
                  <option value="monthly">Mensal (valor fixo)</option>
                </select>
              </div>
              <div className="patient-field">
                <label htmlFor="patient-session-price">Valor padrão por sessão (R$)</label>
                <input id="patient-session-price" inputMode="decimal" placeholder="150,00" value={form.default_session_price} onChange={(event) => setForm({ ...form, default_session_price: event.target.value })} />
              </div>
              {form.billing_mode === "monthly" && <>
                <div className="patient-field">
                  <label htmlFor="patient-monthly-fee">Mensalidade (R$) *</label>
                  <input id="patient-monthly-fee" inputMode="decimal" placeholder="600,00" value={form.monthly_fee} onChange={(event) => setForm({ ...form, monthly_fee: event.target.value })} required />
                </div>
                <div className="patient-field">
                  <label htmlFor="patient-billing-due-day">Dia de vencimento (1–28) *</label>
                  <input id="patient-billing-due-day" type="number" min="1" max="28" value={form.billing_due_day} onChange={(event) => setForm({ ...form, billing_due_day: event.target.value })} required />
                </div>
              </>}
              <div className="patient-field">
                <label htmlFor="patient-preferred-payment">Forma de pagamento preferida</label>
                <select id="patient-preferred-payment" value={form.preferred_payment_method} onChange={(event) => setForm({ ...form, preferred_payment_method: event.target.value as PatientForm["preferred_payment_method"] })}>
                  <option value="">Não informada</option>
                  <option value="pix">Pix</option><option value="cash">Dinheiro</option><option value="credit_card">Cartão de crédito</option><option value="debit_card">Cartão de débito</option><option value="bank_transfer">Transferência</option><option value="other">Outro</option>
                </select>
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
                <thead><tr><th>Nome</th><th>Contato</th><th>Cobrança</th><th>Nota fiscal</th><th>Situação</th><th aria-label="Ações"></th></tr></thead>
                <tbody>
                  {filteredPatients.map((patient) => (
                    <tr key={patient.id}>
                      <td><strong>{patient.full_name}</strong></td>
                      <td><span>{patient.email || "—"}</span><small>{patient.phone || ""}</small></td>
                      <td><span className="patient-status">{patient.billing_mode === "monthly" ? "Mensal · " + Number(patient.monthly_fee ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "Por sessão" + (patient.default_session_price != null ? " · " + Number(patient.default_session_price).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "")}</span></td>
                      <td><span className={patient.requires_invoice ? "patient-status patient-status-active" : "patient-status"}>{patient.requires_invoice ? "Emitir nota" : "Não necessária"}</span></td>
                      <td><span className={patient.status === "active" ? "patient-status patient-status-active" : "patient-status"}>{patient.status === "active" ? "Ativo" : "Inativo"}</span></td>
                      <td><div className="patient-row-actions"><Link href={`/pacientes/${patient.id}/prontuario`} className="patients-icon-button" aria-label={`Abrir prontuário de ${patient.full_name}`} title="Prontuário"><BookOpenText size={15} /></Link><button type="button" className="patients-icon-button" onClick={() => startEdit(patient)} aria-label={`Editar ${patient.full_name}`}><Pencil size={15} /></button><button type="button" className="patients-icon-button patients-delete-button" onClick={() => void deletePatient(patient)} aria-label={`Excluir ${patient.full_name}`}><Trash2 size={15} /></button></div></td>
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
