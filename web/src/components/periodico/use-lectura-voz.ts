"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { Bloque } from "@reader-enricher/types";
import { wordAt } from "./lectura-model";

const subscribe = () => () => undefined;
const supported = () => typeof window !== "undefined" && "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;
export type ActiveWord = { bloqueId: string; inicio: number; fin: number } | null;

export function useLecturaVoz(blocks: Bloque[]) {
  const available = useSyncExternalStore(subscribe, supported, () => false);  const [playing, setPlaying] = useState(false);
  const [activeWord, setActiveWord] = useState<ActiveWord>(null);
  const [notice, setNotice] = useState("Escucha opcional con la voz de tu navegador. No usa el micrófono.");
  const epoch = useRef(0);
  const current = useRef<SpeechSynthesisUtterance | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function cancel() {
    epoch.current++;
    if (timer.current) clearTimeout(timer.current);
    if (current.current && supported()) window.speechSynthesis.cancel();
    current.current = null;
  }

  useEffect(() => {
    const visibility = () => { if (document.visibilityState === "hidden") stop(); };
    document.addEventListener("visibilitychange", visibility);
    return () => { cancel(); document.removeEventListener("visibilitychange", visibility); };
    // This reader remounts when its article or presentation changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function stop() {
    cancel(); setPlaying(false); setActiveWord(null);
    setNotice("Lectura detenida. Puedes volver a escuchar desde el principio.");
  }

  function start() {
    if (!available || !blocks.length) return;
    cancel();
    const run = epoch.current;
    setPlaying(true); setActiveWord(null);
    setNotice("Preparando la voz. El resaltado solo aparece si el navegador informa las palabras pronunciadas.");
    let sawAnyBoundary = false;
    const speak = (index: number) => {
      if (epoch.current !== run) return;
      const block = blocks[index];
      if (!block) {
        if (timer.current) clearTimeout(timer.current);
        current.current = null; setPlaying(false); setActiveWord(null);
        setNotice(sawAnyBoundary ? "Lectura terminada." : "Lectura terminada sin sincronización: esta voz no informó límites de palabras.");
        return;
      }
      const utterance = new SpeechSynthesisUtterance(block.texto);
      let synchronized = false;
      current.current = utterance; utterance.lang = "es";
      utterance.onstart = () => {
        if (epoch.current !== run || current.current !== utterance) return;
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => {
          if (epoch.current === run && current.current === utterance && !synchronized) setNotice("Escuchando sin sincronización: esta voz no informa límites de palabras. No se simula el resaltado.");
        }, 2500);
      };
      utterance.onboundary = (event) => {
        if (epoch.current !== run || current.current !== utterance || event.name !== "word") return;
        const range = wordAt(block.texto, event.charIndex);
        if (!range) return;
        synchronized = true; sawAnyBoundary = true;
        if (timer.current) clearTimeout(timer.current);
        setNotice("Escuchando. El resaltado sigue los límites de palabras que informa tu navegador.");
        setActiveWord({ bloqueId: block.id, ...range });
      };
      utterance.onend = () => { if (epoch.current === run && current.current === utterance) { setActiveWord(null); speak(index + 1); } };
      utterance.onerror = () => {
        if (epoch.current !== run || current.current !== utterance) return;
        cancel(); setPlaying(false); setActiveWord(null);
        setNotice("La voz se interrumpió o no está disponible. Puedes continuar leyendo el texto.");
      };
      try { window.speechSynthesis.speak(utterance); } catch {
        cancel(); setPlaying(false); setActiveWord(null); setNotice("No se pudo iniciar la voz del navegador.");
      }
    };
    speak(0);
  }

  return { available, playing, activeWord, notice, start, stop };
}
