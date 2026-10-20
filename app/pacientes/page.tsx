import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PatientsClient from "./patients-client";

export const dynamic = "force-dynamic";

export default async function PatientsPage() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) redirect("/login");

  return <PatientsClient userEmail={data.user.email ?? ""} />;
}
