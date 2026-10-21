"use client";
import Link from "next/link";
import { PracticeMemory } from "./PracticeMemory";
import { nextPracticeGoal } from "@/lib/periodico/practice-goals";
import { buildPeriodicoReport } from "@/lib/periodico/informe";
import type { ResultadoNoticia } from "@/lib/periodico/progreso";
import { FamilyShare } from "@/components/report/FamilyShare";
import { ResumenVozQuiz } from "./EmocionRespuesta";

export function InformeFinal({ resultado }: { resultado: ResultadoNoticia }) {
  const report = buildPeriodicoReport(resultado);
  return <section className="stack" aria-label="Informe final del quiz">
    <div className="pd-bloque pd-pregunta">
      <div className="pd-tipo">Terminaste esta noticia · informe final</div>
      <h2>Lo que hiciste en esta lectura</h2>
      <p>Este resumen aparece al finalizar el quiz. Describe esta actividad; no es una nota global ni un diagnóstico.</p>
      <p><strong>{report.achieved} de {report.observed}</strong> resultados finales de habilidades con respuesta esperada en esta actividad.</p>
      {report.skills.length ? <ul className="pd-lista-logros">
        {report.skills.map((skill) => <li key={skill.name}><span>{skill.name}</span><span className="muted">{skill.achieved ? "Respuesta esperada en esta actividad" : "Para seguir practicando"}</span></li>)}
      </ul> : <p className="muted">No hay respuestas con criterio de acierto registradas. Esto no equivale a un fallo.</p>}
      <h3>Primer intento y apoyos</h3>
      {report.initial && report.assisted ? <ul className="pd-lista-logros">
        <li><span>Primeras respuestas sin apoyo</span><span>{report.initial.observed ? `${report.initial.correct} de ${report.initial.observed} con respuesta esperada` : "Sin observaciones con criterio de acierto"}</span></li>
        <li><span>Respuestas finales con apoyo</span><span>{report.assisted.observed ? `${report.assisted.correct} de ${report.assisted.observed} con respuesta esperada` : "Sin observaciones con criterio de acierto"}</span></li>
        <li><span>Apoyos presentados en opción múltiple</span><span>{report.supports}</span></li>
      </ul> : <p className="muted">Registro anterior: no está disponible el detalle de primeras respuestas y apoyos.</p>}
      <p className="small muted">Acertar con pistas o en el mismo texto no demuestra dominio ni transferencia a un texto nuevo. Una pregunta nueva sin ayuda permite observarlo mejor.</p>
      <h3>Tu explicación</h3>
      {report.voiceStatus === "no_evaluable" ? <p className="muted">Sin evaluación de la explicación. No se registra como fallo ni como habilidad lograda.</p> : <>
        <p className="small">Revisión automática provisional: contrasta los criterios con una persona. Las pausas o muletillas no se usan como nota.</p>
        <ul className="pd-lista-logros">{report.voiceCriteria.map((criterion, i) => <li key={`${criterion.name}-${i}`}><span>{criterion.name}</span><span className="muted">{criterion.achieved ? "Observado en la respuesta" : "Para revisar juntos"}</span></li>)}</ul>
      </>}
      <h3>Qué puedes probar ahora</h3>
      <p>{report.nextStep}</p>
      <p className="small muted">No inferimos identidad, salud ni calidad del acento. La emoción, si hubo respuestas por voz, es solo una estimación experimental desde el audio. No observamos lo que el micrófono no capturó.</p>
      <div className="row">
        <Link className="btn primary" href="/insights">Ver mis insights</Link>
        <Link className="btn ghost" href="/">Volver a la portada</Link>
      </div>
    </div>
    <ResumenVozQuiz emociones={resultado.emociones} metricas={resultado.audioQuiz} />
    <PracticeMemory goal={nextPracticeGoal(resultado)} />
    <FamilyShare summary={report.share} />
  </section>;
}

