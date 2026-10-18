import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import LecturaNoticia from "@/components/periodico/LecturaNoticia";
import { ExplorarVozYLenguas, NavPeriodico } from "@/components/periodico/NavPeriodico";
import { getLecturaEnriquecida } from "@/lib/periodico/lectura";
import { buscarNoticia, noticiaPublica } from "@/lib/periodico/ediciones";

export default function PaginaNoticia({ params }: PageProps<"/noticia/[id]">) {
  return (
    <Suspense fallback={<div className="pd-wrap"><p className="pd-vacio">Cargando la noticia…</p></div>}>
      <Contenido params={params} />
    </Suspense>
  );
}

async function Contenido({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const { id } = await params;
  const noticia = await buscarNoticia(id);
  if (!noticia) notFound();
  const documento = await getLecturaEnriquecida(noticia);
  return (
    <div className="pd-wrap">
      <div className="pd-top">
        <Link className="pd-marca" href="/">Fixazo</Link>
        <NavPeriodico />
      </div>
      <LecturaNoticia noticia={noticiaPublica(noticia)} documento={documento} />
      <ExplorarVozYLenguas />
    </div>
  );
}
