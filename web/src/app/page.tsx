"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/useStore";

export default function Home() {
  const router = useRouter();
  const store = useStore();
  useEffect(() => {
    if (!store) return;
    router.replace(store.loadConsent() ? "/chat" : "/consentimiento");
  }, [store, router]);
  return (
    <main style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: 16 }}>
      <div className="stack" style={{ textAlign: "center", maxWidth: 420 }}>
        <h1>Ñawinchay</h1>
        <p className="muted">Escuchamos cómo lee y cómo piensa tu hijo, y te decimos qué hacer en casa.</p>
        <p className="small muted">Cargando…</p>
      </div>
    </main>
  );
}
