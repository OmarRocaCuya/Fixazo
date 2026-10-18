// Built-in sample missions (no LLM needed).
import type { Mission } from "../types";

export const SAMPLE_ES: Mission = {
  id: "sample-es-rosa",
  title: "Rosa y el puquio",
  lang: "es",
  grade: 4,
  text:
    "Rosa se levantó muy temprano y fue al río a traer agua. Pero el río estaba seco. " +
    "Por eso caminó hasta el puquio, que queda lejos, detrás del cerro. Llevaba dos baldes y cantaba para no tener miedo. " +
    "Cuando volvió, su mamá ya había preparado el desayuno. Rosa estaba cansada, pero contenta, porque su familia tenía agua para todo el día.",
  questions: [
    {
      id: "es-o",
      kind: "obtiene",
      text: "¿A dónde fue Rosa primero?",
      simpler: "Al principio de la lectura, ¿a qué lugar fue Rosa?",
      answerKey: { primary: ["río"], partial: ["agua", "traer"] },
    },
    {
      id: "es-i",
      kind: "infiere",
      text: "¿Por qué Rosa tuvo que ir hasta el puquio?",
      simpler: "¿Qué pasó en el primer lugar para que Rosa siguiera caminando?",
      evidenceKeys: ["seco", "seca", "secó"],
    },
    {
      id: "es-r",
      kind: "reflexiona",
      text: "¿Hizo bien Rosa en ir sola hasta el puquio? ¿Por qué?",
      simpler: "¿Te parece bien lo que hizo Rosa?",
    },
  ],
  counter: {
    text: "El puquio queda lejos, detrás del cerro, y Rosa salió sola muy temprano, cuando todavía estaba oscuro.",
  },
  source: "sample",
  createdAt: "2026-10-17T00:00:00.000Z",
};

// TODO(validate-quechua): every Quechua string below is a draft and must be validated by a Chanka speaker.
export const SAMPLE_QU: Mission = {
  id: "sample-qu-rosa",
  title: "Rosa yaku apamuq",
  lang: "qu",
  grade: 4,
  // TODO(validate-quechua)
  text: "Rosaqa tutapayta hatarispa mayuman rirqa yaku apamuq. Mayuqa chakisqam karqa. Chaymi pukyuman rirqa.",
  textEs: "Rosa se levantó al amanecer y fue al río a traer agua. El río estaba seco. Por eso fue al manantial.",
  questions: [
    {
      id: "qu-o",
      kind: "obtiene",
      // TODO(validate-quechua)
      text: "¿Maymanmi Rosa rirqa?",
      textEs: "¿A dónde fue Rosa?",
      simpler: "¿A qué lugar fue Rosa a traer agua?",
      answerKey: { primary: ["mayu", "mayuman", "río", "pukyu", "pukyuman", "manantial", "puquio"], partial: ["yaku", "agua"] },
    },
    {
      id: "qu-i",
      kind: "infiere",
      // TODO(validate-quechua)
      text: "¿Imanaptinmi pukyuman rirqa?",
      textEs: "¿Por qué fue al manantial?",
      simpler: "¿Cómo estaba el río?",
      evidenceKeys: ["chakisqa", "chakisqam", "seco", "seca"],
    },
    {
      id: "qu-r",
      kind: "reflexiona",
      // TODO(validate-quechua)
      text: "¿Allintachu Rosa ruwarqa?",
      textEs: "¿Hizo bien Rosa?",
      simpler: "¿Te parece bien lo que hizo Rosa?",
    },
  ],
  counter: {
    // TODO(validate-quechua): no validated Quechua version yet; shown in Spanish.
    text: "El manantial queda lejos y Rosa fue sola cuando todavía estaba oscuro.",
  },
  source: "sample",
  createdAt: "2026-10-17T00:00:00.000Z",
};

export const SAMPLE_MISSIONS = [SAMPLE_ES, SAMPLE_QU];
