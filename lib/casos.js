import sputnik from '../casos/sputnik-1957.js';

// Para agregar un caso: crear casos/<id>.js con la misma forma e importarlo aquí.
export const casos = { [sputnik.id]: sputnik };

export const buscarPregunta = (caso, id) =>
  caso.pasos.find((p) => p.tipo === 'pregunta' && p.id === id) ?? (caso.repaso?.id === id ? caso.repaso : null);

const sinPrivado = ({ privado, ...resto }) => resto;

// Lo que viaja al navegador: sin criterios, respuestas correctas ni respuesta modelo.
export const casoPublico = (caso) => ({
  ...caso,
  pasos: caso.pasos.map(sinPrivado),
  repaso: caso.repaso && sinPrivado(caso.repaso),
});
