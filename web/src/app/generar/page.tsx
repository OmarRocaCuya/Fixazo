// Demo: "Buscar una noticia nueva". Pasa al cliente solo datos públicos de las noticias reservadas.
import { connection } from "next/server";
import { Suspense } from "react";
import GenerarDemo, { type ReservadaDemo } from "@/components/periodico/GenerarDemo";
import { noticiasReservadas } from "@/lib/periodico/ediciones";

export default function PaginaGenerar() {
  return (
    <Suspense fallback={<div className="pd-wrap pd-angosto"><p className="pd-vacio">Cargando…</p></div>}>
      <Contenido />
    </Suspense>
  );
}

async function Contenido() {
  await connection();
  const reservadas: ReservadaDemo[] = (await noticiasReservadas()).map((n) => ({
    id: n.id, seccion: n.seccion, titular: n.titular, bajada: n.bajada, creada: n.creada, minutos: n.minutos,
    medios: n.fuentes.map((f) => f.medio), miradas: n.miradas ?? [],
    titularOriginal: n.fuentes[0]?.titular ?? n.titular,
    preguntas: n.pasos.flatMap((p) => (p.tipo === "fragmento" ? [] : [p.titulo])),
  }));
  return <GenerarDemo reservadas={reservadas} />;
}
