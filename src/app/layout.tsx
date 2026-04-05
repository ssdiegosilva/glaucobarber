import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { RegisterSW } from "@/components/pwa/register-sw";
import { NativeInit } from "@/components/mobile/NativeInit";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default:  "GlaucoBarber – Copiloto Inteligente da Barbearia",
    template: "%s | GlaucoBarber",
  },
  description:
    "Painel de inteligência para barbearias. Agenda, clientes, sugestões de IA, campanhas e crescimento — tudo integrado com a Trinks.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "https://glaucobarber.com"),
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "GlaucoBarber",
  },
  openGraph: {
    type:        "website",
    locale:      "pt_BR",
    url:         "https://glaucobarber.com",
    siteName:    "GlaucoBarber",
    title:       "GlaucoBarber – Copiloto Inteligente da Barbearia",
    description: "Painel de inteligência para barbearias.",
  },
};

export const viewport: Viewport = {
  themeColor: "#080810",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={inter.variable} suppressHydrationWarning>
      <head>
        <link rel="apple-touch-icon" href="/icon-192.png" />
      </head>
      <body>
        <RegisterSW />
        <NativeInit />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
