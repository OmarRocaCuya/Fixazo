"use client";
import { useEffect, useRef } from "react";
import type { Mission } from "@/lib/types";

const KIND: Record<string, { label: string; cls: string }> = {
  obtiene: { label: "Obtiene", cls: "blue" },
  infiere: { label: "Infiere", cls: "maize" },
  reflexiona: { label: "Reflexiona", cls: "red" },
};

/** Reading text and questions for the family. Answers are never shown (RF-25). */
export function MissionSheet({ mission, onClose }: { mission: Mission; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title" onClick={(e) => e.stopPropagation()}>
        <div className="spread">
          <h2 id="sheet-title">{mission.title}</h2>
          <button ref={closeRef} type="button" className="btn subtle" onClick={onClose}>
            Cerrar
          </button>
        </div>
        <p style={{ fontSize: "1.15rem", lineHeight: 1.65 }}>{mission.text}</p>
        {mission.textEs && <p className="reading-es">{mission.textEs}</p>}
        <div className="stack-sm">
          {mission.questions.map((q) => (
            <div key={q.id} className="row" style={{ alignItems: "baseline" }}>
              <span className={`tag ${KIND[q.kind].cls}`}>{KIND[q.kind].label}</span>
              <span>
                {q.text}
                {q.textEs && <span className="muted"> · {q.textEs}</span>}
              </span>
            </div>
          ))}
        </div>
        <p className="small muted">No mostramos las respuestas para no adelantar la sesión. El dato de la contraprueba aparece durante la sesión.</p>
      </div>
    </div>
  );
}
