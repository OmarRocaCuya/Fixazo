"use client";
import { useState } from "react";
import type { Permissions } from "@/lib/types";
import { Toggle } from "./ui";

const ROWS: Array<{ key: keyof Permissions; title: string; desc: string }> = [
  {
    key: "voice",
    title: "Voz durante la sesión",
    desc: "La app no guarda grabaciones. Puedes usar el reconocedor del navegador, preparar un modelo local o escribir. La voz en la nube requiere otra autorización por sesión.",
  },
  {
    key: "process",
    title: "Cómo lo dice",
    desc: "Pausas, tiempo para responder y posibles autocorrecciones o palabras de duda. Son aproximaciones revisables; un reconocedor puede omitirlas. No son una nota.",
  },
  {
    key: "mood",
    title: "Cómo se siente",
    desc: "Al inicio y al final tu hijo elige una carita. Solo usamos lo que él elige.",
  },
];

export function PermissionRows({ value, onChange }: { value: Permissions; onChange: (p: Permissions) => void }) {
  const [showWhy, setShowWhy] = useState(false);
  return (
    <div className="stack-sm">
      {ROWS.map((r) => (
        <div
          key={r.key}
          className="perm"
          role="group"
          aria-label={r.title}
          onClick={() => onChange({ ...value, [r.key]: !value[r.key] })}
        >
          <div className="stack-sm" style={{ gap: 2 }}>
            <strong>{r.title}</strong>
            <span className="small muted">{r.desc}</span>
          </div>
          <Toggle checked={value[r.key]} label={r.title} onChange={(v) => onChange({ ...value, [r.key]: v })} />
        </div>
      ))}
      <div className="perm na" role="group" aria-label="Reconocimiento automático de emociones" onClick={() => setShowWhy((s) => !s)}>
        <div className="stack-sm" style={{ gap: 2 }}>
          <strong>Reconocimiento automático de emociones · no disponible</strong>
          <span className="small" id="emo-why">
            {showWhy
              ? "No adivinamos emociones a partir de la voz: no es confiable en niños y puede equivocarse feo. Solo usamos la carita que elige tu hijo."
              : "No existe forma de activarlo. Toca para saber por qué."}
          </span>
        </div>
        <Toggle checked={false} label="Reconocimiento automático de emociones (no disponible)" disabled />
      </div>
      {!value.voice && (
        <p className="notice" role="status">
          Sin este permiso no se puede hacer la sesión de voz. Podrás usar la sesión escribiendo lo que dice tu hijo.
        </p>
      )}
    </div>
  );
}
