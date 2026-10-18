import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import NoticiaFlow from "@/components/periodico/NoticiaFlow";
import { buscarNoticia, noticiaPublica } from "@/lib/periodico/ediciones";

export default function PaginaNoticia({ params }: PageProps<"/noticia/[id]">) {
  return (
    <Suspense fallback={<div className="pd-wrap pd-angosto"><p className="pd-vacio">Cargando la noticia…</p></div>}>
      <Contenido params={params} />
    </Suspense>
  );
}

async function Contenido({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const { id } = await params;
  const noticia = await buscarNoticia(id);
  if (!noticia) notFound();
  return (
    <div className="pd-wrap pd-angosto">
      <div className="pd-top">
        <Link className="pd-marca" href="/">Fixazo</Link>
        <Link className="pd-insights" href="/insights">Mis insights</Link>
      </div>
      <NoticiaFlow noticia={noticiaPublica(noticia)} />
    </div>
  );
}
