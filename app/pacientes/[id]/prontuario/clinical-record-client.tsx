"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, BookOpenText, CalendarDays, Download, FileText, History, LogOut, Mic, MicOff, Plus, Printer, Save, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";


type SpeechAlternative = { transcript: string };
type SpeechResult = { isFinal: boolean; [index: number]: SpeechAlternative };
type SpeechEvent = { resultIndex: number; results: ArrayLike<SpeechResult> };
type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechEvent) => void) | null;
  onstart: (() => void) | null;
  onnomatch: (() => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};
type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;
declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

type AnamnesisData = {
  birthDate: string;
  education: string;
  emergencyContact: string;
  address: string;
  profession: string;
  referral: string;
  responsibleTherapist: string;
  professionalCouncil: string;
  initialComplaint: string;
  currentHistory: string;
  personalHistory: string;
  familySocialHistory: string;
  healthHistory: string;
  medications: string;
  goals: string;
  observations: string;
};

const emptyAnamnesis: AnamnesisData = {
  birthDate: "",
  education: "",
  emergencyContact: "",
  address: "",
  profession: "",
  referral: "",
  responsibleTherapist: "",
  professionalCouncil: "",
  initialComplaint: "",
  currentHistory: "",
  personalHistory: "",
  familySocialHistory: "",
  healthHistory: "",
  medications: "",
  goals: "",
  observations: "",
};

type ClinicalNote = {
  id: string;
  patient_id: string;
  appointment_id: string | null;
  content: string;
  created_at: string;
  updated_at: string;
};

type Appointment = {
  id: string;
  starts_at: string;
  title: string;
  status: string;
};

type Revision = {
  id: string;
  action: "created" | "updated";
  content_snapshot: string;
  appointment_id_snapshot: string | null;
  changed_at: string;
};

type AnamnesisRevision = {
  id: string;
  action: "created" | "updated";
  data_snapshot: Partial<AnamnesisData>;
  changed_by: string;
  changed_at: string;
};

const anamnesisLabels: Record<keyof AnamnesisData, string> = {
  birthDate: "Data de nascimento",
  education: "Escolaridade",
  emergencyContact: "Contato emergencial",
  address: "Endereço",
  profession: "Profissão",
  referral: "Encaminhamento",
  responsibleTherapist: "Terapeuta responsável",
  professionalCouncil: "Conselho de classe",
  initialComplaint: "Demanda / queixa inicial",
  currentHistory: "História da demanda atual",
  personalHistory: "História pessoal e desenvolvimento",
  familySocialHistory: "História familiar, relações e contexto social",
  healthHistory: "Saúde geral e histórico relevante",
  medications: "Medicamentos informados",
  goals: "Expectativas e objetivos",
  observations: "Observações relevantes",
};

const statusLabels: Record<string, string> = {
  scheduled: "Agendada",
  confirmed: "Confirmada",
  completed: "Concluída",
  cancelled: "Cancelada",
  no_show: "Não compareceu",
};

function formatDate(value: string) {
  return new Date(value).toLocaleString("pt-BR", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatDictatedText(value: string): string {
  const punctuationCommands: Array<[RegExp, string]> = [
    [/\bponto e vírgula\b/gi, ";"],
    [/\bponto de interrogação\b/gi, "?"],
    [/\bponto de exclamação\b/gi, "!"],
    [/\bponto final\b/gi, "."],
    [/\bdois pontos\b/gi, ":"],
    [/\bvírgula\b/gi, ","],
    [/\bvirgula\b/gi, ","],
    [/\b(?:novo\s+)?parágrafo\b/gi, "\n\n"],
    [/\b(?:nova linha|quebra de linha)\b/gi, "\n"],
  ];

  let formatted = value;
  for (const [command, punctuation] of punctuationCommands) {
    formatted = formatted.replace(command, punctuation);
  }

  formatted = formatted
    .replace(/[ \t]+/g, " ")
    .replace(/[ \t]*([,;:!?])/g, "$1")
    .replace(/([,;:!?])(?=\S)/g, "$1 ")
    .replace(/[ \t]*([.!?])(?=\S)/g, "$1 ")
    .replace(/[ \t]*\n[ \t]*/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/([.!?])(?:[ \t]*[.!?])+/g, "$1")
    .trim();

  formatted = formatted.replace(/(^|[.!?]\s+|\n+)([a-zà-ÿ])/giu, (_, prefix: string, letter: string) =>
    prefix + letter.toLocaleUpperCase("pt-BR")
  );
  formatted = formatted.replace(/[,:;]+$/g, "").trimEnd();

  if (formatted && !/[.!?…]$/.test(formatted)) formatted += ".";
  return formatted;
}

export default function ClinicalRecordClient({
  patientId,
  patientName,
  userEmail,
  patientPhone,
}: {
  patientId: string;
  patientName: string;
  userEmail: string;
  patientPhone: string;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [notes, setNotes] = useState<ClinicalNote[]>([]);
  const [anamnesis, setAnamnesis] = useState<AnamnesisData>(emptyAnamnesis);
  const [anamnesisExists, setAnamnesisExists] = useState(false);
  const [loadingAnamnesis, setLoadingAnamnesis] = useState(true);
  const [savingAnamnesis, setSavingAnamnesis] = useState(false);
  const [anamnesisError, setAnamnesisError] = useState("");
  const [anamnesisRevisions, setAnamnesisRevisions] = useState<AnamnesisRevision[]>([]);
  const [loadingAnamnesisHistory, setLoadingAnamnesisHistory] = useState(false);
  const [showAnamnesisHistory, setShowAnamnesisHistory] = useState(false);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [revisions, setRevisions] = useState<Revision[]>([]);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [appointmentId, setAppointmentId] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [notice, setNotice] = useState("");
  const [dictating, setDictating] = useState(false);
  const [dictationMessage, setDictationMessage] = useState("");
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const userStoppedDictationRef = useRef(false);
  const dictationErrorRef = useRef(false);
  const dictationStartLengthRef = useRef(0);
  const dictationHasResultRef = useRef(false);
  const dictationLastResultAtRef = useRef(0);

  const loadNotes = useCallback(async () => {
    const { data, error } = await supabase
      .from("clinical_notes")
      .select("id, patient_id, appointment_id, content, created_at, updated_at")
      .eq("patient_id", patientId)
      .order("updated_at", { ascending: false });

    if (error) throw error;
    const loaded = (data ?? []) as ClinicalNote[];
    setNotes(loaded);
    setSelectedNoteId((current) => current && loaded.some((note) => note.id === current)
      ? current
      : loaded[0]?.id ?? null);
    return loaded;
  }, [patientId, supabase]);

  const loadHistory = useCallback(async (noteId: string) => {
    setLoadingHistory(true);
    const { data, error } = await supabase
      .from("clinical_note_revisions")
      .select("id, action, content_snapshot, appointment_id_snapshot, changed_at")
      .eq("clinical_note_id", noteId)
      .order("changed_at", { ascending: false });

    if (error) {
      setErrorMessage("Não foi possível carregar o histórico desta evolução.");
      setRevisions([]);
    } else {
      setRevisions((data ?? []) as Revision[]);
    }
    setLoadingHistory(false);
  }, [supabase]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setErrorMessage("");
    const [notesResult, appointmentsResult] = await Promise.all([
      supabase.from("clinical_notes")
        .select("id, patient_id, appointment_id, content, created_at, updated_at")
        .eq("patient_id", patientId)
        .order("updated_at", { ascending: false }),
      supabase.from("appointments")
        .select("id, starts_at, title, status")
        .eq("patient_id", patientId)
        .order("starts_at", { ascending: false })
        .limit(100),
    ]);

    if (notesResult.error) {
      setErrorMessage("Não foi possível carregar o prontuário. Confirme se a migração do Supabase foi aplicada e se suas permissões estão corretas.");
      setNotes([]);
    } else {
      const loaded = (notesResult.data ?? []) as ClinicalNote[];
      setNotes(loaded);
      setSelectedNoteId((current) => current && loaded.some((note) => note.id === current)
        ? current
        : loaded[0]?.id ?? null);
    }

    if (appointmentsResult.error) {
      setErrorMessage("Não foi possível carregar as consultas vinculadas a este paciente.");
      setAppointments([]);
    } else {
      setAppointments((appointmentsResult.data ?? []) as Appointment[]);
    }
    setLoading(false);
  }, [patientId, supabase]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const loadAnamnesisHistory = useCallback(async () => {
    setLoadingAnamnesisHistory(true);
    const { data, error } = await supabase
      .from("clinical_anamnesis_revisions")
      .select("id, action, data_snapshot, changed_by, changed_at")
      .eq("owner_id", (await supabase.auth.getUser()).data.user?.id ?? "")
      .eq("clinical_anamnesis_id", (await supabase.from("clinical_anamneses").select("id").eq("patient_id", patientId).maybeSingle()).data?.id ?? "")
      .order("changed_at", { ascending: false });
    if (error) {
      setAnamnesisError("Não foi possível carregar o histórico da anamnese. Confira as permissões e a migração do Supabase.");
      setAnamnesisRevisions([]);
    } else {
      setAnamnesisRevisions((data ?? []) as AnamnesisRevision[]);
    }
    setLoadingAnamnesisHistory(false);
  }, [patientId, supabase]);

  useEffect(() => {
    let active = true;
    async function loadAnamnesis() {
      setLoadingAnamnesis(true);
      setAnamnesisError("");
      const { data, error } = await supabase
        .from("clinical_anamneses")
        .select("data")
        .eq("patient_id", patientId)
        .maybeSingle();
      if (!active) return;
      if (error) {
        setAnamnesisError("Não foi possível carregar a anamnese. Confirme se a nova migração de anamnese foi aplicada no Supabase.");
      } else if (data?.data && typeof data.data === "object" && !Array.isArray(data.data)) {
        setAnamnesis({ ...emptyAnamnesis, ...(data.data as Partial<AnamnesisData>) });
        setAnamnesisExists(true);
      }
      setLoadingAnamnesis(false);
    }
    void loadAnamnesis();
    return () => { active = false; };
  }, [patientId, supabase]);

  useEffect(() => () => {
    recognitionRef.current?.stop();
  }, []);

  useEffect(() => {
    if (selectedNoteId && !showForm) void loadHistory(selectedNoteId);
    else setRevisions([]);
  }, [loadHistory, selectedNoteId, showForm]);

  const selectedNote = useMemo(
    () => notes.find((note) => note.id === selectedNoteId) ?? null,
    [notes, selectedNoteId],
  );

  function startNew() {
    setEditingId(null);
    setContent("");
    setAppointmentId("");
    setErrorMessage("");
    setNotice("");
    setDictationMessage("");
    setShowForm(true);
  }

  function startEdit(note: ClinicalNote) {
    setEditingId(note.id);
    setSelectedNoteId(note.id);
    setContent(note.content);
    setAppointmentId(note.appointment_id ?? "");
    setErrorMessage("");
    setNotice("");
    setDictationMessage("");
    setShowForm(true);
  }

  function toggleDictation() {
    if (dictating) {
      userStoppedDictationRef.current = true;
      recognitionRef.current?.stop();
      setDictationMessage("Finalizando o ditado e aplicando a pontuação…");
      return;
    }

    const SpeechRecognition = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!window.isSecureContext) {
      setDictationMessage("O ditado exige uma página segura (HTTPS). Abra o MenteHub pelo endereço oficial com https://.");
      return;
    }
    if (!SpeechRecognition) {
      setDictationMessage("Este navegador não disponibiliza a API de reconhecimento de fala. Atualize o Chrome/Edge ou digite a evolução.");
      return;
    }

    setDictationMessage("Solicitação enviada; aguardando o serviço de reconhecimento de voz…");
    userStoppedDictationRef.current = false;
    dictationErrorRef.current = false;
    dictationStartLengthRef.current = content.length;
    dictationHasResultRef.current = false;
    dictationLastResultAtRef.current = 0;
    let recognition: SpeechRecognitionLike;
    try {
      recognition = new SpeechRecognition();
    } catch {
      setDictationMessage("O navegador reconheceu a API, mas não conseguiu inicializar o serviço de voz. Atualize o navegador e tente novamente.");
      return;
    }
    recognition.lang = "pt-BR";
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.onstart = () => {
      setDictating(true);
      setDictationMessage("Ditado iniciado. Fale uma frase curta para testar.");
    };
    recognition.onresult = (event) => {
      const finalized: string[] = [];
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        if (result?.isFinal && result[0]?.transcript.trim()) finalized.push(result[0].transcript.trim());
      }
      if (finalized.length) {
        dictationHasResultRef.current = true;
        const transcript = finalized.join(" ");
        const now = Date.now();
        const pauseMs = dictationLastResultAtRef.current ? now - dictationLastResultAtRef.current : 0;
        dictationLastResultAtRef.current = now;
        const startsWithCommand = /^(?:vírgula|virgula|ponto final|ponto e vírgula|ponto de interrogação|ponto de exclamação|dois pontos|parágrafo|novo parágrafo|nova linha)\b/i.test(transcript);

        setContent((current) => {
          const dictatedSoFar = current.slice(dictationStartLengthRef.current);
          const hasPreviousDictation = Boolean(dictatedSoFar.trim());
          const endsWithPunctuation = /[.!?,;:]\s*$/.test(dictatedSoFar);
          let separator = current && !/\s$/.test(current) ? " " : "";

          if (hasPreviousDictation && !endsWithPunctuation && !startsWithCommand) {
            if (pauseMs >= 1200) separator = ". ";
            else if (pauseMs >= 550) separator = ", ";
          }
          const next = current + separator + transcript;
          return next.slice(0, 20000);
        });
        setDictationMessage("Transcrição recebida. Pausas longas serão tratadas como fim de frase; revise antes de salvar.");
      }
    };
    recognition.onnomatch = () => {
      setDictationMessage("O serviço foi iniciado, mas não reconheceu fala. Confira o microfone, fale perto dele e tente uma frase curta.");
    };
    recognition.onerror = (event) => {
      dictationErrorRef.current = true;
      setDictating(false);
      const messages: Record<string, string> = {
        "not-allowed": "Permissão de microfone/reconhecimento negada. Autorize o microfone nas permissões do site e tente novamente.",
        "service-not-allowed": "O navegador ou uma política de segurança bloqueou o serviço de reconhecimento de voz.",
        "audio-capture": "Não foi possível acessar o microfone. Confira se ele está conectado e se o Windows permite seu uso.",
        "network": "O serviço de reconhecimento falhou na conexão. Verifique a internet, VPN, proxy ou bloqueios de rede.",
        "no-speech": "Nenhuma fala foi detectada. Confira o microfone e tente falar uma frase curta após iniciar.",
        "language-not-supported": "O serviço não oferece reconhecimento em português do Brasil neste momento.",
        "aborted": "O reconhecimento foi interrompido. Clique em Ditar por voz para tentar novamente.",
      };
      setDictationMessage(messages[event.error] ?? `Falha de reconhecimento (código: ${event.error}). Verifique permissões, microfone e conexão e tente novamente.`);
    };
    recognition.onend = () => {
      setDictating(false);
      if (recognitionRef.current === recognition) recognitionRef.current = null;
      if (dictationErrorRef.current) return;

      if (dictationHasResultRef.current) {
        setContent((current) => {
          const prefix = current.slice(0, dictationStartLengthRef.current);
          const dictated = current.slice(dictationStartLengthRef.current);
          const formatted = formatDictatedText(dictated);
          const separator = prefix && formatted && !/\s$/.test(prefix) ? " " : "";
          return `${prefix}${separator}${formatted}`;
        });
        setDictationMessage("Ditado finalizado. A pontuação foi aplicada automaticamente; revise o texto antes de salvar.");
      } else if (userStoppedDictationRef.current) {
        setDictationMessage("Ditado encerrado, mas nenhum texto foi reconhecido. Confira o microfone e tente novamente.");
      }
    };
    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch (error) {
      recognitionRef.current = null;
      setDictating(false);
      const errorName = error instanceof Error ? error.name : "";
      setDictationMessage(errorName === "InvalidStateError"
        ? "O reconhecimento já estava em execução. Aguarde um instante e tente novamente."
        : "O navegador não conseguiu iniciar o reconhecimento. Verifique as permissões do site e tente novamente.");
    }
  }

  function updateAnamnesis(field: keyof AnamnesisData, value: string) {
    setAnamnesis((current) => ({ ...current, [field]: value }));
  }

  function calculateAge(birthDate: string) {
    if (!birthDate) return "—";
    const birth = new Date(`${birthDate}T12:00:00`);
    if (Number.isNaN(birth.getTime())) return "—";
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    if (today.getMonth() < birth.getMonth() || (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())) age -= 1;
    return age >= 0 ? `${age} anos` : "—";
  }

  async function handleSaveAnamnesis(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingAnamnesis(true);
    setAnamnesisError("");
    setNotice("");
    try {
      const { data, error } = await supabase
        .from("clinical_anamneses")
        .upsert({ patient_id: patientId, data: anamnesis }, { onConflict: "patient_id" })
        .select("id")
        .single();
      if (error) throw error;
      if (!data?.id) throw new Error("O banco não confirmou o salvamento da anamnese.");
      setAnamnesisExists(true);
      await loadAnamnesisHistory();
      setNotice("Anamnese salva. As versões anteriores ficam registradas no histórico.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      setAnamnesisError(message || "Não foi possível salvar a anamnese. Verifique a migração e as permissões no Supabase.");
    } finally {
      setSavingAnamnesis(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanContent = content.trim();
    if (!cleanContent) {
      setErrorMessage("Escreva a evolução antes de salvar.");
      return;
    }
    setSaving(true);
    setErrorMessage("");
    setNotice("");

    try {
      let savedId = editingId;
      if (editingId) {
        const { data, error } = await supabase
          .from("clinical_notes")
          .update({ content: cleanContent, appointment_id: appointmentId || null })
          .eq("id", editingId)
          .select("id")
          .maybeSingle();
        if (error) throw error;
        if (!data) throw new Error("Evolução não encontrada ou sem permissão para alterá-la.");
        savedId = data.id;
      } else {
        const { data, error } = await supabase
          .from("clinical_notes")
          .insert({ patient_id: patientId, appointment_id: appointmentId || null, content: cleanContent })
          .select("id")
          .single();
        if (error) throw error;
        savedId = data.id;
      }

      if (!savedId) throw new Error("Não foi possível confirmar o salvamento da evolução.");
      await loadNotes();
      setSelectedNoteId(savedId);
      setEditingId(null);
      setShowForm(false);
      setContent("");
      setAppointmentId("");
      setNotice(editingId ? "Evolução atualizada e registrada no histórico." : "Evolução salva e registrada no histórico.");
      await loadHistory(savedId);
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      setErrorMessage(message.includes("clinical_note_appointment_patient_mismatch")
        ? "A consulta selecionada não pertence a este paciente. Atualize a página e tente novamente."
        : message || "Não foi possível salvar a evolução.");
    } finally {
      setSaving(false);
    }
  }

  function buildPrintableRecord() {
    const esc = (value: string) => value.replace(/[&<>"']/g, (char) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    })[char] ?? char);
    const field = (label: string, value: string) => value.trim()
      ? `<section class="field"><h3>${esc(label)}</h3><p>${esc(value).replace(/\n/g, "<br>")}</p></section>`
      : "";
    const general = [
      ["Data de nascimento", anamnesis.birthDate],
      ["Idade", calculateAge(anamnesis.birthDate)],
      ["Escolaridade", anamnesis.education],
      ["Telefone", patientPhone || "Não informado"],
      ["Contato emergencial", anamnesis.emergencyContact],
      ["Endereço", anamnesis.address],
      ["Profissão", anamnesis.profession],
      ["Encaminhamento", anamnesis.referral],
      ["Terapeuta responsável", anamnesis.responsibleTherapist],
      ["Conselho de classe", anamnesis.professionalCouncil],
    ].map(([label, value]) => field(label, value)).join("");
    const anamnesisSections = (Object.keys(anamnesisLabels) as Array<keyof AnamnesisData>)
      .filter((key) => !["birthDate", "education", "emergencyContact", "address", "profession", "referral", "responsibleTherapist", "professionalCouncil"].includes(key))
      .map((key) => field(anamnesisLabels[key], anamnesis[key])).join("");
    const evolutions = notes.length
      ? notes.map((note) => `<article class="evolution"><h3>Evolução — ${esc(formatDate(note.updated_at))}</h3><p>${esc(note.content).replace(/\n/g, "<br>")}</p></article>`).join("")
      : "<p>Nenhuma evolução registrada.</p>";
    return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Prontuário — ${esc(patientName)}</title><style>
      body{font:12pt Arial,sans-serif;color:#222;max-width:800px;margin:32px auto;padding:0 24px;line-height:1.55}
      h1{font-size:22pt;margin-bottom:4px}h2{font-size:16pt;border-bottom:1px solid #bbb;padding-bottom:6px;margin-top:28px}
      h3{font-size:11pt;margin:14px 0 4px}.field p,.evolution p{margin:0;white-space:normal;overflow-wrap:anywhere}
      .grid{display:grid;grid-template-columns:1fr 1fr;gap:8px 20px}.field{break-inside:avoid}.evolution{border-top:1px solid #ddd;padding:12px 0;break-inside:avoid}
      .confidential{font-size:9pt;color:#555;margin:4px 0 20px}@media print{body{margin:0 auto;padding:0 8mm}button{display:none}}
    </style></head><body><h1>Prontuário Psicológico</h1><div><strong>Paciente:</strong> ${esc(patientName)}</div><p class="confidential">Documento confidencial — uso profissional restrito.</p>
      <h2>Dados gerais</h2><div class="grid">${general}</div><h2>Anamnese</h2>${anamnesisSections || "<p>Anamnese sem campos preenchidos.</p>"}<h2>Evoluções clínicas</h2>${evolutions}
      <p class="confidential">Gerado pelo MenteHub em ${esc(new Date().toLocaleString("pt-BR"))}. Revise antes de utilizar ou compartilhar.</p></body></html>`;
  }

  function printRecord() {
    const printWindow = window.open("", "_blank", "noopener,noreferrer");
    if (!printWindow) {
      setErrorMessage("O navegador bloqueou a janela de impressão. Permita pop-ups para o MenteHub e tente novamente.");
      return;
    }
    printWindow.document.open();
    printWindow.document.write(buildPrintableRecord());
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  }

  function exportRecord() {
    const html = buildPrintableRecord();
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `prontuario-${patientName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9-]+/g, "-").toLowerCase()}.html`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) {
      setErrorMessage("Não foi possível encerrar a sessão.");
      return;
    }
    window.location.assign("/login");
  }

  return (
    <main className="patients-page">
      <header className="patients-topbar">
        <Link className="auth-brand" href="/" aria-label="MenteHub início">
          <span className="auth-brand-mark"><BookOpenText size={19} /></span>
          <span><strong>mentehub</strong><small>seu consultório em harmonia</small></span>
        </Link>
        <div className="patients-account">
          <span>{userEmail}</span>
          <button type="button" className="patients-quiet-button" onClick={signOut}><LogOut size={15} /> Sair</button>
        </div>
      </header>

      <section className="patients-content clinical-content">
        <Link className="patients-back" href="/pacientes"><ArrowLeft size={15} /> Voltar aos pacientes</Link>
        <div className="patients-heading">
          <div>
            <p className="auth-eyebrow">REGISTRO CLÍNICO PRIVADO</p>
            <h1>Prontuário</h1>
            <p className="auth-description">{patientName} · Evoluções clínicas vinculadas ao paciente.</p>
          </div>
          <div className="clinical-toolbar-actions">
            <button type="button" className="patients-quiet-button" onClick={() => window.print()}><Printer size={15} /> Imprimir / PDF</button>
            <button type="button" className="patients-quiet-button" onClick={exportRecord}><Download size={15} /> Exportar HTML</button>
            <button type="button" className="button button-primary" onClick={startNew}><Plus size={16} /> Nova evolução</button>
          </div>
        </div>

        <div className="clinical-warning" role="note">
          <strong>Confidencialidade:</strong> registre apenas informações necessárias ao atendimento. Revise o conteúdo antes de salvar. Use dados fictícios durante os testes.
        </div>

        <section className="patient-form-card clinical-form-card clinical-anamnesis-card">
          <div className="patient-form-heading">
            <div>
              <h2>Anamnese</h2>
              <p className="clinical-muted">Entrevista inicial e informações gerais do paciente</p>
            </div>
            <div className="clinical-anamnesis-heading-actions">
              <span className="clinical-note-meta">{loadingAnamnesis ? "Carregando…" : anamnesisExists ? "Salva" : "Ainda não salva"}</span>
              <button type="button" className="patients-quiet-button" onClick={() => { const next = !showAnamnesisHistory; setShowAnamnesisHistory(next); if (next) void loadAnamnesisHistory(); }}><History size={14} /> {showAnamnesisHistory ? "Ocultar histórico" : "Histórico da anamnese"}</button>
            </div>
          </div>
          {anamnesisError && <div className="patients-error" role="alert">{anamnesisError}</div>}
          <form onSubmit={handleSaveAnamnesis}>
            <h3 className="clinical-anamnesis-section-title">Dados gerais</h3>
            <div className="patient-form-grid">
              <div className="patient-field patient-field-wide">
                <label>Nome</label>
                <input value={patientName} readOnly />
              </div>
              <div className="patient-field">
                <label htmlFor="anamnesis-birth-date">Data de nascimento</label>
                <input id="anamnesis-birth-date" type="date" value={anamnesis.birthDate} onChange={(event) => updateAnamnesis("birthDate", event.target.value)} />
              </div>
              <div className="patient-field">
                <label>Idade</label>
                <input value={calculateAge(anamnesis.birthDate)} readOnly />
              </div>
              <div className="patient-field">
                <label htmlFor="anamnesis-education">Escolaridade</label>
                <input id="anamnesis-education" maxLength={160} value={anamnesis.education} onChange={(event) => updateAnamnesis("education", event.target.value)} />
              </div>
              <div className="patient-field">
                <label>Telefone</label>
                <input value={patientPhone || "Não informado no cadastro"} readOnly />
              </div>
              <div className="patient-field">
                <label htmlFor="anamnesis-emergency">Contato emergencial</label>
                <input id="anamnesis-emergency" maxLength={240} value={anamnesis.emergencyContact} onChange={(event) => updateAnamnesis("emergencyContact", event.target.value)} />
              </div>
              <div className="patient-field patient-field-wide">
                <label htmlFor="anamnesis-address">Endereço</label>
                <input id="anamnesis-address" maxLength={500} value={anamnesis.address} onChange={(event) => updateAnamnesis("address", event.target.value)} />
              </div>
              <div className="patient-field">
                <label htmlFor="anamnesis-profession">Profissão</label>
                <input id="anamnesis-profession" maxLength={160} value={anamnesis.profession} onChange={(event) => updateAnamnesis("profession", event.target.value)} />
              </div>
              <div className="patient-field">
                <label htmlFor="anamnesis-referral">Encaminhamento</label>
                <input id="anamnesis-referral" maxLength={300} value={anamnesis.referral} onChange={(event) => updateAnamnesis("referral", event.target.value)} />
              </div>
              <div className="patient-field">
                <label htmlFor="anamnesis-therapist">Terapeuta responsável</label>
                <input id="anamnesis-therapist" maxLength={200} value={anamnesis.responsibleTherapist} onChange={(event) => updateAnamnesis("responsibleTherapist", event.target.value)} />
              </div>
              <div className="patient-field">
                <label htmlFor="anamnesis-council">Conselho de classe</label>
                <input id="anamnesis-council" maxLength={120} value={anamnesis.professionalCouncil} onChange={(event) => updateAnamnesis("professionalCouncil", event.target.value)} placeholder="Ex.: CRP 00/00000" />
              </div>
            </div>

            <h3 className="clinical-anamnesis-section-title">Demanda / queixa inicial</h3>
            <div className="patient-field">
              <label htmlFor="anamnesis-complaint">Queixa relatada e motivo da procura</label>
              <textarea id="anamnesis-complaint" rows={4} maxLength={10000} value={anamnesis.initialComplaint} onChange={(event) => updateAnamnesis("initialComplaint", event.target.value)} placeholder="Registre a demanda inicial com as palavras do paciente quando pertinente." />
            </div>

            <h3 className="clinical-anamnesis-section-title">Histórico e contexto</h3>
            <div className="patient-form-grid">
              <div className="patient-field patient-field-wide">
                <label htmlFor="anamnesis-current-history">História da demanda atual</label>
                <textarea id="anamnesis-current-history" rows={4} maxLength={10000} value={anamnesis.currentHistory} onChange={(event) => updateAnamnesis("currentHistory", event.target.value)} placeholder="Início, frequência, contexto, impactos e estratégias já utilizadas." />
              </div>
              <div className="patient-field patient-field-wide">
                <label htmlFor="anamnesis-personal-history">História pessoal e desenvolvimento</label>
                <textarea id="anamnesis-personal-history" rows={4} maxLength={10000} value={anamnesis.personalHistory} onChange={(event) => updateAnamnesis("personalHistory", event.target.value)} />
              </div>
              <div className="patient-field patient-field-wide">
                <label htmlFor="anamnesis-family-social">História familiar, relações e contexto social</label>
                <textarea id="anamnesis-family-social" rows={4} maxLength={10000} value={anamnesis.familySocialHistory} onChange={(event) => updateAnamnesis("familySocialHistory", event.target.value)} />
              </div>
              <div className="patient-field patient-field-wide">
                <label htmlFor="anamnesis-health">Saúde geral e histórico relevante</label>
                <textarea id="anamnesis-health" rows={3} maxLength={10000} value={anamnesis.healthHistory} onChange={(event) => updateAnamnesis("healthHistory", event.target.value)} />
              </div>
              <div className="patient-field patient-field-wide">
                <label htmlFor="anamnesis-medications">Medicamentos informados pelo paciente (se pertinente)</label>
                <textarea id="anamnesis-medications" rows={2} maxLength={5000} value={anamnesis.medications} onChange={(event) => updateAnamnesis("medications", event.target.value)} />
              </div>
              <div className="patient-field patient-field-wide">
                <label htmlFor="anamnesis-goals">Expectativas e objetivos do acompanhamento</label>
                <textarea id="anamnesis-goals" rows={3} maxLength={10000} value={anamnesis.goals} onChange={(event) => updateAnamnesis("goals", event.target.value)} />
              </div>
              <div className="patient-field patient-field-wide">
                <label htmlFor="anamnesis-observations">Observações relevantes</label>
                <textarea id="anamnesis-observations" rows={3} maxLength={10000} value={anamnesis.observations} onChange={(event) => updateAnamnesis("observations", event.target.value)} />
              </div>
            </div>
            <p className="patient-privacy-note">A anamnese é informação clínica confidencial. Preencha somente o que for pertinente, revise o conteúdo e salve após o atendimento. As evoluções de cada sessão permanecem em uma seção separada.</p>
            <div className="patient-form-actions">
              <span className="clinical-muted">{anamnesisExists ? "Alterações não salvas serão perdidas ao sair." : "Preencha os campos pertinentes; não é obrigatório completar todos."}</span>
              <button type="submit" className="button button-primary" disabled={savingAnamnesis || loadingAnamnesis}><Save size={15} /> {savingAnamnesis ? "Salvando anamnese…" : "Salvar anamnese"}</button>
            </div>
          </form>
          {showAnamnesisHistory && (
            <section className="clinical-anamnesis-history" aria-label="Histórico da anamnese">
              <div className="clinical-history-heading"><History size={15} /><strong>Histórico de versões da anamnese</strong></div>
              {loadingAnamnesisHistory ? <p className="clinical-muted">Carregando histórico…</p> : anamnesisRevisions.length === 0 ? (
                <p className="clinical-muted">Nenhuma versão encontrada. As versões futuras serão registradas a cada salvamento com alterações.</p>
              ) : (
                <div className="clinical-revision-list">
                  {anamnesisRevisions.map((revision) => (
                    <article className="clinical-revision" key={revision.id}>
                      <div><strong>{revision.action === "created" ? "Anamnese criada" : "Anamnese atualizada"}</strong><time>{formatDate(revision.changed_at)}</time></div>
                      <div className="clinical-anamnesis-snapshot">
                        {(Object.keys(anamnesisLabels) as Array<keyof AnamnesisData>).map((key) => {
                          const value = revision.data_snapshot?.[key];
                          if (!value) return null;
                          return <p key={key}><strong>{anamnesisLabels[key]}:</strong> {key === "birthDate" ? value : value}</p>;
                        })}
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          )}
        </section>

        {notice && <div className="patients-notice" role="status">{notice}<button type="button" onClick={() => setNotice("")} aria-label="Fechar aviso"><X size={15} /></button></div>}
        {errorMessage && <div className="patients-error" role="alert">{errorMessage}</div>}

        {showForm && (
          <form className="patient-form-card clinical-form-card" onSubmit={handleSubmit}>
            <div className="patient-form-heading">
              <h2>{editingId ? "Editar evolução" : "Nova evolução clínica"}</h2>
              <button type="button" className="patients-icon-button" onClick={() => { setShowForm(false); setEditingId(null); setErrorMessage(""); }} aria-label="Fechar formulário"><X size={17} /></button>
            </div>
            <div className="patient-field">
              <label htmlFor="clinical-appointment">Consulta relacionada (opcional)</label>
              <select id="clinical-appointment" value={appointmentId} onChange={(event) => setAppointmentId(event.target.value)}>
                <option value="">Sem consulta vinculada</option>
                {appointments.map((appointment) => (
                  <option key={appointment.id} value={appointment.id}>
                    {formatDate(appointment.starts_at)} · {appointment.title} · {statusLabels[appointment.status] ?? appointment.status}
                  </option>
                ))}
              </select>
            </div>
            <div className="patient-field clinical-content-field">
              <label htmlFor="clinical-content">Evolução clínica *</label>
              <div className="clinical-dictation-actions">
                <button type="button" className="patients-quiet-button" onClick={toggleDictation}>
                  {dictating ? <MicOff size={15} /> : <Mic size={15} />}
                  {dictating ? "Parar ditado" : "Ditar por voz"}
                </button>
                {dictating && <span role="status">Ouvindo… fale a evolução após a sessão.</span>}
              </div>
              <textarea id="clinical-content" required maxLength={20000} rows={10} value={content} onChange={(event) => setContent(event.target.value)} placeholder="Digite ou dite a evolução e revise o texto antes de salvar." />
              <div className="clinical-dictation-status" role="status" aria-live="polite" style={{ marginTop: 8, padding: "8px 10px", borderRadius: 8, background: "#f3f4f6", color: "#1f2937", fontSize: 13 }}>{dictationMessage || "Ditado pronto. Clique em “Ditar por voz” para iniciar."}</div>
              <small>{content.length.toLocaleString("pt-BR")} / 20.000 caracteres</small>
              <p className="patient-privacy-note">O reconhecimento de voz depende do navegador e pode ser processado por seu fornecedor. Use o ditado somente após a sessão, nunca para gravar a conversa com o paciente. Revise o texto antes de salvar.</p>
            </div>
            <p className="patient-privacy-note">Cada salvamento gera uma versão no histórico. Não use o campo administrativo do cadastro de pacientes para anotações clínicas.</p>
            <div className="patient-form-actions">
              <button type="button" className="patients-quiet-button" onClick={() => { setShowForm(false); setEditingId(null); }}>Cancelar</button>
              <button type="submit" className="button button-primary" disabled={saving || dictating}><Save size={15} /> {saving ? "Salvando…" : dictating ? "Finalize o ditado para salvar" : "Salvar evolução"}</button>
            </div>
          </form>
        )}

        <div className="clinical-record-grid">
          <section className="patients-list-card clinical-notes-card">
            <div className="patients-list-heading">
              <div><h2>Evoluções</h2><p>{notes.length} {notes.length === 1 ? "registro" : "registros"}</p></div>
            </div>
            {loading ? <p className="patients-empty">Carregando prontuário…</p> : notes.length === 0 ? (
              <div className="patients-empty">
                <span className="patients-empty-icon"><FileText size={21} /></span>
                <strong>Nenhuma evolução registrada</strong>
                <p>Os registros salvos aparecerão aqui, vinculados a este paciente.</p>
                <button type="button" className="button button-primary" onClick={startNew}><Plus size={15} /> Nova evolução</button>
              </div>
            ) : (
              <div className="clinical-note-list">
                {notes.map((note) => (
                  <button type="button" key={note.id} className={selectedNoteId === note.id ? "clinical-note-item selected" : "clinical-note-item"} onClick={() => { setSelectedNoteId(note.id); setShowForm(false); setErrorMessage(""); }}>
                    <span className="clinical-note-date"><CalendarDays size={14} /> {formatDate(note.updated_at)}</span>
                    <span className="clinical-note-preview">{note.content.slice(0, 145)}{note.content.length > 145 ? "…" : ""}</span>
                    <span className="clinical-note-meta">{note.appointment_id ? "Consulta vinculada" : "Sem consulta vinculada"}</span>
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="patients-list-card clinical-detail-card">
            {selectedNote ? (
              <>
                <div className="clinical-detail-heading">
                  <div><h2>Registro selecionado</h2><p>Última alteração: {formatDate(selectedNote.updated_at)}</p></div>
                  <button type="button" className="patients-quiet-button" onClick={() => startEdit(selectedNote)}><FileText size={14} /> Editar</button>
                </div>
                <div className="clinical-note-full">{selectedNote.content}</div>
                <div className="clinical-history-heading"><History size={15} /><strong>Histórico de versões</strong></div>
                {loadingHistory ? <p className="patients-empty">Carregando histórico…</p> : revisions.length === 0 ? <p className="clinical-muted">Nenhuma versão histórica disponível.</p> : (
                  <div className="clinical-revision-list">
                    {revisions.map((revision) => (
                      <article className="clinical-revision" key={revision.id}>
                        <div><strong>{revision.action === "created" ? "Registro criado" : "Registro atualizado"}</strong><time>{formatDate(revision.changed_at)}</time></div>
                        <p>{revision.content_snapshot}</p>
                      </article>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="patients-empty clinical-detail-empty">
                <span className="patients-empty-icon"><History size={21} /></span>
                <strong>Histórico do prontuário</strong>
                <p>Selecione uma evolução para consultar o conteúdo e suas versões anteriores.</p>
              </div>
            )}
          </section>
        </div>
        <p className="patients-footer">MenteHub · Prontuário privado com controle de acesso por profissional e histórico de versões.</p>
      </section>
    </main>
  );
}
