import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AgendaClient from "./agenda-client";

export const dynamic = "force-dynamic";

export default async function AgendaPage() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) redirect("/login");

  return <AgendaClient userEmail={data.user.email ?? ""} />;
}
