import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ClinicalRecordClient from "./clinical-record-client";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function ClinicalRecordPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();

  if (authError || !authData.user) redirect("/login");

  const { data: patient, error } = await supabase
    .from("patients")
    .select("id, full_name")
    .eq("id", id)
    .maybeSingle();

  if (error || !patient) notFound();

  return (
    <ClinicalRecordClient
      patientId={patient.id}
      patientName={patient.full_name}
      userEmail={authData.user.email ?? ""}
    />
  );
}
