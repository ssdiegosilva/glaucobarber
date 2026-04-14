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
    default:  "Voltaki – Seu cliente sempre volta",
    template: "%s | Voltaki",
  },
  description:
    "Plataforma de fidelização inteligente. WhatsApp automático, campanhas com IA e gestão de clientes para seu negócio crescer.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "https://voltaki.com.br"),
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Voltaki",
  },
  openGraph: {
    type:        "website",
    locale:      "pt_BR",
    url:         "https://voltaki.com.br",
    siteName:    "Voltaki",
    title:       "Voltaki – Seu cliente sempre volta",
    description: "Plataforma de fidelização inteligente com WhatsApp automático e IA.",
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
