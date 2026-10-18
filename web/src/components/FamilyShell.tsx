"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Icon } from "./ui";
import { useStore } from "@/lib/useStore";

const NAV = [
  { href: "/", label: "Periódico", icon: "report" as const },
  { href: "/chat", label: "Lectura por voz", icon: "chat" as const },
  { href: "/informe", label: "Sesiones", icon: "report" as const },
  { href: "/progreso", label: "Progreso", icon: "progress" as const },
  { href: "/voz", label: "Voz (demo)", icon: "sound" as const },
  { href: "/lenguas", label: "Lenguas (lab)", icon: "languages" as const },
  { href: "/privacidad", label: "Privacidad", icon: "privacy" as const },
];

const GRADE = (g: number) => `${g}.º de primaria`;
const LANG = (l: string) => (l === "qu" ? "quechua" : "castellano");

export function FamilyShell({ children }: { children: React.ReactNode }) {
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
        <button type="button" className="icon-btn" aria-label="Abrir menú" aria-expanded={open} onClick={() => setOpen(true)}>
          <Icon name="menu" />
        </button>
      </header>
      {open && <button type="button" className="scrim" aria-label="Cerrar menú" onClick={() => setOpen(false)} />}
      <aside className={`sidebar${open ? " open" : ""}`} aria-label="Navegación de la familia">
        <Link href="/chat" className="brand" onClick={() => setOpen(false)}>
          <span className="brand-mark" aria-hidden="true">F</span>
          <span>Fixazo</span>
        </Link>
        <div className="child-pill">
          <small>Niño activo</small>
          <strong>{profile?.alias ?? "Sin perfil"}</strong>
          {profile && (
            <small>
              {GRADE(profile.grade)} · casa: {LANG(profile.homeLang)}
            </small>
          )}
        </div>
        <nav className="nav">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} aria-current={active(n.href) ? "page" : undefined} onClick={() => setOpen(false)} title={n.label}>
              <Icon name={n.icon} />
              <span>{n.label}</span>
            </Link>
          ))}
        </nav>
        <div className="sidebar-foot">
          <span>
            <span className="dot" /> Entiendo: integración pendiente
          </span>
          <span>Perfil e informes en este dispositivo. La voz en la nube requiere el código de acceso del despliegue.</span>
        </div>
      </aside>
      <main className="main" id="contenido">
        {children}
      </main>
    </div>
  );
}
