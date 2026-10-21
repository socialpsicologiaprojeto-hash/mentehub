import type { Metadata } from "next";
import "./globals.css";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "MenteHub — seu consultório em harmonia",
  description: "Conteúdo, identidade visual e rotina profissional para psicólogos em um só lugar.",
};

type ThemePreference = "light" | "dark" | "system";

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  let theme: ThemePreference = "system";

  try {
    const supabase = await createClient();
    const { data: auth } = await supabase.auth.getUser();
    if (auth.user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("theme_preference")
        .eq("id", auth.user.id)
        .maybeSingle();

      if (profile?.theme_preference === "light" || profile?.theme_preference === "dark" || profile?.theme_preference === "system") {
        theme = profile.theme_preference;
      }
    }
  } catch {
    // Keep public/auth pages usable if Supabase is temporarily unavailable.
  }

  return <html lang="pt-BR" data-theme={theme}><body>{children}</body></html>;
}
