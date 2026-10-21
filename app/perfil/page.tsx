import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ProfileClient from "./profile-client";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const supabase = await createClient();
  const { data: auth, error } = await supabase.auth.getUser();
  if (error || !auth.user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, professional_registration, timezone")
    .eq("id", auth.user.id)
    .maybeSingle();

  return (
    <ProfileClient
      userId={auth.user.id}
      email={auth.user.email ?? ""}
      initialName={profile?.full_name ?? ""}
      initialRegistration={profile?.professional_registration ?? ""}
      initialTimezone={profile?.timezone ?? "America/Sao_Paulo"}
    />
  );
}
