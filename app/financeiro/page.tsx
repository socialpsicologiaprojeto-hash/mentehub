import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import FinancialClient from "./financial-client";

export const dynamic = "force-dynamic";

export default async function FinancialPage() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) redirect("/login");
  return <FinancialClient userEmail={data.user.email ?? ""} />;
}
