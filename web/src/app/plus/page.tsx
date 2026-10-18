// Fixazo Plus: lo que viene para las familias. Nada de esto cobra todavía; "Me interesa" solo cuenta clics.
import Link from "next/link";
import MeInteresa from "@/components/periodico/MeInteresa";

export const metadata = { title: "Fixazo Plus" };

const GRATIS = ["Las preguntas de cada noticia, una a la vez", "Explicar tu porqué con la voz y recibir una pregunta, nunca la respuesta", "Mis insights y la racha de lectura", "Una noticia nueva al día"];

const PLUS: Array<{ titulo: string; texto: string; estado: "En desarrollo" | "Pronto" }> = [
  { titulo: "Reporte semanal para la familia", texto: "Por WhatsApp, en palabras simples: qué leyó, qué habilidad mejoró y una pregunta para conversar en casa. El joven lo ve antes de que se envíe.", estado: "En desarrollo" },
  { titulo: "Temas a elegir", texto: "Además de IA, noticias de ciencia, deportes, música y economía, siempre de medios confiables.", estado: "Pronto" },
  { titulo: "Repaso a los 2 días", texto: "Vuelve una pregunta de una noticia que ya leíste, porque recordar es lo que más fija lo aprendido.", estado: "Pronto" },
  { titulo: "Tu meta y racha semanal", texto: "Eliges cuántos días a la semana quieres leer, y la racha cuenta semanas además de días.", estado: "Pronto" },
  { titulo: "Tarjeta para compartir", texto: "Una imagen con lo que pensaste esta semana, por ejemplo cuántas veces cambiaste de idea con buenas razones, no solo puntos.", estado: "Pronto" },
  { titulo: "Todas las noticias y el archivo", texto: "Sin límite diario, y con las noticias pasadas para seguir practicando.", estado: "Pronto" },
  { titulo: "Tu progreso en cualquier dispositivo", texto: "Con una cuenta para que la racha y los insights no se queden en un solo navegador.", estado: "Pronto" },
];

export default function Plus() {
  return (
    <div className="pd-wrap pd-angosto">
      <div className="pd-top">
        <Link className="pd-marca" href="/">Fixazo</Link>
        <Link className="pd-insights" href="/">Volver al periódico</Link>
      </div>
      <header className="pd-noticia-cabeza">
        <div className="eyebrow">Para la familia</div>
        <h1>Fixazo Plus</h1>
        <p className="pd-plus-precio"><b>S/ 10</b> al mes</p>
        <p className="muted">Para que la familia vea cómo su hijo usa la IA para pensar y no para copiar. Lo que sirve para aprender sigue siendo gratis.</p>
      </header>

      <section className="pd-card">
        <h2>Gratis, ya disponible</h2>
        <ul className="pd-plus-lista">{GRATIS.map((g) => <li key={g}>✓ {g}</li>)}</ul>
      </section>

      <section className="stack" style={{ marginTop: 16 }}>
        {PLUS.map((f) => (
          <div key={f.titulo} className="pd-card pd-plus-item">
            <div className="spread"><h3>{f.titulo}</h3><span className={`pd-chip ${f.estado === "En desarrollo" ? "hecha" : "nueva"}`}>{f.estado}</span></div>
            <p className="muted">{f.texto}</p>
          </div>
        ))}
      </section>

      <MeInteresa />
    </div>
  );
}
