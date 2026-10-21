"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, CreditCard, Download, LogOut, Pencil, Plus, RefreshCw, Trash2, TrendingDown, TrendingUp, Wallet, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Kind = "income" | "expense";
type Status = "pending" | "paid" | "cancelled";
type PaymentMethod = "pix" | "cash" | "credit_card" | "debit_card" | "bank_transfer" | "other";
type Patient = { id: string; full_name: string };
type Transaction = {
  id: string; patient_id: string | null; appointment_id: string | null; kind: Kind;
  category: string; description: string; amount: number | string; status: Status;
  due_date: string | null; paid_at: string | null; payment_method: PaymentMethod | null;
  created_at: string; updated_at: string;
};
type FormData = {
  kind: Kind; patient_id: string; category: string; description: string;
  amount: string; status: Status; due_date: string; payment_method: PaymentMethod | "";
};
const emptyForm = (date: string): FormData => ({
  kind: "income", patient_id: "", category: "Consulta", description: "",
  amount: "", status: "pending", due_date: date, payment_method: "",
});
const kindLabels: Record<Kind, string> = { income: "Receita", expense: "Despesa" };
const statusLabels: Record<Status, string> = { pending: "Pendente", paid: "Pago/recebido", cancelled: "Cancelado" };
const methodLabels: Record<PaymentMethod, string> = {
  pix: "Pix", cash: "Dinheiro", credit_card: "Cartão de crédito",
  debit_card: "Cartão de débito", bank_transfer: "Transferência", other: "Outro",
};
const money = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
function parseMoney(value: string) { const normalized = value.trim().includes(",") ? value.trim().replace(/\\./g, "").replace(",", ".") : value.trim(); return Number(normalized); }
const dateKey = (date: Date) => [date.getFullYear(), String(date.getMonth()+1).padStart(2,"0"), String(date.getDate()).padStart(2,"0")].join("-");
const monthKey = (value: string) => value.slice(0, 7);
const today = () => dateKey(new Date());
const escapeCsv = (value: unknown) => '"' + String(value ?? "").replace(/"/g, '""') + '"';

export default function FinancialClient({ userEmail }: { userEmail: string }) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [month, setMonth] = useState(() => monthKey(today()));
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [form, setForm] = useState<FormData>(() => emptyForm(today()));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [notice, setNotice] = useState("");
  const [kindFilter, setKindFilter] = useState<"all" | Kind>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | Status>("all");

  const loadData = useCallback(async () => {
    setLoading(true); setErrorMessage("");
    const [year, monthNumber] = month.split("-").map(Number);
    const start = new Date(year, monthNumber - 1, 1);
    const end = new Date(year, monthNumber, 1);
    const startIso = start.toISOString();
    const endIso = end.toISOString();
    const firstDay = dateKey(start);
    const nextMonthDay = dateKey(end);
    const [transactionResult, patientResult] = await Promise.all([
      supabase.from("financial_transactions")
        .select("id, patient_id, appointment_id, kind, category, description, amount, status, due_date, paid_at, payment_method, created_at, updated_at")
        .or(`and(due_date.gte.${firstDay},due_date.lt.${nextMonthDay}),and(due_date.is.null,created_at.gte.${startIso},created_at.lt.${endIso})`)
        .order("due_date", { ascending: true, nullsFirst: false }).order("created_at", { ascending: false }),
      supabase.from("patients").select("id, full_name").eq("status", "active").order("full_name"),
    ]);
    if (transactionResult.error || patientResult.error) {
      console.error("MenteHub financeiro: falha ao carregar dados", { transaction: transactionResult.error, patients: patientResult.error });
      setTransactions([]); setPatients([]);
      setErrorMessage("Não foi possível carregar o financeiro. Confira se a tabela financial_transactions existe e se as permissões do Supabase estão configuradas.");
    } else {
      setTransactions((transactionResult.data ?? []) as Transaction[]);
      setPatients((patientResult.data ?? []) as Patient[]);
    }
    setLoading(false);
  }, [month, supabase]);

  useEffect(() => { void loadData(); }, [loadData]);

  const patientNames = useMemo(() => new Map(patients.map((p) => [p.id, p.full_name])), [patients]);
  const visibleTransactions = useMemo(() => transactions.filter((item) =>
    (kindFilter === "all" || item.kind === kindFilter) && (statusFilter === "all" || item.status === statusFilter)
  ), [transactions, kindFilter, statusFilter]);
  const totals = useMemo(() => {
    const sum = (kind: Kind, status: Status) => transactions
      .filter((item) => item.kind === kind && item.status === status)
      .reduce((acc, item) => acc + Number(item.amount), 0);
    const received = sum("income", "paid");
    const pending = sum("income", "pending");
    const expenses = sum("expense", "paid");
    return { received, pending, expenses, balance: received - expenses };
  }, [transactions]);

  function startCreate(kind: Kind = "income") {
    setEditingId(null);
    setForm({ ...emptyForm(today()), kind, due_date: today() });
    setErrorMessage(""); setNotice(""); setShowForm(true);
  }
  function startEdit(item: Transaction) {
    setEditingId(item.id);
    setForm({
      kind: item.kind, patient_id: item.patient_id ?? "", category: item.category,
      description: item.description, amount: String(item.amount).replace(".", ","),
      status: item.status, due_date: item.due_date ?? item.created_at.slice(0,10),
      payment_method: item.payment_method ?? "",
    });
    setErrorMessage(""); setNotice(""); setShowForm(true);
  }
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setErrorMessage(""); setNotice("");
    const amount = Number(form.amount.trim().replace(/\./g, "").replace(",", "."));
    if (!form.category.trim() || !form.description.trim() || !Number.isFinite(amount) || amount <= 0) {
      setErrorMessage("Preencha categoria, descrição e um valor maior que zero."); setSaving(false); return;
    }
    const payload = {
      kind: form.kind, patient_id: form.patient_id || null, appointment_id: null,
      category: form.category.trim(), description: form.description.trim(), amount,
      status: form.status, due_date: form.due_date || null,
      paid_at: form.status === "paid" ? new Date().toISOString() : null,
      payment_method: form.payment_method || null,
    };
    try {
      const result = editingId
        ? await supabase.from("financial_transactions").update(payload).eq("id", editingId).select("id").maybeSingle()
        : await supabase.from("financial_transactions").insert(payload).select("id").single();
      if (result.error) throw result.error;
      if (!result.data) throw new Error("Lançamento não encontrado ou sem permissão para alterá-lo.");
      setShowForm(false); setEditingId(null);
      setNotice(editingId ? "Lançamento atualizado." : "Lançamento registrado.");
      setMonth(monthKey(form.due_date || today()));
      await loadData();
    } catch (error) {
      console.error("MenteHub financeiro: falha ao salvar lançamento", error);
      setErrorMessage(error instanceof Error ? error.message : "Não foi possível salvar o lançamento.");
    } finally { setSaving(false); }
  }
  async function updateStatus(item: Transaction, status: Status) {
    setErrorMessage(""); setNotice("");
    const { data, error } = await supabase.from("financial_transactions")
      .update({ status, paid_at: status === "paid" ? new Date().toISOString() : null })
      .eq("id", item.id).select("id").maybeSingle();
    if (error || !data) {
      console.error("MenteHub financeiro: falha ao atualizar status", error);
      setErrorMessage("Não foi possível atualizar o lançamento. Confira as permissões do Supabase.");
      return;
    }
    setNotice(status === "paid" ? "Lançamento marcado como pago/recebido." : status === "cancelled" ? "Lançamento cancelado." : "Lançamento marcado como pendente.");
    await loadData();
  }
  async function deleteTransaction(item: Transaction) {
    if (!window.confirm(`Excluir o lançamento “${item.description}”? Esta ação não pode ser desfeita.`)) return;
    const { data, error } = await supabase.from("financial_transactions").delete().eq("id", item.id).select("id").maybeSingle();
    if (error || !data) { setErrorMessage("Não foi possível excluir o lançamento."); return; }
    setNotice("Lançamento excluído."); await loadData();
  }
  function exportCsv() {
    const header = ["Tipo","Descrição","Categoria","Paciente","Valor","Status","Vencimento","Forma de pagamento"];
    const rows = visibleTransactions.map((item) => [
      kindLabels[item.kind], item.description, item.category, patientNames.get(item.patient_id ?? "") ?? "",
      Number(item.amount).toFixed(2).replace(".", ","), statusLabels[item.status],
      item.due_date ?? item.created_at.slice(0,10), item.payment_method ? methodLabels[item.payment_method] : "",
    ]);
    const csv = "\uFEFF" + [header, ...rows].map((row) => row.map(escapeCsv).join(";")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const link = document.createElement("a"); link.href = url; link.download = `mentehub-financeiro-${month}.csv`;
    document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
  }
  async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) { setErrorMessage("Não foi possível encerrar a sessão."); return; }
    router.replace("/login"); router.refresh();
  }

  return <main className="patients-page">
    <header className="patients-topbar">
      <Link className="auth-brand" href="/" aria-label="MenteHub início"><span className="auth-brand-mark"><Wallet size={19}/></span><span><strong>mentehub</strong><small>seu consultório em harmonia</small></span></Link>
      <div className="patients-account"><span>{userEmail}</span><button type="button" className="patients-quiet-button" onClick={signOut}><LogOut size={15}/> Sair</button></div>
    </header>
    <section className="patients-content">
      <Link className="patients-back" href="/"><ArrowLeft size={15}/> Visão geral</Link>
      <div className="patients-heading">
        <div><p className="auth-eyebrow">GESTÃO DO CONSULTÓRIO</p><h1>Financeiro</h1><p className="auth-description">Acompanhe receitas, despesas, pendências e saldo dos seus lançamentos.</p></div>
        <div className="finance-actions"><button type="button" className="button button-secondary" onClick={exportCsv} disabled={visibleTransactions.length===0}><Download size={16}/> Exportar CSV</button><button type="button" className="button button-primary" onClick={() => startCreate("income")}><Plus size={16}/> Novo lançamento</button></div>
      </div>
      <div className="finance-toolbar"><label>Mês de referência<input type="month" value={month} onChange={(e)=>setMonth(e.target.value)}/></label><button type="button" className="patients-quiet-button" onClick={()=>void loadData()}><RefreshCw size={15}/> Atualizar</button></div>
      {notice && <div className="patients-notice" role="status">{notice}<button type="button" onClick={()=>setNotice("")} aria-label="Fechar aviso"><X size={15}/></button></div>}
      {errorMessage && <div className="patients-error" role="alert">{errorMessage}</div>}
      <div className="finance-summary">
        <article className="finance-stat"><span><TrendingUp size={17}/> Recebido no mês</span><strong>{money(totals.received)}</strong><small>Receitas marcadas como pagas</small></article>
        <article className="finance-stat"><span><CreditCard size={17}/> A receber</span><strong>{money(totals.pending)}</strong><small>Receitas ainda pendentes</small></article>
        <article className="finance-stat"><span><TrendingDown size={17}/> Despesas pagas</span><strong>{money(totals.expenses)}</strong><small>Despesas marcadas como pagas</small></article>
        <article className="finance-stat finance-balance"><span><Wallet size={17}/> Saldo realizado</span><strong>{money(totals.balance)}</strong><small>Recebido menos despesas pagas</small></article>
      </div>
      <div className="finance-list-heading"><div><h2>Lançamentos</h2><p>{visibleTransactions.length} registro(s) neste filtro</p></div><div className="finance-filters"><label>Tipo<select value={kindFilter} onChange={(e)=>setKindFilter(e.target.value as "all" | Kind)}><option value="all">Todos</option><option value="income">Receitas</option><option value="expense">Despesas</option></select></label><label>Status<select value={statusFilter} onChange={(e)=>setStatusFilter(e.target.value as "all" | Status)}><option value="all">Todos</option><option value="pending">Pendente</option><option value="paid">Pago/recebido</option><option value="cancelled">Cancelado</option></select></label></div></div>
      {showForm && <form className="patient-form-card" onSubmit={handleSubmit}>
        <div className="patient-form-heading"><h2>{editingId ? "Editar lançamento" : "Novo lançamento"}</h2><button type="button" className="patients-icon-button" onClick={()=>setShowForm(false)} aria-label="Fechar formulário"><X size={17}/></button></div>
        <div className="patient-form-grid">
          <div className="patient-field"><label htmlFor="finance-kind">Tipo</label><select id="finance-kind" value={form.kind} onChange={(e)=>setForm({...form,kind:e.target.value as Kind,category:e.target.value==="income"?"Consulta":"Despesa"})}><option value="income">Receita</option><option value="expense">Despesa</option></select></div>
          <div className="patient-field"><label htmlFor="finance-status">Status</label><select id="finance-status" value={form.status} onChange={(e)=>setForm({...form,status:e.target.value as Status})}><option value="pending">Pendente</option><option value="paid">Pago/recebido</option><option value="cancelled">Cancelado</option></select></div>
          <div className="patient-field"><label htmlFor="finance-category">Categoria</label><input id="finance-category" value={form.category} maxLength={80} onChange={(e)=>setForm({...form,category:e.target.value})} required/></div>
          <div className="patient-field"><label htmlFor="finance-description">Descrição</label><input id="finance-description" value={form.description} maxLength={180} onChange={(e)=>setForm({...form,description:e.target.value})} required/></div>
          <div className="patient-field"><label htmlFor="finance-amount">Valor (R$)</label><input id="finance-amount" inputMode="decimal" placeholder="150,00" value={form.amount} onChange={(e)=>setForm({...form,amount:e.target.value})} required/></div>
          <div className="patient-field"><label htmlFor="finance-date">Vencimento / data</label><input id="finance-date" type="date" value={form.due_date} onChange={(e)=>setForm({...form,due_date:e.target.value})}/></div>
          <div className="patient-field"><label htmlFor="finance-patient">Paciente (opcional)</label><select id="finance-patient" value={form.patient_id} onChange={(e)=>setForm({...form,patient_id:e.target.value})}><option value="">Sem paciente vinculado</option>{patients.map((p)=><option key={p.id} value={p.id}>{p.full_name}</option>)}</select></div>
          <div className="patient-field"><label htmlFor="finance-method">Forma de pagamento</label><select id="finance-method" value={form.payment_method} onChange={(e)=>setForm({...form,payment_method:e.target.value as PaymentMethod | ""})}><option value="">Não informada</option>{(Object.keys(methodLabels) as PaymentMethod[]).map((method)=><option key={method} value={method}>{methodLabels[method]}</option>)}</select></div>
        </div>
        <div className="patient-form-actions"><button type="button" className="button button-secondary" onClick={()=>setShowForm(false)}>Cancelar</button><button type="submit" className="button button-primary" disabled={saving}>{saving?"Salvando…":editingId?"Salvar alterações":"Registrar lançamento"}</button></div>
      </form>}
      <section className="finance-table-wrap">
        {loading ? <p className="finance-empty">Carregando lançamentos…</p> : visibleTransactions.length===0 ? <div className="finance-empty"><Wallet size={28}/><strong>Nenhum lançamento encontrado</strong><span>Registre uma receita ou despesa para começar, ou altere o mês/filtros.</span><button className="button button-primary" onClick={()=>startCreate("income")}><Plus size={15}/> Registrar primeira receita</button></div> :
        <div className="finance-table-scroll"><table className="finance-table"><thead><tr><th>Descrição</th><th>Tipo</th><th>Paciente</th><th>Data</th><th>Valor</th><th>Status</th><th>Ações</th></tr></thead><tbody>
          {visibleTransactions.map((item)=><tr key={item.id}><td><strong>{item.description}</strong><small>{item.category}{item.payment_method ? " · "+methodLabels[item.payment_method] : ""}</small></td><td><span className={item.kind==="income"?"finance-kind income":"finance-kind expense"}>{kindLabels[item.kind]}</span></td><td>{patientNames.get(item.patient_id ?? "") ?? "—"}</td><td>{(item.due_date ?? item.created_at.slice(0,10)).split("-").reverse().join("/")}</td><td className="finance-amount">{money(Number(item.amount))}</td><td><span className={"finance-status "+item.status}>{statusLabels[item.status]}</span></td><td><div className="finance-row-actions"><button type="button" title="Editar" aria-label={"Editar "+item.description} onClick={()=>startEdit(item)}><Pencil size={15}/></button>{item.status!=="paid" && item.status!=="cancelled" && <button type="button" title="Marcar pago/recebido" aria-label={"Marcar pago "+item.description} onClick={()=>void updateStatus(item,"paid")}><CheckCircle2 size={15}/></button>}{item.status!=="cancelled" && <button type="button" title="Cancelar lançamento" aria-label={"Cancelar "+item.description} onClick={()=>void updateStatus(item,"cancelled")}><X size={15}/></button>}<button type="button" title="Excluir" aria-label={"Excluir "+item.description} onClick={()=>void deleteTransaction(item)}><Trash2 size={15}/></button></div></td></tr>)}
        </tbody></table></div>}
      </section>
      <p className="finance-disclaimer">Controle administrativo. Confira os lançamentos com seus comprovantes; os valores apresentados não substituem a conciliação bancária ou a orientação contábil.</p>
    </section>
  </main>;
}
