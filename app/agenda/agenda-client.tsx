"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CalendarDays, ChevronLeft, ChevronRight, Clock3, LogOut, Plus, Users, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Patient = { id: string; full_name: string; status: "active" | "inactive" };
type AppointmentStatus = "scheduled" | "confirmed" | "completed" | "cancelled" | "no_show";
type Appointment = {
  id: string;
  patient_id: string | null;
  title: string;
  starts_at: string;
  duration_minutes: number;
  status: AppointmentStatus;
  price: number | string;
};
type AppointmentForm = {
  patient_id: string;
  title: string;
  date: string;
  time: string;
  duration_minutes: string;
  price: string;
};
const statusLabels: Record<AppointmentStatus, string> = {
  scheduled: "Agendada", confirmed: "Confirmada", completed: "Realizada",
  cancelled: "Cancelada", no_show: "Não compareceu",
};
const initialForm = (date: string): AppointmentForm => ({
  patient_id: "", title: "Consulta", date, time: "14:00", duration_minutes: "50", price: "0",
});
function dateKey(date: Date) {
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
}
function shiftDate(date: string, days: number) {
  const [year, month, day] = date.split("-").map(Number);
  const result = new Date(year, month - 1, day);
  result.setDate(result.getDate() + days);
  return dateKey(result);
}
function money(value: number | string) {
  return Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function AgendaClient({ userEmail }: { userEmail: string }) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [selectedDate, setSelectedDate] = useState(() => dateKey(new Date()));
  const [dateReady, setDateReady] = useState(false);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [form, setForm] = useState<AppointmentForm>(() => initialForm(dateKey(new Date())));
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [notice, setNotice] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setErrorMessage("");
    const [patientResult, appointmentResult] = await Promise.all([
      supabase.from("patients").select("id, full_name, status").eq("status", "active").order("full_name"),
      (() => {
        const [year, month, day] = selectedDate.split("-").map(Number);
        const start = new Date(year, month - 1, day);
        const end = new Date(year, month - 1, day + 1);
        return supabase.from("appointments")
          .select("id, patient_id, title, starts_at, duration_minutes, status, price")
          .gte("starts_at", start.toISOString()).lt("starts_at", end.toISOString())
          .order("starts_at", { ascending: true });
      })(),
    ]);
    if (patientResult.error || appointmentResult.error) {
      setErrorMessage("Não foi possível carregar a agenda. Confira a conexão e as permissões do Supabase.");
      setPatients([]);
      setAppointments([]);
    } else {
      setPatients((patientResult.data ?? []) as Patient[]);
      setAppointments((appointmentResult.data ?? []) as Appointment[]);
    }
    setLoading(false);
  }, [selectedDate, supabase]);

  useEffect(() => {
    const savedDate = window.localStorage.getItem("mentehub-agenda-selected-date");
    if (savedDate && /^\\d{4}-\\d{2}-\\d{2}$/.test(savedDate)) {
      setSelectedDate(savedDate);
    }
    setDateReady(true);
  }, []);

  useEffect(() => {
    if (!dateReady) return;
    window.localStorage.setItem("mentehub-agenda-selected-date", selectedDate);
  }, [dateReady, selectedDate]);

  useEffect(() => {
    if (dateReady) void loadData();
  }, [dateReady, loadData]);

  function openForm() {
    setForm(initialForm(selectedDate));
    setErrorMessage("");
    setNotice("");
    setShowForm(true);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setErrorMessage("");
    setNotice("");
    const start = new Date(`${form.date}T${form.time}:00`);
    const duration = Number(form.duration_minutes);
    const price = Number(form.price.replace(",", "."));
    if (Number.isNaN(start.getTime()) || !Number.isInteger(duration) || duration < 10 || duration > 240 || !Number.isFinite(price) || price < 0) {
      setErrorMessage("Confira a data, o horário, a duração (10 a 240 minutos) e o valor.");
      setSaving(false);
      return;
    }
    try {
      const { error } = await supabase.from("appointments").insert({
        patient_id: form.patient_id || null,
        title: form.title.trim() || "Consulta",
        starts_at: start.toISOString(),
        duration_minutes: duration,
        price,
      });
      if (error) throw error;
      setShowForm(false);
      setNotice("Consulta agendada.");
      setSelectedDate(form.date);
      if (form.date === selectedDate) await loadData();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Não foi possível salvar a consulta.");
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(appointment: Appointment, status: AppointmentStatus) {
    setUpdatingId(appointment.id);
    setErrorMessage("");
    setNotice("");
    const { data, error } = await supabase.from("appointments").update({ status }).eq("id", appointment.id).select("id").maybeSingle();
    if (error || !data) {
      setErrorMessage("Não foi possível atualizar o status da consulta.");
    } else {
      setAppointments((current) => current.map((item) => item.id === appointment.id ? { ...item, status } : item));
      setNotice("Status atualizado.");
    }
    setUpdatingId(null);
  }

  async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) { setErrorMessage("Não foi possível encerrar a sessão."); return; }
    router.replace("/login");
    router.refresh();
  }

  const activePatients = useMemo(() => new Map(patients.map((patient) => [patient.id, patient.full_name])), [patients]);
  const dateLabel = useMemo(() => {
    const [year, month, day] = selectedDate.split("-").map(Number);
    return new Date(year, month - 1, day).toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  }, [selectedDate]);

  return (
    <main className="patients-page">
      <header className="patients-topbar">
        <Link className="auth-brand" href="/" aria-label="MenteHub início">
          <span className="auth-brand-mark"><CalendarDays size={19} /></span>
          <span><strong>mentehub</strong><small>seu consultório em harmonia</small></span>
        </Link>
        <div className="patients-account"><span>{userEmail}</span><button type="button" className="patients-quiet-button" onClick={signOut}><LogOut size={15} /> Sair</button></div>
      </header>
      <section className="patients-content">
        <Link className="patients-back" href="/"><ArrowLeft size={15} /> Visão geral</Link>
        <div className="patients-heading">
          <div><p className="auth-eyebrow">ROTINA DO CONSULTÓRIO</p><h1>Agenda</h1><p className="auth-description">Organize consultas e acompanhe os horários do seu consultório.</p></div>
          <button type="button" className="button button-primary" onClick={openForm}><Plus size={16} /> Agendar consulta</button>
        </div>
        <section className="agenda-day-card">
          <div className="agenda-day-nav">
            <button type="button" className="patients-icon-button" aria-label="Dia anterior" onClick={() => setSelectedDate((date) => shiftDate(date, -1))}><ChevronLeft size={17} /></button>
            <div><strong>{dateLabel}</strong><small>{appointments.length} {appointments.length === 1 ? "consulta" : "consultas"}</small></div>
            <button type="button" className="patients-icon-button" aria-label="Próximo dia" onClick={() => setSelectedDate((date) => shiftDate(date, 1))}><ChevronRight size={17} /></button>
            <input className="agenda-date-input" type="date" aria-label="Escolher data da agenda" value={selectedDate} onChange={(event) => event.target.value && setSelectedDate(event.target.value)} />
            <button type="button" className="patients-quiet-button" onClick={() => setSelectedDate(dateKey(new Date()))}>Hoje</button>
          </div>
        </section>

        {notice && <div className="patients-notice" role="status">{notice}<button type="button" onClick={() => setNotice("")} aria-label="Fechar aviso"><X size={15} /></button></div>}
        {errorMessage && <div className="patients-error" role="alert">{errorMessage}</div>}

        {showForm && <form className="patient-form-card" onSubmit={handleSubmit}>
          <div className="patient-form-heading"><h2>Nova consulta</h2><button type="button" className="patients-icon-button" onClick={() => setShowForm(false)} aria-label="Fechar formulário"><X size={17} /></button></div>
          <div className="patient-form-grid">
            <div className="patient-field patient-field-wide"><label htmlFor="appointment-title">Título</label><input id="appointment-title" maxLength={120} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required /></div>
            <div className="patient-field patient-field-wide"><label htmlFor="appointment-patient">Paciente (opcional)</label><select id="appointment-patient" value={form.patient_id} onChange={(event) => setForm({ ...form, patient_id: event.target.value })}><option value="">Sem paciente vinculado</option>{patients.map((patient) => <option key={patient.id} value={patient.id}>{patient.full_name}</option>)}</select></div>
            <div className="patient-field"><label htmlFor="appointment-date">Data *</label><input id="appointment-date" type="date" required value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} /></div>
            <div className="patient-field"><label htmlFor="appointment-time">Horário *</label><input id="appointment-time" type="time" required value={form.time} onChange={(event) => setForm({ ...form, time: event.target.value })} /></div>
            <div className="patient-field"><label htmlFor="appointment-duration">Duração (minutos)</label><select id="appointment-duration" value={form.duration_minutes} onChange={(event) => setForm({ ...form, duration_minutes: event.target.value })}>{[30,40,45,50,60,75,90,120].map((minutes) => <option key={minutes} value={minutes}>{minutes} minutos</option>)}</select></div>
            <div className="patient-field"><label htmlFor="appointment-price">Valor previsto (R$)</label><input id="appointment-price" inputMode="decimal" value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value })} placeholder="0,00" /></div>
          </div>
          <p className="patient-privacy-note">Use a agenda para informações administrativas. Não registre diagnósticos, conteúdo de sessões ou prontuários aqui.</p>
          <div className="patient-form-actions"><button type="button" className="patients-quiet-button" onClick={() => setShowForm(false)}>Cancelar</button><button type="submit" className="button button-primary" disabled={saving}>{saving ? "Salvando…" : "Salvar consulta"}</button></div>
        </form>}

        <section className="patients-list-card">
          <div className="patients-list-heading"><div><h2>Consultas do dia</h2><p>Ordenadas por horário</p></div></div>
          {loading ? <p className="patients-empty">Carregando agenda…</p> : appointments.length === 0 ? <div className="patients-empty"><span className="patients-empty-icon"><CalendarDays size={21} /></span><strong>Nenhuma consulta neste dia</strong><p>Você pode navegar para outra data ou criar um novo agendamento.</p><button type="button" className="button button-primary" onClick={openForm}><Plus size={15} /> Agendar consulta</button></div> : <div className="agenda-appointments">
            {appointments.map((appointment) => <article className="agenda-appointment" key={appointment.id}>
              <div className="agenda-appointment-time"><strong>{new Date(appointment.starts_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</strong><small><Clock3 size={12} /> {appointment.duration_minutes} min</small></div>
              <div className="agenda-appointment-main"><strong>{appointment.title}</strong><span><Users size={13} /> {appointment.patient_id ? activePatients.get(appointment.patient_id) ?? "Paciente vinculado" : "Sem paciente vinculado"}</span><small>{money(appointment.price)}</small></div>
              <div className="agenda-appointment-controls"><span className={"patient-status agenda-status agenda-status-" + appointment.status}>{statusLabels[appointment.status]}</span><select aria-label={"Status da consulta " + appointment.title} value={appointment.status} disabled={updatingId === appointment.id} onChange={(event) => void updateStatus(appointment, event.target.value as AppointmentStatus)}>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
            </article>)}
          </div>}
        </section>
        <p className="patients-footer">MenteHub · Agenda privada da conta autenticada.</p>
      </section>
    </main>
  );
}
