import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { LanguageProvider } from "@/components/i18n/LanguageProvider";
import VoiceMascot from "@/components/periodico/VoiceMascot";

const display = localFont({
  src: "./fonts/bricolage-grotesque-latin-variable.woff2",
  variable: "--font-display",
  weight: "700 800",
  display: "swap",
});
const body = localFont({
  src: [
    { path: "./fonts/atkinson-hyperlegible-latin-400.woff2", weight: "400" },
    { path: "./fonts/atkinson-hyperlegible-latin-700.woff2", weight: "700" },
  ],
  variable: "--font-body",
  display: "swap",
});
const mono = localFont({
  src: "./fonts/ibm-plex-mono-latin-500.woff2",
  variable: "--font-mono",
  weight: "500",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Fixazo",
  description: "Periódico para jóvenes con noticias reales del día y preguntas para leerlas con criterio.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f3f5f1" },
    { media: "(prefers-color-scheme: dark)", color: "#0f1613" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body><LanguageProvider>{children}<VoiceMascot /></LanguageProvider></body>
    </html>
  );
}
