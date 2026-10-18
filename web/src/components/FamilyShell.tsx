"use client";
import { TranslatedText } from "@/components/i18n/LanguageProvider";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Icon } from "./ui";
import { useStore } from "@/lib/useStore";
import LanguageSelector from "@/components/i18n/LanguageSelector";
import { useLanguage, usePublicTranslations } from "@/components/i18n/LanguageProvider";

const NAV = [
  { href: "/", label: "Periódico", icon: "report" as const },
  { href: "/chat", label: "Lectura por voz", icon: "chat" as const },
  { href: "/transformaciones", label: "Transformaciones", icon: "book" as const },
  { href: "/informe", label: "Sesiones", icon: "report" as const },
  { href: "/progreso", label: "Progreso", icon: "progress" as const },
  { href: "/voz", label: "Voz (demo)", icon: "sound" as const },
  { href: "/lenguas", label: "Lenguas (lab)", icon: "languages" as const },
  { href: "/privacidad", label: "Privacidad", icon: "privacy" as const },
];

export const SHELL_TEXTS = ["Abrir menú", "Cerrar menú", "Navegación de la familia", "Sin perfil", "grado de primaria", "· casa:", "quechua", "castellano", ...NAV.map(({ label }) => label)] as const;

export function FamilyShell({ children }: { children: React.ReactNode }) {
  const { t } = useLanguage();
  usePublicTranslations(SHELL_TEXTS);
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const store = useStore();
  const profile = store?.loadProfile() ?? null;
  const active = (href: string) => pathname === href || (href === "/privacidad" && pathname === "/consentimiento");

  return (
    <div className="shell">
      <header className="topbar">
        <Link href="/chat" className="brand">
          <span className="brand-mark" aria-hidden="true">F</span>
          <span>Fixazo</span>
        </Link>
        <button type="button" className="icon-btn" aria-label={t("Abrir menú")} aria-expanded={open} onClick={() => setOpen(true)}>
          <Icon name="menu" />
        </button>
      </header>
      {open && <button type="button" className="scrim" aria-label={t("Cerrar menú")} onClick={() => setOpen(false)} />}
      <aside className={`sidebar${open ? " open" : ""}`} aria-label={t("Navegación de la familia")}>
        <Link href="/chat" className="brand" onClick={() => setOpen(false)}>
          <span className="brand-mark" aria-hidden="true">F</span>
          <span>Fixazo</span>
        </Link>
        <div className="child-pill">
          <small><TranslatedText text="Niño activo" /></small>
          <strong>{profile?.alias ?? t("Sin perfil")}</strong>
          {profile && (
            <small>
              {profile.grade}.º {t("grado de primaria")} <TranslatedText text="· casa:" />{" "}{t(profile.homeLang === "qu" ? "quechua" : "castellano")}
            </small>
          )}
        </div>
        <nav className="nav">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} aria-current={active(n.href) ? "page" : undefined} onClick={() => setOpen(false)} title={t(n.label)}>
              <Icon name={n.icon} />
              <span>{t(n.label)}</span>
            </Link>
          ))}
        </nav>
        <div className="sidebar-foot">
          <span><TranslatedText text="Tu avance se guarda en este dispositivo." /></span>
        </div>
      </aside>
      <main className="main" id="contenido">
        {pathname !== "/lenguas" && <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}><LanguageSelector /></div>}
        {children}
      </main>
    </div>
  );
}
