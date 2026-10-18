import type { ArticleInput, Genero } from "../types.ts";

/**
 * Fictional, generic sample articles (one per genre) used by the demo page and the tests.
 * Names, places and figures are invented for illustration only.
 */
export interface Sample {
  id: string;
  generoEsperado: Genero;
  article: ArticleInput;
}

export const SAMPLES: Sample[] = [
  {
    id: "cronica-puente",
    generoEsperado: "cronica",
    article: {
      id: "cronica-puente",
      seccion: "Regiones",
      titular: "Un día entero para cruzar el río: así se reabrió el puente de San Lucas",
      bajada: "Vecinos, ingenieros y escolares vivieron una jornada larga hasta que el puente volvió a abrir.",
      fragmentos: [
        {
          medio: "Diario Escolar (ficticio)",
          fecha: "14 de mayo de 2026",
          texto:
            "A las 6:00 de la mañana, los primeros vecinos ya esperaban junto al río con sus mochilas y sus carretillas. El puente de San Lucas estaba cerrado desde el 2 de marzo de 2026, cuando una crecida dañó uno de sus pilares.\n\n" +
            "A las 8:30, la ingeniera Rosa Quispe revisó por última vez los cables nuevos. Su equipo había trabajado durante diez semanas para cambiar el pilar dañado.\n\n" +
            "Al mediodía, la Municipalidad de San Lucas anunció que la prueba de carga había salido bien. Un camión con arena cruzó despacio mientras todos miraban en silencio.\n\n" +
            "A las 15:00, los estudiantes del colegio Santa Elena cruzaron caminando y aplaudieron al llegar al otro lado.\n\n" +
            "Por la noche, el alcalde Martín Huamán prometió revisar el puente cada seis meses para evitar otra emergencia.",
        },
      ],
    },
  },
  {
    id: "opinion-recreo",
    generoEsperado: "opinion",
    article: {
      id: "opinion-recreo",
      seccion: "Opinión",
      titular: "El recreo también es aprendizaje",
      bajada: "Una columna sobre por qué los colegios no deberían recortar el tiempo de juego.",
      fragmentos: [
        {
          medio: "Columna escolar (ficticia)",
          fecha: "3 de junio de 2026",
          texto:
            "Creo que recortar el recreo es un error. Muchos colegios piensan que quitar diez minutos de juego deja más tiempo para estudiar, pero en mi opinión ocurre lo contrario.\n\n" +
            "Primero, el cerebro necesita pausas. Después de correr o conversar, volvemos al aula con más atención y menos cansancio.\n\n" +
            "Segundo, en el recreo aprendemos a convivir: a turnarnos, a resolver discusiones y a incluir a quien está solo. Eso no aparece en ningún examen, pero es necesario para la vida.\n\n" +
            "Como dijo una profesora en una asamblea: «Un niño que juega también está pensando». Debemos defender ese tiempo, no reducirlo.",
        },
      ],
    },
  },
  {
    id: "informativa-biblioteca",
    generoEsperado: "informativa",
    article: {
      id: "informativa-biblioteca",
      seccion: "Educación",
      titular: "Abren una biblioteca comunitaria en el distrito de Villa Alegre",
      bajada: "El local funcionará en una antigua casa comunal restaurada por los vecinos.",
      fragmentos: [
        {
          medio: "Noticias del Barrio (ficticio)",
          fecha: "20 de abril de 2026",
          texto:
            "La asociación de vecinos de Villa Alegre inauguró el sábado una biblioteca comunitaria en la antigua casa comunal del distrito, para que los escolares tengan un lugar tranquilo donde leer y hacer tareas.\n\n" +
            "La presidenta de la asociación, Carmen Rojas, explicó que el proyecto empezó porque muchos estudiantes no tenían libros en casa.\n\n" +
            "Los vecinos pintaron las paredes, arreglaron el techo y construyeron estantes con madera reciclada. Una editorial local donó cajas de libros.\n\n" +
            "La biblioteca abrirá de martes a domingo por la tarde y ofrecerá talleres de lectura para niños y adolescentes.",
        },
      ],
    },
  },
  {
    id: "datos-agua",
    generoEsperado: "datos",
    article: {
      id: "datos-agua",
      seccion: "Ciencia",
      titular: "Un informe escolar mide cuánta agua se pierde en los colegios",
      bajada: "Estudiantes de secundaria revisaron caños y medidores durante un mes.",
      fragmentos: [
        {
          medio: "Revista de Ciencia Joven (ficticia)",
          fecha: "8 de julio de 2026",
          texto:
            "Un grupo de 32 estudiantes revisó 120 caños en 6 colegios durante un mes. Encontraron que 18 caños goteaban todo el día.\n\n" +
            "Según el informe, cada caño con fuga pierde unos 30 litros al día. En total, los colegios pierden cerca de 540 litros al día, lo que equivale a 16.200 litros al mes.\n\n" +
            "El colegio con más fugas tenía 7 caños dañados, mientras que el que menos tenía solo 1. Después de las reparaciones, el consumo bajó un 12 % en la primera semana y un 15 % en la segunda.",
        },
      ],
    },
  },
  {
    id: "entrevista-astronoma",
    generoEsperado: "entrevista",
    article: {
      id: "entrevista-astronoma",
      seccion: "Entrevistas",
      titular: "«Mirar el cielo me enseñó a tener paciencia»",
      bajada: "Conversamos con Lucía Mendoza, una astrónoma aficionada que enseña a escolares a observar estrellas.",
      fragmentos: [
        {
          medio: "Revista Curiosidad (ficticia)",
          fecha: "12 de agosto de 2026",
          texto:
            "—¿Cuándo empezaste a mirar el cielo?\n" +
            "—Tenía once años. Mi abuelo me prestó unos binoculares viejos y vi los cráteres de la Luna por primera vez.\n" +
            "—¿Qué necesita un estudiante para empezar?\n" +
            "—Solo curiosidad y un lugar oscuro. No hace falta un telescopio caro; con los ojos se pueden reconocer muchas constelaciones.\n" +
            "—¿Qué es lo más difícil de la astronomía?\n" +
            "—Esperar. A veces las nubes tapan todo y hay que volver otra noche. Mirar el cielo me enseñó a tener paciencia.",
        },
      ],
    },
  },
  {
    id: "comparada-parque",
    generoEsperado: "comparada",
    article: {
      id: "comparada-parque",
      seccion: "Ciudad",
      titular: "Dos medios cuentan el cierre del parque Los Olivos",
      bajada: "Mismo hecho, dos miradas: compara qué dice cada uno.",
      fragmentos: [
        {
          lado: "a",
          medio: "El Vecino (ficticio)",
          fecha: "5 de septiembre de 2026",
          titular: "Cierran el parque Los Olivos por obras de mejora",
          texto:
            "La municipalidad cerró el parque Los Olivos durante 3 meses para renovar los juegos infantiles y el sistema de riego. Según el municipio, la obra costará 200 mil soles y mejorará la seguridad de los niños.",
          url: "https://example.org/el-vecino/parque",
        },
        {
          lado: "b",
          medio: "La Voz del Barrio (ficticio)",
          fecha: "5 de septiembre de 2026",
          titular: "Vecinos se quedan sin parque y sin explicaciones",
          texto:
            "Los vecinos se enteraron del cierre del parque Los Olivos por un cartel. La municipalidad dice que la obra durará 3 meses, pero los dirigentes vecinales temen que tarde más de 6 meses, como ocurrió en otra obra. Los vecinos piden que se publique el presupuesto.",
          url: "https://example.org/la-voz/parque",
        },
      ],
    },
  },
];
