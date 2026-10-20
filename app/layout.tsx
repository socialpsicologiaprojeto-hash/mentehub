import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MenteHub — seu consultório em harmonia",
  description: "Conteúdo, identidade visual e rotina profissional para psicólogos em um só lugar.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body>{children}</body></html>;
}
